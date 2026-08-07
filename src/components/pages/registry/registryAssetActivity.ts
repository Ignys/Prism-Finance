import type { CreditCardInvoice, LedgerEntry, StoredTransaction, TransactionGroup } from "../../../context/finance";

export function hasWalletActivity(
    walletId: string,
    transactionGroups: TransactionGroup[],
    transactions: StoredTransaction[],
    ledgerEntries: LedgerEntry[],
): boolean {
    return (
        transactionGroups.some((group) => group.sourceWalletId === walletId || group.destinationWalletId === walletId) ||
        transactions.some((transaction) => transaction.sourceWalletId === walletId || transaction.destinationWalletId === walletId) ||
        ledgerEntries.some((entry) => entry.walletId === walletId && (entry.transactionId !== null || entry.invoiceId !== null))
    );
}

export function hasCreditCardActivity(
    creditCardId: string,
    transactionGroups: TransactionGroup[],
    transactions: StoredTransaction[],
    invoices: CreditCardInvoice[],
): boolean {
    return (
        transactionGroups.some((group) => group.creditCardId === creditCardId) ||
        transactions.some((transaction) => transaction.creditCardId === creditCardId) ||
        invoices.some((invoice) => invoice.creditCardId === creditCardId)
    );
}
