import type { SupabaseFinanceData } from "../../supabase/finance";
import { createLedgerEntriesForPaidTransaction, parseInvoicePaymentNote } from "./financeCore";
import { roundToCents } from "./helpers";

function paymentInvoiceId(transaction: SupabaseFinanceData["transactions"][number]): string | null {
    return transaction.paymentForInvoiceId ?? parseInvoicePaymentNote(transaction.notes)?.invoiceId ?? null;
}

function comparePayments(a: SupabaseFinanceData["transactions"][number], b: SupabaseFinanceData["transactions"][number], remoteIds: Set<string>): number {
    const remoteOrder = Number(remoteIds.has(b.id)) - Number(remoteIds.has(a.id));
    if (remoteOrder !== 0) return remoteOrder;
    const aDate = a.paidAt ?? a.createdAt;
    const bDate = b.paidAt ?? b.createdAt;
    return aDate === bDate ? a.id.localeCompare(b.id) : aDate.localeCompare(bDate);
}

/**
 * A remote invoice payment is canonical during a rebase. Concurrent local
 * payments may consume only the still-open amount, preventing duplicate
 * wallet debits while preserving valid partial payments.
 */
export function reconcileInvoicePaymentMerge(merged: SupabaseFinanceData, remote: SupabaseFinanceData): SupabaseFinanceData {
    const remoteTransactionIds = new Set(remote.transactions.map((transaction) => transaction.id));
    const transactionsByInvoice = new Map<string, SupabaseFinanceData["transactions"]>();

    for (const transaction of merged.transactions) {
        const invoiceId = transaction.status === "paid" ? paymentInvoiceId(transaction) : null;
        if (!invoiceId) continue;
        transactionsByInvoice.set(invoiceId, [...(transactionsByInvoice.get(invoiceId) ?? []), transaction]);
    }

    const removedTransactionIds = new Set<string>();
    const adjustedTransactionIds = new Set<string>();
    const adjustedAmounts = new Map<string, number>();

    for (const invoice of merged.creditCardInvoices) {
        let remaining = roundToCents(Math.max(0, invoice.totalAmount));
        const payments = [...(transactionsByInvoice.get(invoice.id) ?? [])]
            .sort((a, b) => comparePayments(a, b, remoteTransactionIds));

        for (const payment of payments) {
            const amount = roundToCents(Math.abs(payment.amount));
            const acceptedAmount = roundToCents(Math.min(amount, remaining));
            if (acceptedAmount < 0.01) {
                removedTransactionIds.add(payment.id);
                continue;
            }
            if (acceptedAmount !== amount) {
                adjustedTransactionIds.add(payment.id);
                adjustedAmounts.set(payment.id, acceptedAmount);
            }
            remaining = roundToCents(remaining - acceptedAmount);
        }
    }

    const transactions = merged.transactions
        .filter((transaction) => !removedTransactionIds.has(transaction.id))
        .map((transaction) => adjustedAmounts.has(transaction.id)
            ? { ...transaction, amount: adjustedAmounts.get(transaction.id)! }
            : transaction);
    const remainingTransactionIds = new Set(transactions.map((transaction) => transaction.id));
    const affectedGroupIds = new Set(
        merged.transactions
            .filter((transaction) => removedTransactionIds.has(transaction.id) || adjustedTransactionIds.has(transaction.id))
            .map((transaction) => transaction.groupId),
    );
    const transactionsByGroup = new Map<string, SupabaseFinanceData["transactions"]>();
    for (const transaction of transactions) {
        transactionsByGroup.set(transaction.groupId, [...(transactionsByGroup.get(transaction.groupId) ?? []), transaction]);
    }
    const transactionGroups = merged.transactionGroups
        .filter((group) => !affectedGroupIds.has(group.id) || group.transactionMode === "recurring" || (transactionsByGroup.get(group.id)?.length ?? 0) > 0)
        .map((group) => affectedGroupIds.has(group.id)
            ? { ...group, totalAmount: roundToCents((transactionsByGroup.get(group.id) ?? []).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)) }
            : group);
    const groupsById = new Map(transactionGroups.map((group) => [group.id, group]));
    const affectedTransactionIds = new Set([...removedTransactionIds, ...adjustedTransactionIds]);
    const ledgerEntries = merged.ledgerEntries.filter((entry) => !entry.transactionId || !affectedTransactionIds.has(entry.transactionId));
    for (const transaction of transactions) {
        if (!adjustedTransactionIds.has(transaction.id)) continue;
        const group = groupsById.get(transaction.groupId);
        if (group) ledgerEntries.push(...createLedgerEntriesForPaidTransaction(transaction, group));
    }

    const creditCardInvoices = merged.creditCardInvoices.map((invoice) => {
        const payments = transactions.filter((transaction) => transaction.status === "paid" && paymentInvoiceId(transaction) === invoice.id);
        const paidAmount = roundToCents(Math.min(invoice.totalAmount, payments.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)));
        const paid = invoice.totalAmount > 0 && paidAmount === roundToCents(invoice.totalAmount);
        const orderedPayments = [...payments].sort((a, b) => comparePayments(a, b, remoteTransactionIds));
        const lastPayment = orderedPayments[orderedPayments.length - 1];
        return {
            ...invoice,
            paidAmount,
            status: paid ? "paid" as const : "open" as const,
            paidAt: paid ? remote.creditCardInvoices.find((item) => item.id === invoice.id)?.paidAt ?? lastPayment?.paidAt ?? lastPayment?.createdAt ?? invoice.paidAt : null,
        };
    });

    return {
        ...merged,
        transactions,
        transactionGroups,
        transactionTags: merged.transactionTags.filter((link) => remainingTransactionIds.has(link.transactionId)),
        ledgerEntries,
        creditCardInvoices,
    };
}
