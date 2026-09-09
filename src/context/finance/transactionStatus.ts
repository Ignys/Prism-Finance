import { createLedgerEntriesForPaidTransaction, normalizeStoredTransaction, resolveTransactionCreditCardId } from "./financeCore";
import type { FinanceSnapshot, TransactionStatus } from "./domainTypes";

/** A wallet settlement changes its effective date, never its scheduled date. */
export function applyTransactionStatus(
    snapshot: FinanceSnapshot,
    transactionId: string,
    status: TransactionStatus,
    paidAt = new Date().toISOString(),
): FinanceSnapshot {
    const transaction = snapshot.transactions.find((item) => item.id === transactionId);
    if (!transaction || transaction.status === status) return snapshot;
    const group = snapshot.transactionGroups.find((item) => item.id === transaction.groupId);
    if (!group) throw new Error("Grupo da transação não encontrado.");
    if (transaction.paymentForInvoiceId) throw new Error("Altere o pagamento pela fatura vinculada.");
    const cardId = resolveTransactionCreditCardId(transaction, group);
    if (cardId && (status === "paid" || transaction.status === "paid")) {
        throw new Error("Gastos no cartão são liquidados pelo pagamento da fatura.");
    }
    if (transaction.invoiceId && snapshot.creditCardInvoices.some((invoice) => invoice.id === transaction.invoiceId && invoice.paidAmount > 0)) {
        throw new Error("Reverta o pagamento da fatura antes de alterar seus gastos.");
    }
    const nextTransaction = normalizeStoredTransaction({ ...transaction, status, commitment: status === "paid" ? "posted" : transaction.commitment, paidAt: status === "paid" ? paidAt : null });
    return {
        ...snapshot,
        transactions: snapshot.transactions.map((item) => item.id === transactionId ? nextTransaction : item),
        ledgerEntries: snapshot.ledgerEntries.filter((entry) => entry.transactionId !== transactionId)
            .concat(createLedgerEntriesForPaidTransaction(nextTransaction, group)),
    };
}
