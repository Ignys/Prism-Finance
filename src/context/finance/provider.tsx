import type { ReactNode } from "react";
import { useMemo } from "react";
import {
    FinanceActionsContext,
    FinanceBeneficiariesContext,
    FinanceFamilyContext,
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
    FinanceSyncContext,
    FinanceSharedWishlistsContext,
    FinanceTagsContext,
    FinanceWishItemsContext,
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
            profile: store.profile,
            loading: store.loading,
            family: store.family,
            profileVersion: store.profileVersion,
        }),
        [store.family, store.loading, store.profile, store.profileVersion, store.user],
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
            permanentlyDeleteWallet: store.permanentlyDeleteWallet,
            updateFinance: store.updateFinance,
            addTransaction: store.addTransaction,
            updateTransaction: store.updateTransaction,
            markTransactionAsPaid: store.markTransactionAsPaid,
            deleteTransaction: store.deleteTransaction,
            deleteTransactionWithScope: store.deleteTransactionWithScope,
            updateInvoicePaymentTransaction: store.updateInvoicePaymentTransaction,
            updatePlanningState: store.updatePlanningState,
            clearTransactions: store.clearTransactions,
            addWallet: store.addWallet,
            addBeneficiary: store.addBeneficiary,
            addCategory: store.addCategory,
            addTag: store.addTag,
            addWishItem: store.addWishItem,
            reorderBeneficiaries: store.reorderBeneficiaries,
            reorderCategories: store.reorderCategories,
            reorderTags: store.reorderTags,
            setBeneficiaryActive: store.setBeneficiaryActive,
            permanentlyDeleteBeneficiary: store.permanentlyDeleteBeneficiary,
            setCategoryActive: store.setCategoryActive,
            permanentlyDeleteCategory: store.permanentlyDeleteCategory,
            setTagActive: store.setTagActive,
            permanentlyDeleteTag: store.permanentlyDeleteTag,
            addCreditCard: store.addCreditCard,
            setFavoriteCreditCard: store.setFavoriteCreditCard,
            setCreditCardActive: store.setCreditCardActive,
            deleteCreditCard: store.deleteCreditCard,
            permanentlyDeleteCreditCard: store.permanentlyDeleteCreditCard,
            payCreditCardInvoice: store.payCreditCardInvoice,
            setCreditCardInvoicesPaidState: store.setCreditCardInvoicesPaidState,
            removeWishItem: store.removeWishItem,
            createFamily: store.createFamily,
            generateFamilyInvite: store.generateFamilyInvite,
            joinFamilyByCode: store.joinFamilyByCode,
            removeFamilyMember: store.removeFamilyMember,
        }),
        [
            store.addBeneficiary,
            store.addCategory,
            store.addTag,
            store.addWishItem,
            store.addTransaction,
            store.updateTransaction,
            store.addWallet,
            store.clearTransactions,
            store.deleteTransaction,
            store.deleteTransactionWithScope,
            store.updateInvoicePaymentTransaction,
            store.updatePlanningState,
            store.markTransactionAsPaid,
            store.reorderBeneficiaries,
            store.reorderCategories,
            store.reorderTags,
            store.setFavoriteWallet,
            store.setWalletActive,
            store.deleteWallet,
            store.permanentlyDeleteWallet,
            store.setBeneficiaryActive,
            store.permanentlyDeleteBeneficiary,
            store.setCategoryActive,
            store.permanentlyDeleteCategory,
            store.setTagActive,
            store.permanentlyDeleteTag,
            store.setStartBalance,
            store.addCreditCard,
            store.setFavoriteCreditCard,
            store.setCreditCardActive,
            store.deleteCreditCard,
            store.permanentlyDeleteCreditCard,
            store.payCreditCardInvoice,
            store.setCreditCardInvoicesPaidState,
            store.removeWishItem,
            store.createFamily,
            store.generateFamilyInvite,
            store.joinFamilyByCode,
            store.removeFamilyMember,
            store.updateFinance,
        ],
    );

    return (
        <FinanceSessionContext.Provider value={sessionValue}>
            <FinanceFamilyContext.Provider value={store.family}>
                <FinanceSharedWishlistsContext.Provider value={store.sharedWishlists}>
                    <FinanceFavoriteWalletContext.Provider value={store.favoriteWalletId}>
                        <FinanceFavoriteCreditCardContext.Provider value={store.favoriteCreditCardId}>
                            <FinanceWalletsContext.Provider value={store.wallets}>
                                <FinanceCreditCardsContext.Provider value={store.creditCards}>
                                    <FinanceCreditCardInvoicesContext.Provider value={store.creditCardInvoices}>
                                        <FinanceBeneficiariesContext.Provider value={store.beneficiaries}>
                                            <FinanceCategoriesContext.Provider value={store.categories}>
                                                <FinanceTagsContext.Provider value={store.tags}>
                                                    <FinanceWishItemsContext.Provider value={store.wishItems}>
                                                        <FinanceTransactionGroupsContext.Provider value={store.transactionGroups}>
                                                            <FinanceStoredTransactionsContext.Provider value={store.storedTransactions}>
                                                                <FinanceTransactionTagsContext.Provider value={store.transactionTags}>
                                                                    <FinanceLedgerEntriesContext.Provider value={store.ledgerEntries}>
                                                                        <FinanceTransactionsContext.Provider value={store.transactions}>
                                                                            <FinancePlanningContext.Provider value={store.planning}>
                                                                                <FinanceSummaryContext.Provider value={summaryValue}>
                                                                                    <FinanceActionsContext.Provider value={actionsValue}>
                                                                                        <FinanceSyncContext.Provider value={store.sync}>{children}</FinanceSyncContext.Provider>
                                                                                    </FinanceActionsContext.Provider>
                                                                                </FinanceSummaryContext.Provider>
                                                                            </FinancePlanningContext.Provider>
                                                                        </FinanceTransactionsContext.Provider>
                                                                    </FinanceLedgerEntriesContext.Provider>
                                                                </FinanceTransactionTagsContext.Provider>
                                                            </FinanceStoredTransactionsContext.Provider>
                                                        </FinanceTransactionGroupsContext.Provider>
                                                    </FinanceWishItemsContext.Provider>
                                                </FinanceTagsContext.Provider>
                                            </FinanceCategoriesContext.Provider>
                                        </FinanceBeneficiariesContext.Provider>
                                    </FinanceCreditCardInvoicesContext.Provider>
                                </FinanceCreditCardsContext.Provider>
                            </FinanceWalletsContext.Provider>
                        </FinanceFavoriteCreditCardContext.Provider>
                    </FinanceFavoriteWalletContext.Provider>
                </FinanceSharedWishlistsContext.Provider>
            </FinanceFamilyContext.Provider>
        </FinanceSessionContext.Provider>
    );
}
