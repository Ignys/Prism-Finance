import { parseAppDate, formatLocalDateInput, getLocalTodayDate } from "../../lib/localDate";
import { asString, asDayOfMonth } from "./valueNormalization";
import { roundToCents } from "./helpers";
import type { CreditCardInvoice, InvoiceStatus } from "./domainTypes";

export function toDateInput(value: string): Date {
    const parsed = parseAppDate(value);
    if (parsed) {
        return parsed;
    }

    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
        return new Date();
    }

    return fallback;
}

export function getMonthLength(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDayForMonth(year: number, monthIndex: number, day: number): number {
    return Math.min(getMonthLength(year, monthIndex), Math.max(1, Math.round(day)));
}

export function formatYearMonth(year: number, monthIndex: number): string {
    return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function buildDateString(year: number, monthIndex: number, day: number): string {
    const safeDay = clampDayForMonth(year, monthIndex, day);
    return `${formatYearMonth(year, monthIndex)}-${String(safeDay).padStart(2, "0")}`;
}

export function parseYearMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        year,
        monthIndex: month - 1,
    };
}

export function getMonthKeyFromDateValue(dateValue: string, referenceDate = new Date()): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return formatYearMonth(referenceDate.getFullYear(), referenceDate.getMonth());
    }

    return formatYearMonth(parsedDate.getFullYear(), parsedDate.getMonth());
}

export function resolveCreditCardInvoiceCycle(
    transactionDate: string,
    closingDay: number,
    dueDay: number,
): { cycleKey: string; closingDate: string; dueDate: string } {
    const parsedDate = toDateInput(transactionDate);
    const transactionYear = parsedDate.getFullYear();
    const transactionMonth = parsedDate.getMonth();
    const transactionDay = parsedDate.getDate();

    const safeClosingDay = asDayOfMonth(closingDay, 1);
    const safeDueDay = asDayOfMonth(dueDay, 1);

    const dueMonthOffset = safeClosingDay <= safeDueDay ? (transactionDay > safeClosingDay ? 1 : 0) : transactionDay > safeClosingDay ? 2 : 1;
    const cycleAnchor = new Date(transactionYear, transactionMonth + dueMonthOffset, 1);
    const cycleYear = cycleAnchor.getFullYear();
    const cycleMonth = cycleAnchor.getMonth();
    const closingAnchor = new Date(cycleYear, cycleMonth + (safeClosingDay <= safeDueDay ? 0 : -1), 1);

    return {
        cycleKey: formatYearMonth(cycleYear, cycleMonth),
        closingDate: buildDateString(closingAnchor.getFullYear(), closingAnchor.getMonth(), safeClosingDay),
        dueDate: buildDateString(cycleYear, cycleMonth, safeDueDay),
    };
}

export function resolveCreditCardInvoiceCycleFromCycleKey(
    cycleKey: string,
    closingDay: number,
    dueDay: number,
): { cycleKey: string; closingDate: string; dueDate: string } {
    const parsedMonth = parseYearMonthKey(cycleKey);
    if (!parsedMonth) {
        return resolveCreditCardInvoiceCycle(getLocalTodayDate(), closingDay, dueDay);
    }

    const safeClosingDay = asDayOfMonth(closingDay, 1);
    const safeDueDay = asDayOfMonth(dueDay, 1);
    const closingAnchor = new Date(parsedMonth.year, parsedMonth.monthIndex + (safeClosingDay <= safeDueDay ? 0 : -1), 1);

    return {
        cycleKey: formatYearMonth(parsedMonth.year, parsedMonth.monthIndex),
        closingDate: buildDateString(closingAnchor.getFullYear(), closingAnchor.getMonth(), safeClosingDay),
        dueDate: buildDateString(parsedMonth.year, parsedMonth.monthIndex, safeDueDay),
    };
}

export function parseCreditCardInvoiceId(invoiceId: string): { creditCardId: string; cycleKey: string } | null {
    const normalizedInvoiceId = invoiceId.trim();
    const match = /^invoice-(.+)-(\d{4}-\d{2})$/.exec(normalizedInvoiceId);
    if (!match) {
        return null;
    }

    const creditCardId = match[1]?.trim() ?? "";
    const cycleKey = match[2]?.trim() ?? "";
    if (!creditCardId || !parseYearMonthKey(cycleKey)) {
        return null;
    }

    return {
        creditCardId,
        cycleKey,
    };
}

export function resolveOpenCreditCardInvoiceCycle(
    closingDay: number,
    dueDay: number,
    referenceDate = new Date(),
): { cycleKey: string; closingDate: string; dueDate: string } {
    return resolveCreditCardInvoiceCycle(formatLocalDateInput(referenceDate), closingDay, dueDay);
}

export function getCreditCardInvoiceMonthKey(invoice: Pick<CreditCardInvoice, "dueDate">, referenceDate = new Date()): string {
    return getMonthKeyFromDateValue(invoice.dueDate, referenceDate);
}

export function buildCreditCardInvoiceId(creditCardId: string, cycleKey: string): string {
    return `invoice-${creditCardId}-${cycleKey}`;
}

export function resolveExpectedCreditCardInvoiceId(params: {
    creditCardId: string | null;
    transactionDate: string;
    closingDay: number;
    dueDay: number;
}): string | null {
    const creditCardId = asString(params.creditCardId, "");
    if (!creditCardId) {
        return null;
    }

    const cycle = resolveCreditCardInvoiceCycle(params.transactionDate, params.closingDay, params.dueDay);
    return buildCreditCardInvoiceId(creditCardId, cycle.cycleKey);
}

export function calculateCreditCardInvoiceOpenAmount(invoice: CreditCardInvoice): number {
    return roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount));
}

export function resolveCreditCardInvoiceStatus(params: {
    invoiceCycleKey: string;
    cardClosingDay: number;
    cardDueDay: number;
    totalAmount: number;
    paidAmount: number;
    referenceDate?: Date;
}): InvoiceStatus {
    const { totalAmount, paidAmount } = params;
    const safeTotalAmount = roundToCents(Math.max(0, totalAmount));
    const safePaidAmount = roundToCents(Math.min(safeTotalAmount, Math.max(0, paidAmount)));
    return safePaidAmount >= safeTotalAmount && safeTotalAmount > 0 ? "paid" : "open";
}

