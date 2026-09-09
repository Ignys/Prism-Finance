import { addMonthsToLocalDate, parseDateOnlyToLocalDate } from "../../../lib/localDate";
import { buildCreditCardInvoiceId, normalizeStoredTransaction, resolveCreditCardInvoiceCycle } from "../financeCore";
import type { CreditCard, CreditCardInvoice, StoredTransaction, TransactionGroup, TransactionTag } from "../domainTypes";
import type { OccurrencePeriod, RecurrenceRule } from "./types";

export function occurrenceDate(rule: RecurrenceRule, occurrenceNumber: number): string {
    // Always advance from the original anchor: Jan 31 -> Feb 28 -> Mar 31.
    return addMonthsToLocalDate(rule.anchorDate, (occurrenceNumber - (rule.startNumber ?? 1)) * rule.interval);
}

export function occurrenceId(groupId: string, occurrenceNumber: number): string {
    return `occurrence-${encodeURIComponent(groupId)}-${occurrenceNumber}`;
}

export function isOccurrenceInRule(group: TransactionGroup, number: number): boolean {
    const rule = group.recurrenceRule;
    if (!rule || number < 1 || !Number.isInteger(number)) return false;
    if (number < (rule.startNumber ?? 1) || number > (rule.stopNumber ?? Infinity)) return false;
    const date = occurrenceDate(rule, number);
    if (rule.end.type === "count" && number > rule.end.count) return false;
    if (rule.end.type === "until" && date > rule.end.date) return false;
    if (group.recurrenceEndDate && date > group.recurrenceEndDate) return false;
    return !rule.excludedDates.includes(date);
}

export interface ProjectOccurrencesParams {
    groups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    creditCards: CreditCard[];
    creditCardInvoices?: CreditCardInvoice[];
    period: OccurrencePeriod;
}

/** Pure read model. Calling this function must never enqueue persistence. */
export function projectOccurrences({ groups, transactions, transactionTags, creditCards, creditCardInvoices = [], period }: ProjectOccurrencesParams) {
    const start = parseDateOnlyToLocalDate(period.startDate);
    const end = parseDateOnlyToLocalDate(period.endDate);
    if (!start || !end || period.startDate > period.endDate) throw new Error("Período de consulta inválido.");
    const projected: StoredTransaction[] = [];
    const projectedTags: TransactionTag[] = [];
    const cardsById = new Map(creditCards.map((card) => [card.id, card]));
    for (const group of groups) {
        const rule = group.recurrenceRule;
        if (group.transactionMode !== "recurring" || !rule) continue;
        const anchor = parseDateOnlyToLocalDate(rule.anchorDate)!;
        const monthsToStart = (start.getFullYear() - anchor.getFullYear()) * 12 + start.getMonth() - anchor.getMonth();
        const monthsToEnd = (end.getFullYear() - anchor.getFullYear()) * 12 + end.getMonth() - anchor.getMonth();
        const startNumber = rule.startNumber ?? 1;
        const first = Math.max(startNumber, Math.floor(monthsToStart / rule.interval) + startNumber);
        const last = Math.floor(monthsToEnd / rule.interval) + startNumber;
        const seriesId = rule.seriesId ?? group.id;
        const seriesGroupIds = new Set(groups.filter((item) => (item.recurrenceRule?.seriesId ?? item.id) === seriesId).map((item) => item.id));
        const materialized = transactions.filter((transaction) => seriesGroupIds.has(transaction.groupId));
        const occupiedNumbers = new Set(materialized.map((transaction) => transaction.occurrenceNumber));
        const legacyDates = new Set(materialized.filter((transaction) => !transaction.occurrenceNumber).map((transaction) => transaction.scheduledDate.slice(0, 7)));
        for (let number = first; number <= last; number++) {
            if (!isOccurrenceInRule(group, number) || occupiedNumbers.has(number)) continue;
            const date = occurrenceDate(rule, number);
            if (date < period.startDate || date > period.endDate || legacyDates.has(date.slice(0, 7))) continue;
            const card = cardsById.get(rule.creditCardId ?? group.creditCardId ?? "");
            const id = occurrenceId(seriesId, number);
            const cycleKey = card ? resolveCreditCardInvoiceCycle(date, card.closingDay, card.dueDay).cycleKey : null;
            const invoiceId = card && cycleKey ? creditCardInvoices.find((invoice) => invoice.creditCardId === card.id && invoice.cycleKey === cycleKey)?.id ?? buildCreditCardInvoiceId(card.id, cycleKey) : null;
            projected.push(normalizeStoredTransaction({
                id, groupId: group.id, occurrenceNumber: number, isProjected: true, commitment: "forecast",
                scheduledDate: date, amount: rule.amount, status: "pending", notes: rule.notes,
                sourceWalletId: rule.sourceWalletId, destinationWalletId: rule.destinationWalletId, creditCardId: rule.creditCardId,
                invoiceId,
                createdAt: group.createdAt,
            }));
            projectedTags.push(...rule.tagIds.map((tagId) => ({ transactionId: id, tagId })));
        }
    }
    return {
        transactions: transactions.filter((transaction) => transaction.scheduledDate >= period.startDate && transaction.scheduledDate <= period.endDate).concat(projected),
        transactionTags: transactionTags.concat(projectedTags),
    };
}
