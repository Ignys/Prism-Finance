import { createFinanceSnapshot, normalizeCreditCard, normalizeStoredTransaction, normalizeTransactionGroup, normalizeWallet } from "./financeCore";
import type { StoredTransaction, TransactionGroup } from "./domainTypes";

export const fixtureWallet = normalizeWallet({ id: "wallet-test", name: "Conta", initialBalance: 1000, createdAt: "2026-01-01T12:00:00Z" });
export const fixtureCard = normalizeCreditCard({ id: "card-test", name: "Cartão", limit: 2000, closingDay: 10, dueDay: 17 }, new Set([fixtureWallet.id]));

export function fixtureGroup(patch: Partial<TransactionGroup> = {}): TransactionGroup {
    return normalizeTransactionGroup({
        id: "group-test", title: "Teste", type: "expense", transactionMode: "single",
        sourceWalletId: fixtureWallet.id, totalAmount: 100, createdAt: "2026-01-01T12:00:00Z", ...patch,
    }, new Set([fixtureWallet.id]));
}

export function fixtureTransaction(patch: Partial<StoredTransaction> = {}): StoredTransaction {
    return normalizeStoredTransaction({
        id: "tx-test", groupId: "group-test", amount: 100, scheduledDate: "2026-01-05",
        status: "pending", createdAt: "2026-01-01T12:00:00Z", ...patch,
    });
}

export function fixtureSnapshot(groups = [fixtureGroup()], transactions = [fixtureTransaction()]) {
    return createFinanceSnapshot([fixtureWallet], [fixtureCard], [], null, groups, transactions, [], [], [], [], [], []);
}
