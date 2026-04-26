import { useMemo } from "react";
import {
    createFinanceSnapshot,
    type Beneficiary,
    type Category,
    type CreditCard,
    type CreditCardInvoice,
    type FinanceSnapshot,
    type InvoiceStatus,
    type PaymentMethod,
    type PlanningGoal,
    type PlanningRevenueOverride,
    type PlanningSimulatedExpense,
    type PlanningSimulatedIncome,
    type PlanningState,
    type ResolvedTransactionCategory,
    type Tag,
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
    useRequiredContext,
} from "./contexts";
import type { FinanceContextType } from "./contextTypes";

export type {
    Beneficiary,
    Category,
    CreditCard,
    CreditCardInvoice,
    FinanceSnapshot,
    InvoiceStatus,
    PaymentMethod,
    PlanningGoal,
    PlanningRevenueOverride,
    PlanningSimulatedExpense,
    PlanningSimulatedIncome,
    PlanningState,
    ResolvedTransactionCategory,
    Tag,
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
    const { user, loading } = useFinanceSession();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const beneficiaries = useFinanceBeneficiaries();
    const categories = useFinanceCategories();
    const tags = useFinanceTags();
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
            transactionTags,
            planning,
        );
    }, [beneficiaries, categories, creditCardInvoices, creditCards, favoriteCreditCardId, ledgerEntries, planning, storedTransactions, tags, transactionGroups, transactionTags, user, wallets]);

    return useMemo(
        () => ({
            user,
            loading,
            finance,
            favoriteWalletId,
            wallets,
            favoriteCreditCardId,
            creditCards,
            creditCardInvoices,
            beneficiaries,
            categories,
            tags,
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
            favoriteCreditCardId,
            favoriteWalletId,
            finance,
            loading,
            planning,
            receitas,
            tags,
            transactions,
            user,
            wallets,
        ],
    );
}
