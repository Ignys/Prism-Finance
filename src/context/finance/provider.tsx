import type { ReactNode } from "react";
import { useMemo } from "react";
import {
    FinanceActionsContext,
    FinanceBeneficiariesContext,
    FinanceCategoriesContext,
    FinanceCreditCardInvoicesContext,
    FinanceCreditCardsContext,
    FinanceFavoriteWalletContext,
    FinanceFavoriteCreditCardContext,
    FinanceLedgerEntriesContext,
    FinancePlanningContext,
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
            setWalletActive: store.setWalletActive,
            deleteWallet: store.deleteWallet,
            updateFinance: store.updateFinance,
            addTransaction: store.addTransaction,
            updateTransaction: store.updateTransaction,
            markTransactionAsPaid: store.markTransactionAsPaid,
            deleteTransaction: store.deleteTransaction,
            deleteTransactionWithScope: store.deleteTransactionWithScope,
            repairCreditCardInvoiceAssignments: store.repairCreditCardInvoiceAssignments,
            updateInvoicePaymentTransaction: store.updateInvoicePaymentTransaction,
            updatePlanningState: store.updatePlanningState,
            clearTransactions: store.clearTransactions,
            addWallet: store.addWallet,
            addBeneficiary: store.addBeneficiary,
            addCategory: store.addCategory,
            addTag: store.addTag,
            reorderBeneficiaries: store.reorderBeneficiaries,
            reorderCategories: store.reorderCategories,
            reorderTags: store.reorderTags,
            setBeneficiaryActive: store.setBeneficiaryActive,
            setCategoryActive: store.setCategoryActive,
            setTagActive: store.setTagActive,
            addCreditCard: store.addCreditCard,
            setFavoriteCreditCard: store.setFavoriteCreditCard,
            setCreditCardActive: store.setCreditCardActive,
            deleteCreditCard: store.deleteCreditCard,
            payCreditCardInvoice: store.payCreditCardInvoice,
            setCreditCardInvoicesPaidState: store.setCreditCardInvoicesPaidState,
        }),
        [
            store.addBeneficiary,
            store.addCategory,
            store.addTag,
            store.addTransaction,
            store.updateTransaction,
            store.addWallet,
            store.clearTransactions,
            store.deleteTransaction,
            store.deleteTransactionWithScope,
            store.repairCreditCardInvoiceAssignments,
            store.updateInvoicePaymentTransaction,
            store.updatePlanningState,
            store.markTransactionAsPaid,
            store.reorderBeneficiaries,
            store.reorderCategories,
            store.reorderTags,
            store.setFavoriteWallet,
            store.setWalletActive,
            store.deleteWallet,
            store.setBeneficiaryActive,
            store.setCategoryActive,
            store.setTagActive,
            store.setStartBalance,
            store.addCreditCard,
            store.setFavoriteCreditCard,
            store.setCreditCardActive,
            store.deleteCreditCard,
            store.payCreditCardInvoice,
            store.setCreditCardInvoicesPaidState,
            store.updateFinance,
        ],
    );

    return (
        <FinanceSessionContext.Provider value={sessionValue}>
            <FinanceFavoriteWalletContext.Provider value={store.favoriteWalletId}>
                <FinanceFavoriteCreditCardContext.Provider value={store.favoriteCreditCardId}>
                    <FinanceWalletsContext.Provider value={store.wallets}>
                        <FinanceCreditCardsContext.Provider value={store.creditCards}>
                            <FinanceCreditCardInvoicesContext.Provider value={store.creditCardInvoices}>
                                <FinanceBeneficiariesContext.Provider value={store.beneficiaries}>
                                    <FinanceCategoriesContext.Provider value={store.categories}>
                                        <FinanceTagsContext.Provider value={store.tags}>
                                            <FinanceTransactionGroupsContext.Provider value={store.transactionGroups}>
                                                <FinanceStoredTransactionsContext.Provider value={store.storedTransactions}>
                                                    <FinanceTransactionTagsContext.Provider value={store.transactionTags}>
                                                        <FinanceLedgerEntriesContext.Provider value={store.ledgerEntries}>
                                                            <FinanceTransactionsContext.Provider value={store.transactions}>
                                                                <FinancePlanningContext.Provider value={store.planning}>
                                                                    <FinanceSummaryContext.Provider value={summaryValue}>
                                                                        <FinanceActionsContext.Provider value={actionsValue}>{children}</FinanceActionsContext.Provider>
                                                                    </FinanceSummaryContext.Provider>
                                                                </FinancePlanningContext.Provider>
                                                            </FinanceTransactionsContext.Provider>
                                                        </FinanceLedgerEntriesContext.Provider>
                                                    </FinanceTransactionTagsContext.Provider>
                                                </FinanceStoredTransactionsContext.Provider>
                                            </FinanceTransactionGroupsContext.Provider>
                                        </FinanceTagsContext.Provider>
                                    </FinanceCategoriesContext.Provider>
                                </FinanceBeneficiariesContext.Provider>
                            </FinanceCreditCardInvoicesContext.Provider>
                        </FinanceCreditCardsContext.Provider>
                    </FinanceWalletsContext.Provider>
                </FinanceFavoriteCreditCardContext.Provider>
            </FinanceFavoriteWalletContext.Provider>
        </FinanceSessionContext.Provider>
    );
}
