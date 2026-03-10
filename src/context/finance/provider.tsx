import type { ReactNode } from "react";
import { useMemo } from "react";
import {
    FinanceActionsContext,
    FinanceBeneficiariesContext,
    FinanceCategoriesContext,
    FinanceFavoriteWalletContext,
    FinanceLedgerEntriesContext,
    FinanceSessionContext,
    FinanceStoredTransactionsContext,
    FinanceSummaryContext,
    FinanceTagsContext,
    FinanceTransactionsContext,
    FinanceTransactionGroupsContext,
    FinanceTransactionTagsContext,
    FinanceWalletsContext,
} from "./contexts";
import type { FinanceActionsValue, FinanceSessionValue, FinanceSummaryValue } from "./contextTypes";
import { useFinanceStore } from "./useFinanceStore";

export function FinanceProvider({ children }: { children: ReactNode }) {
    const store = useFinanceStore();

    const sessionValue = useMemo<FinanceSessionValue>(
        () => ({
            user: store.user,
            loading: store.loading,
        }),
        [store.loading, store.user],
    );

    const summaryValue = useMemo<FinanceSummaryValue>(
        () => ({
            despesas: store.despesas,
            receitas: store.receitas,
            balance: store.balance,
        }),
        [store.balance, store.despesas, store.receitas],
    );

    const actionsValue = useMemo<FinanceActionsValue>(
        () => ({
            setStartBalance: store.setStartBalance,
            setFavoriteWallet: store.setFavoriteWallet,
            updateFinance: store.updateFinance,
            addTransaction: store.addTransaction,
            deleteTransaction: store.deleteTransaction,
            clearTransactions: store.clearTransactions,
            addWallet: store.addWallet,
            addBeneficiary: store.addBeneficiary,
            addCategory: store.addCategory,
            addTag: store.addTag,
        }),
        [
            store.addBeneficiary,
            store.addCategory,
            store.addTag,
            store.addTransaction,
            store.addWallet,
            store.clearTransactions,
            store.deleteTransaction,
            store.setFavoriteWallet,
            store.setStartBalance,
            store.updateFinance,
        ],
    );

    return (
        <FinanceSessionContext.Provider value={sessionValue}>
            <FinanceFavoriteWalletContext.Provider value={store.favoriteWalletId}>
                <FinanceWalletsContext.Provider value={store.wallets}>
                    <FinanceBeneficiariesContext.Provider value={store.beneficiaries}>
                        <FinanceCategoriesContext.Provider value={store.categories}>
                            <FinanceTagsContext.Provider value={store.tags}>
                                <FinanceTransactionGroupsContext.Provider value={store.transactionGroups}>
                                    <FinanceStoredTransactionsContext.Provider value={store.storedTransactions}>
                                        <FinanceTransactionTagsContext.Provider value={store.transactionTags}>
                                            <FinanceLedgerEntriesContext.Provider value={store.ledgerEntries}>
                                                <FinanceTransactionsContext.Provider value={store.transactions}>
                                                    <FinanceSummaryContext.Provider value={summaryValue}>
                                                        <FinanceActionsContext.Provider value={actionsValue}>{children}</FinanceActionsContext.Provider>
                                                    </FinanceSummaryContext.Provider>
                                                </FinanceTransactionsContext.Provider>
                                            </FinanceLedgerEntriesContext.Provider>
                                        </FinanceTransactionTagsContext.Provider>
                                    </FinanceStoredTransactionsContext.Provider>
                                </FinanceTransactionGroupsContext.Provider>
                            </FinanceTagsContext.Provider>
                        </FinanceCategoriesContext.Provider>
                    </FinanceBeneficiariesContext.Provider>
                </FinanceWalletsContext.Provider>
            </FinanceFavoriteWalletContext.Provider>
        </FinanceSessionContext.Provider>
    );
}
