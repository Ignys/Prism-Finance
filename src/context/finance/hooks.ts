import { useMemo } from "react";
import type { FamilySummary, SharedWishlistSnapshot } from "../familyTypes";
import {
    createFinanceSnapshot,
    type Beneficiary,
    type Category,
    type CreditCard,
    type CreditCardInvoice,
    type FinanceSnapshot,
    type InvoiceStatus,
    type PaymentMethod,
    type PlanningRevenueOverride,
    type PlanningSimulatedExpense,
    type PlanningSimulatedIncome,
    type PlanningWishlistSelection,
    type PlanningState,
    type ResolvedTransactionCategory,
    type Tag,
    type WishItem,
    type WishItemPriority,
    type Transaction,
    type TransactionEntity,
    type TransactionDraft,
    type TransactionListItem,
    type TransactionStatus,
    type TransactionSystemKind,
    type TransactionTag,
    type TransactionType,
    type Wallet,
} from "../financeTypes";
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
    FinanceSharedWishlistsContext,
    FinanceTagsContext,
    FinanceWishItemsContext,
    FinanceTransactionsContext,
    FinanceTransactionGroupsContext,
    FinanceTransactionTagsContext,
    FinanceWalletsContext,
    useRequiredContext,
} from "./contexts";
import type { FinanceContextType } from "./contextTypes";

export type {
    FamilySummary,
    Beneficiary,
    Category,
    CreditCard,
    CreditCardInvoice,
    FinanceSnapshot,
    InvoiceStatus,
    PaymentMethod,
    PlanningRevenueOverride,
    PlanningSimulatedExpense,
    PlanningSimulatedIncome,
    PlanningWishlistSelection,
    PlanningState,
    ResolvedTransactionCategory,
    SharedWishlistSnapshot,
    Tag,
    WishItem,
    WishItemPriority,
    Transaction,
    TransactionEntity,
    TransactionDraft,
    TransactionListItem,
    TransactionStatus,
    TransactionSystemKind,
    TransactionTag,
    TransactionType,
    Wallet,
};

export function useFinanceSession() {
    return useRequiredContext(FinanceSessionContext, "useFinanceSession");
}

export function useFinanceFamily() {
    return useRequiredContext(FinanceFamilyContext, "useFinanceFamily");
}

export function useFinanceSharedWishlists() {
    return useRequiredContext(FinanceSharedWishlistsContext, "useFinanceSharedWishlists");
}

export function useFinanceFavoriteWallet() {
    return useRequiredContext(FinanceFavoriteWalletContext, "useFinanceFavoriteWallet");
}

export function useFinanceFavoriteCreditCard() {
    return useRequiredContext(FinanceFavoriteCreditCardContext, "useFinanceFavoriteCreditCard");
}

export function useFinanceWallets() {
    return useRequiredContext(FinanceWalletsContext, "useFinanceWallets");
}

export function useFinanceCreditCards() {
    return useRequiredContext(FinanceCreditCardsContext, "useFinanceCreditCards");
}

export function useFinanceCreditCardInvoices() {
    return useRequiredContext(FinanceCreditCardInvoicesContext, "useFinanceCreditCardInvoices");
}

export function useFinanceBeneficiaries() {
    return useRequiredContext(FinanceBeneficiariesContext, "useFinanceBeneficiaries");
}

export function useFinanceCategories() {
    return useRequiredContext(FinanceCategoriesContext, "useFinanceCategories");
}

export function useFinanceTags() {
    return useRequiredContext(FinanceTagsContext, "useFinanceTags");
}

export function useFinanceWishItems() {
    return useRequiredContext(FinanceWishItemsContext, "useFinanceWishItems");
}

export function useFinanceTransactionGroups() {
    return useRequiredContext(FinanceTransactionGroupsContext, "useFinanceTransactionGroups");
}

export function useFinanceStoredTransactions() {
    return useRequiredContext(FinanceStoredTransactionsContext, "useFinanceStoredTransactions");
}

export function useFinanceTransactionTags() {
    return useRequiredContext(FinanceTransactionTagsContext, "useFinanceTransactionTags");
}

export function useFinanceLedgerEntries() {
    return useRequiredContext(FinanceLedgerEntriesContext, "useFinanceLedgerEntries");
}

export function useFinanceTransactions() {
    return useRequiredContext(FinanceTransactionsContext, "useFinanceTransactions");
}

export function useFinancePlanning() {
    return useRequiredContext(FinancePlanningContext, "useFinancePlanning");
}

export function useFinanceSummary() {
    return useRequiredContext(FinanceSummaryContext, "useFinanceSummary");
}

export function useFinanceActions() {
    return useRequiredContext(FinanceActionsContext, "useFinanceActions");
}

export function useFinance(): FinanceContextType {
    const { user, profile, loading, profileVersion } = useFinanceSession();
    const family = useFinanceFamily();
    const sharedWishlists = useFinanceSharedWishlists();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const beneficiaries = useFinanceBeneficiaries();
    const categories = useFinanceCategories();
    const tags = useFinanceTags();
    const wishItems = useFinanceWishItems();
    const transactionGroups = useFinanceTransactionGroups();
    const storedTransactions = useFinanceStoredTransactions();
    const transactionTags = useFinanceTransactionTags();
    const ledgerEntries = useFinanceLedgerEntries();
    const transactions = useFinanceTransactions();
    const planning = useFinancePlanning();
    const { despesas, receitas, balance } = useFinanceSummary();
    const actions = useFinanceActions();

    const finance = useMemo(() => {
        if (!user) {
            return null;
        }
        return createFinanceSnapshot(
            wallets,
            creditCards,
            creditCardInvoices,
            favoriteCreditCardId,
            transactionGroups,
            storedTransactions,
            ledgerEntries,
            beneficiaries,
            categories,
            tags,
            wishItems,
            transactionTags,
            planning,
        );
    }, [beneficiaries, categories, creditCardInvoices, creditCards, favoriteCreditCardId, ledgerEntries, planning, storedTransactions, tags, transactionGroups, transactionTags, user, wallets, wishItems]);

    return useMemo(
        () => ({
            user,
            profile,
            loading,
            profileVersion,
            family,
            sharedWishlists,
            finance,
            favoriteWalletId,
            wallets,
            favoriteCreditCardId,
            creditCards,
            creditCardInvoices,
            beneficiaries,
            categories,
            tags,
            wishItems,
            transactions,
            planning,
            despesas,
            receitas,
            balance,
            ...actions,
        }),
        [
            actions,
            balance,
            beneficiaries,
            categories,
            creditCardInvoices,
            creditCards,
            despesas,
            family,
            favoriteCreditCardId,
            favoriteWalletId,
            finance,
            loading,
            planning,
            profile,
            profileVersion,
            receitas,
            sharedWishlists,
            tags,
            transactions,
            user,
            wallets,
            wishItems,
        ],
    );
}
