import { useMemo } from "react";
import {
    createFinanceSnapshot,
    type Beneficiary,
    type Category,
    type FinanceSnapshot,
    type ResolvedTransactionCategory,
    type Tag,
    type Transaction,
    type TransactionEntity,
    type TransactionDraft,
    type TransactionListItem,
    type TransactionStatus,
    type TransactionTag,
    type TransactionType,
    type Wallet,
} from "../financeTypes";
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
    useRequiredContext,
} from "./contexts";
import type { FinanceContextType } from "./contextTypes";

export type {
    Beneficiary,
    Category,
    FinanceSnapshot,
    ResolvedTransactionCategory,
    Tag,
    Transaction,
    TransactionEntity,
    TransactionDraft,
    TransactionListItem,
    TransactionStatus,
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

export function useFinanceWallets() {
    return useRequiredContext(FinanceWalletsContext, "useFinanceWallets");
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

export function useFinanceSummary() {
    return useRequiredContext(FinanceSummaryContext, "useFinanceSummary");
}

export function useFinanceActions() {
    return useRequiredContext(FinanceActionsContext, "useFinanceActions");
}

export function useFinance(): FinanceContextType {
    const { user, loading } = useFinanceSession();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const wallets = useFinanceWallets();
    const beneficiaries = useFinanceBeneficiaries();
    const categories = useFinanceCategories();
    const tags = useFinanceTags();
    const transactionGroups = useFinanceTransactionGroups();
    const storedTransactions = useFinanceStoredTransactions();
    const transactionTags = useFinanceTransactionTags();
    const ledgerEntries = useFinanceLedgerEntries();
    const transactions = useFinanceTransactions();
    const { despesas, receitas, balance } = useFinanceSummary();
    const actions = useFinanceActions();

    const finance = useMemo(() => {
        if (!user) {
            return null;
        }
        return createFinanceSnapshot(wallets, transactionGroups, storedTransactions, ledgerEntries, beneficiaries, categories, tags, transactionTags);
    }, [beneficiaries, categories, ledgerEntries, storedTransactions, tags, transactionGroups, transactionTags, user, wallets]);

    return useMemo(
        () => ({
            user,
            loading,
            finance,
            favoriteWalletId,
            wallets,
            beneficiaries,
            categories,
            tags,
            transactions,
            despesas,
            receitas,
            balance,
            ...actions,
        }),
        [actions, balance, beneficiaries, categories, despesas, favoriteWalletId, finance, loading, receitas, tags, transactions, user, wallets],
    );
}
