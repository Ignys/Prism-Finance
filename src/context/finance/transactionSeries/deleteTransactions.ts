import type { FinanceSnapshot, TransactionSeriesScope } from "../domainTypes";
import { materializeOccurrence } from "../recurrence/materializeOccurrence";
import { isConsolidatedOccurrence, recurringOrdinal } from "../recurrence/updateRecurringSeries";
import { getLocalTodayDate } from "../../../lib/localDate";
import { recalculateGroupTotals } from "./helpers";
import { parseInvoicePaymentNote } from "../financeCore";
import { syncCreditCardInvoices } from "../syncCreditCardInvoices";
import { assertInvoiceMutation } from "../invoiceMutations";

export function deleteTransactionsSnapshot(before: FinanceSnapshot, transactionId: string, scope: TransactionSeriesScope, today = getLocalTodayDate()): FinanceSnapshot {
    const snapshot = materializeOccurrence(before, transactionId);
    const selected = snapshot.transactions.find((item) => item.id === transactionId)!;
    const group = snapshot.transactionGroups.find((item) => item.id === selected.groupId)!;
    const seriesId = group.recurrenceRule?.seriesId ?? group.id;
    const recurring = group.transactionMode === "recurring";
    const selectedNumber = recurring ? recurringOrdinal(selected, group) : selected.installmentNumber ?? 1;
    const groupsById = new Map(snapshot.transactionGroups.map((item) => [item.id, item]));
    const removed = new Set<string>();
    const transactions = snapshot.transactions.flatMap((transaction) => {
        const parent = groupsById.get(transaction.groupId)!;
        const sameSeries = recurring ? (parent.recurrenceRule?.seriesId ?? parent.id) === seriesId : parent.id === group.id;
        const number = recurring && sameSeries ? recurringOrdinal(transaction, parent) : transaction.installmentNumber ?? 1;
        const targeted = sameSeries && (scope === "single" ? transaction.id === selected.id : scope === "all" || number >= selectedNumber);
        if (!targeted) return [transaction];
        if (scope !== "single" && isConsolidatedOccurrence(transaction, parent, today)) return [transaction];
        removed.add(transaction.id);
        if (recurring && scope === "single") return [{ ...transaction, occurrenceNumber: selectedNumber, status: "skipped" as const, paidAt: null }];
        return [];
    });
    const groupsWithTransactions = new Set(transactions.map((item) => item.groupId));
    const groups = snapshot.transactionGroups.flatMap((item) => {
        if (item.transactionMode !== "recurring") return groupsWithTransactions.has(item.id) ? [item] : [];
        if ((item.recurrenceRule?.seriesId ?? item.id) !== seriesId || scope === "single") return [item];
        return [{ ...item, recurrenceRule: { ...item.recurrenceRule!, seriesId, stopNumber: Math.min(item.recurrenceRule?.stopNumber ?? Infinity, scope === "all" ? 0 : selectedNumber - 1) } }];
    });
    const invoices = snapshot.creditCardInvoices.map((invoice) => {
        const paidAmount = transactions.reduce((sum, transaction) => {
            const paymentId = transaction.paymentForInvoiceId ?? parseInvoicePaymentNote(transaction.notes)?.invoiceId;
            return paymentId === invoice.id && transaction.status === "paid" ? sum + transaction.amount : sum;
        }, 0);
        return { ...invoice, paidAmount };
    });
    const synced = syncCreditCardInvoices({ creditCards: snapshot.creditCards, transactionGroups: groups, transactions, existingInvoices: invoices });
    const next = {
        ...snapshot, transactions: synced.transactions, transactionGroups: recalculateGroupTotals(groups, synced.transactions), creditCardInvoices: synced.creditCardInvoices,
        ledgerEntries: snapshot.ledgerEntries.filter((entry) => !entry.transactionId || !removed.has(entry.transactionId)),
        transactionTags: snapshot.transactionTags.filter((link) => transactions.some((item) => item.id === link.transactionId)),
    };
    assertInvoiceMutation(before, next);
    return next;
}
