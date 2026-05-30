import type { CreditCard, CreditCardInvoice, LedgerEntry, Transaction, Wallet } from "../../../context/FinanceContext";

export function getAllWalletIds(wallets: Wallet[]): string[] {
    return wallets.map((wallet) => wallet.id);
}

export function getAllCreditCardIds(creditCards: CreditCard[]): string[] {
    return creditCards.map((creditCard) => creditCard.id);
}

export function resolveSelectedIds(allIds: string[], selectedIds: string[]): string[] {
    if (allIds.length < 1) {
        return [];
    }

    const selectedIdSet = new Set(selectedIds);
    const resolvedIds = allIds.filter((id) => selectedIdSet.has(id));
    const nextIds = resolvedIds.length > 0 ? resolvedIds : allIds;
    return [...nextIds].sort((left, right) => left.localeCompare(right));
}

export function areAllWalletsSelected(walletIds: string[], selectedWalletIds: string[]): boolean {
    const selectedWalletIdSet = new Set(selectedWalletIds);
    return walletIds.length > 0 && walletIds.every((walletId) => selectedWalletIdSet.has(walletId));
}

export function getScopedWallets(wallets: Wallet[], selectedWalletIds: string[]): Wallet[] {
    const selectedWalletIdSet = new Set(selectedWalletIds);
    return wallets.filter((wallet) => selectedWalletIdSet.has(wallet.id));
}

export function getScopedCreditCards(creditCards: CreditCard[], selectedWalletIds: string[], allWalletsSelected: boolean): CreditCard[] {
    if (allWalletsSelected) {
        return creditCards;
    }

    const selectedWalletIdSet = new Set(selectedWalletIds);
    return creditCards.filter((creditCard) => creditCard.bankWalletId !== null && selectedWalletIdSet.has(creditCard.bankWalletId));
}

export function getScopedCreditCardInvoices(creditCardInvoices: CreditCardInvoice[], scopedCreditCards: CreditCard[]): CreditCardInvoice[] {
    const scopedCreditCardIds = new Set(scopedCreditCards.map((creditCard) => creditCard.id));
    return creditCardInvoices.filter((invoice) => scopedCreditCardIds.has(invoice.creditCardId));
}

export function getScopedLedgerEntries(ledgerEntries: LedgerEntry[], selectedWalletIds: string[]): LedgerEntry[] {
    const selectedWalletIdSet = new Set(selectedWalletIds);
    return ledgerEntries.filter((entry) => selectedWalletIdSet.has(entry.walletId));
}

export function getScopedTransactions(
    transactions: Transaction[],
    selectedWalletIds: string[],
    scopedCreditCards: CreditCard[],
    allWalletsSelected: boolean,
): Transaction[] {
    if (allWalletsSelected) {
        return transactions;
    }

    const selectedWalletIdSet = new Set(selectedWalletIds);
    const scopedCreditCardIds = new Set(scopedCreditCards.map((creditCard) => creditCard.id));

    return transactions.filter((transaction) => {
        if (selectedWalletIdSet.has(transaction.inWallet)) {
            return true;
        }

        return transaction.creditCardId !== null && scopedCreditCardIds.has(transaction.creditCardId);
    });
}

export function getScopedCreditCardsByIds(creditCards: CreditCard[], selectedCreditCardIds: string[]): CreditCard[] {
    const selectedCreditCardIdSet = new Set(selectedCreditCardIds);
    return creditCards.filter((creditCard) => selectedCreditCardIdSet.has(creditCard.id));
}

export function getReportScopedTransactions(
    transactions: Transaction[],
    selectedWalletIds: string[],
    selectedCreditCardIds: string[],
    allWalletsSelected: boolean,
    allCreditCardsSelected: boolean,
): Transaction[] {
    if (allWalletsSelected && allCreditCardsSelected) {
        return transactions;
    }

    const selectedWalletIdSet = new Set(selectedWalletIds);
    const selectedCreditCardIdSet = new Set(selectedCreditCardIds);

    return transactions.filter((transaction) => {
        const belongsToWallet = selectedWalletIdSet.has(transaction.inWallet);
        const belongsToCreditCard = transaction.creditCardId !== null && selectedCreditCardIdSet.has(transaction.creditCardId);
        return belongsToWallet || belongsToCreditCard;
    });
}
