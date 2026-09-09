import type { FinanceSnapshot, StoredTransaction } from "./domainTypes";
import { resolveTransactionCreditCardId, resolveTransactionSourceWalletId, resolveTransactionDestinationWalletId } from "./financeCore";

type InvoiceMutationSnapshot = Pick<FinanceSnapshot, "transactions" | "transactionGroups" | "creditCardInvoices">;

export function assertInvoiceMutation(before: InvoiceMutationSnapshot, after: InvoiceMutationSnapshot): void {
    const afterById = new Map(after.transactions.map((item) => [item.id, item]));
    const beforeById = new Map(before.transactions.map((item) => [item.id, item]));
    const stillPaid = new Set(after.creditCardInvoices.filter((invoice) => invoice.paidAmount > 0).map((invoice) => invoice.id));
    const protectedInvoices = new Set(before.creditCardInvoices.filter((invoice) => invoice.paidAmount > 0 && stillPaid.has(invoice.id)).map((invoice) => invoice.id));
    const financialFields: Array<keyof StoredTransaction> = ["amount", "scheduledDate", "invoiceId", "status"];
    for (const transaction of before.transactions) {
        if (!transaction.invoiceId || !protectedInvoices.has(transaction.invoiceId)) continue;
        const next = afterById.get(transaction.id);
        const beforeGroup = before.transactionGroups.find((group) => group.id === transaction.groupId);
        const afterGroup = after.transactionGroups.find((group) => group.id === next?.groupId);
        const routingChanged = next && [resolveTransactionCreditCardId, resolveTransactionSourceWalletId, resolveTransactionDestinationWalletId]
            .some((resolve) => resolve(transaction, beforeGroup) !== resolve(next, afterGroup));
        if (!next || routingChanged || (next.commitment ?? "posted") !== (transaction.commitment ?? "posted") || financialFields.some((field) => (next[field] ?? null) !== (transaction[field] ?? null))) {
            throw new Error("Reverta o pagamento da fatura antes de alterar seus gastos.");
        }
    }
    for (const transaction of after.transactions) {
        const previous = beforeById.get(transaction.id);
        if (transaction.invoiceId && protectedInvoices.has(transaction.invoiceId) && beforeById.get(transaction.id)?.invoiceId !== transaction.invoiceId) {
            throw new Error("Faturas pagas estão disponíveis apenas para consulta. Reverta o pagamento para incluir gastos.");
        }
        const group = after.transactionGroups.find((item) => item.id === transaction.groupId);
        const previousGroup = before.transactionGroups.find((item) => item.id === previous?.groupId);
        const cardId = resolveTransactionCreditCardId(transaction, group);
        const previousCardId = previous ? resolveTransactionCreditCardId(previous, previousGroup) : null;
        if (cardId && transaction.status === "paid" && (previous?.status !== "paid" || previousCardId !== cardId)) {
            throw new Error("Gastos no cartão são liquidados pelo pagamento da fatura.");
        }
    }
}
