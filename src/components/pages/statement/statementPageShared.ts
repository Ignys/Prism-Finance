import { type CreditCard, type CreditCardInvoice, type Transaction } from "../../../context/FinanceContext";
import { getLocalTodayDate } from "../../../lib/localDate";

export type StatementInvoiceVisualStatus = "paid" | "overdue" | "closed" | "open";

export interface StatementFilterState {
    selectedMonth: string;
    selectedCardId: string;
}

export interface StatementFocusedInvoiceSummary {
    cycleKey: string;
    dueDate: string;
    closingDate: string;
    status: StatementInvoiceVisualStatus;
    openAmount: number;
    cardName: string;
}

export interface StatementSummary {
    selectedMonth: string;
    selectedCardName: string;
    invoiceCountInMonth: number;
    transactionCountInMonth: number;
    spentInMonth: number;
    openInMonth: number;
    paidInMonth: number;
    limitTotalScope: number;
    openAmountScope: number;
    availableLimitEstimate: number;
    statusDistribution: Record<StatementInvoiceVisualStatus, number>;
    focusedInvoice: StatementFocusedInvoiceSummary | null;
}

interface BuildStatementSummaryParams {
    selectedMonth: string;
    selectedCardName: string;
    scopedCards: CreditCard[];
    scopedInvoices: CreditCardInvoice[];
    monthInvoices: CreditCardInvoice[];
    monthTransactions: Transaction[];
    cardNameById: Map<string, string>;
    referenceDate?: Date;
}

interface StatementInvoiceSnapshot {
    invoice: CreditCardInvoice;
    status: StatementInvoiceVisualStatus;
    openAmount: number;
    cardName: string;
}

const STATUS_PRIORITY: Record<StatementInvoiceVisualStatus, number> = {
    overdue: 0,
    closed: 1,
    open: 2,
    paid: 3,
};

export const STATEMENT_STATUS_LABELS: Record<StatementInvoiceVisualStatus, string> = {
    open: "Aberta",
    closed: "Fechada",
    overdue: "Vencida",
    paid: "Paga",
};

export const STATEMENT_STATUS_BADGE_CLASS: Record<StatementInvoiceVisualStatus, string> = {
    open: "border-amber-300/30 bg-amber-500/10 text-amber-200",
    closed: "border-sky-300/30 bg-sky-500/10 text-sky-200",
    overdue: "border-red-400/30 bg-red-500/10 text-red-200",
    paid: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
};

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export const INITIAL_STATEMENT_FILTER_STATE: StatementFilterState = {
    selectedMonth: getCurrentMonthKey(),
    selectedCardId: "all",
};

function padMonthPart(value: number): string {
    return String(value).padStart(2, "0");
}

export function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonthPart(referenceDate.getMonth() + 1)}`;
}

export function shiftMonth(monthKey: string, offset: number): string {
    const [yearPart, monthPart] = monthKey.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return getCurrentMonthKey();
    }

    const shifted = new Date(year, month - 1 + offset, 1);
    return getCurrentMonthKey(shifted);
}

export function formatMonthLabel(monthKey: string): string {
    const [yearPart, monthPart] = monthKey.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return monthKey;
    }

    const formatted = monthLabelFormatter.format(new Date(year, month - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}

export function getInvoiceOpenAmount(invoice: CreditCardInvoice): number {
    return Math.max(0, invoice.totalAmount - invoice.paidAmount);
}

export function resolveInvoiceVisualStatus(invoice: CreditCardInvoice, referenceDate = new Date()): StatementInvoiceVisualStatus {
    const openAmount = getInvoiceOpenAmount(invoice);
    if (invoice.status === "paid" || openAmount <= 0) {
        return "paid";
    }

    const today = getLocalTodayDate(referenceDate);
    if (today > invoice.dueDate) {
        return "overdue";
    }

    if (today > invoice.closingDate && today <= invoice.dueDate) {
        return "closed";
    }

    return "open";
}

export function compareInvoicesByDueDate(a: CreditCardInvoice, b: CreditCardInvoice): number {
    if (a.dueDate === b.dueDate) {
        return a.id.localeCompare(b.id);
    }

    return a.dueDate.localeCompare(b.dueDate);
}

function getFocusedInvoice(entries: StatementInvoiceSnapshot[]): StatementInvoiceSnapshot | null {
    if (entries.length < 1) {
        return null;
    }

    const sorted = [...entries].sort((a, b) => {
        const statusPriorityDifference = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (statusPriorityDifference !== 0) {
            return statusPriorityDifference;
        }

        if (a.invoice.dueDate === b.invoice.dueDate) {
            return a.invoice.id.localeCompare(b.invoice.id);
        }

        return a.invoice.dueDate.localeCompare(b.invoice.dueDate);
    });

    return sorted[0];
}

export function buildStatementSummary({
    selectedMonth,
    selectedCardName,
    scopedCards,
    scopedInvoices,
    monthInvoices,
    monthTransactions,
    cardNameById,
    referenceDate = new Date(),
}: BuildStatementSummaryParams): StatementSummary {
    const monthSnapshots = monthInvoices.map((invoice) => {
        const status = resolveInvoiceVisualStatus(invoice, referenceDate);
        const openAmount = getInvoiceOpenAmount(invoice);
        const cardName = cardNameById.get(invoice.creditCardId) ?? "Cartao removido";

        return {
            invoice,
            status,
            openAmount,
            cardName,
        };
    });

    const statusDistribution: Record<StatementInvoiceVisualStatus, number> = {
        open: 0,
        closed: 0,
        overdue: 0,
        paid: 0,
    };

    monthSnapshots.forEach((snapshot) => {
        statusDistribution[snapshot.status] += 1;
    });

    const focusedInvoiceSnapshot = getFocusedInvoice(monthSnapshots);
    const focusedInvoice = focusedInvoiceSnapshot
        ? {
              cycleKey: focusedInvoiceSnapshot.invoice.cycleKey,
              dueDate: focusedInvoiceSnapshot.invoice.dueDate,
              closingDate: focusedInvoiceSnapshot.invoice.closingDate,
              status: focusedInvoiceSnapshot.status,
              openAmount: focusedInvoiceSnapshot.openAmount,
              cardName: focusedInvoiceSnapshot.cardName,
          }
        : null;

    const spentInMonth = monthInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const openInMonth = monthSnapshots.reduce((sum, invoice) => sum + invoice.openAmount, 0);
    const paidInMonth = monthInvoices.reduce((sum, invoice) => sum + Math.min(invoice.totalAmount, invoice.paidAmount), 0);
    const limitTotalScope = scopedCards.reduce((sum, card) => sum + card.limit, 0);
    const openAmountScope = scopedInvoices.reduce((sum, invoice) => sum + getInvoiceOpenAmount(invoice), 0);

    return {
        selectedMonth,
        selectedCardName,
        invoiceCountInMonth: monthInvoices.length,
        transactionCountInMonth: monthTransactions.length,
        spentInMonth,
        openInMonth,
        paidInMonth,
        limitTotalScope,
        openAmountScope,
        availableLimitEstimate: Math.max(0, limitTotalScope - openAmountScope),
        statusDistribution,
        focusedInvoice,
    };
}
