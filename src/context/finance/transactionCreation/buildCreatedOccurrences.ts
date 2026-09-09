import { addMonthsToLocalDate, getLocalTodayDate } from "../../../lib/localDate";
import type { FinanceSnapshot, StoredTransaction, TransactionDraft, TransactionGroup, TransactionStatus } from "../domainTypes";
import { buildCreditCardInvoiceId, normalizeStoredTransaction, parseCreditCardInvoiceId, resolveCreditCardInvoiceCycle, resolveLedgerEntryDateIso } from "../financeCore";
import { createId } from "../helpers";
import { buildInstallmentSchedule } from "../installmentTransactions";

function creationInvoiceId(snapshot: FinanceSnapshot, group: TransactionGroup, draft: TransactionDraft, date: string, offset: number): string | null {
    const card = snapshot.creditCards.find((item) => item.id === group.creditCardId);
    if (group.type !== "expense" || !card) return null;
    const requestedId = draft.invoiceId?.trim() ?? "";
    const requested = snapshot.creditCardInvoices.find((item) => item.id === requestedId) ?? parseCreditCardInvoiceId(requestedId);
    const cycle = requested?.creditCardId === card.id ? requested.cycleKey : resolveCreditCardInvoiceCycle(date, card.closingDay, card.dueDay).cycleKey;
    const cycleKey = addMonthsToLocalDate(`${cycle}-01`, offset).slice(0, 7);
    return snapshot.creditCardInvoices.find((item) => item.creditCardId === card.id && item.cycleKey === cycleKey)?.id ?? buildCreditCardInvoiceId(card.id, cycleKey);
}

export function buildCreatedOccurrences(params: {
    snapshot: FinanceSnapshot; draft: TransactionDraft; group: TransactionGroup; transactionId: string;
    amount: number; scheduledDate: string; status: TransactionStatus; ignoredInstallmentsCount: number; now: string;
}): StoredTransaction[] {
    const { snapshot, draft, group, transactionId, amount, scheduledDate, status, ignoredInstallmentsCount, now } = params;
    const today = getLocalTodayDate(new Date(now));
    const hasInvoiceOverride = Boolean(group.creditCardId && draft.invoiceId &&
        creationInvoiceId(snapshot, group, draft, scheduledDate, 0) !== creationInvoiceId(snapshot, group, { ...draft, invoiceId: null }, scheduledDate, 0));
    if (group.transactionMode === "recurring" && status === "pending" && (!group.creditCardId || scheduledDate > today) && !hasInvoiceOverride) return [];
    const schedule = group.transactionMode === "installment" && group.installmentCount
        ? buildInstallmentSchedule({ totalAmount: amount, installmentCount: group.installmentCount, startDate: scheduledDate, initialStatus: status,
            ignoredInstallmentsCount, advanceDatesMonthly: !group.creditCardId })
        : [{ amount, scheduledDate, status, installmentNumber: null }];
    return schedule.map((item, index) => normalizeStoredTransaction({
        ...item, id: index === 0 ? transactionId : createId("tx"), groupId: group.id,
        occurrenceNumber: group.transactionMode === "recurring" ? 1 : null,
        commitment: item.status !== "paid" && group.transactionMode === "recurring" && item.scheduledDate > today ? "forecast" : "posted",
        paidAt: item.status === "paid" ? resolveLedgerEntryDateIso(item.scheduledDate, now) : null,
        invoiceId: creationInvoiceId(snapshot, group, draft, item.scheduledDate, index), notes: draft.notes || null, createdAt: now,
    }));
}
