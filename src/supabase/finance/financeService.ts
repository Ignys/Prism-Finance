import type { SupabaseClient } from "@supabase/supabase-js";
import { createFinanceSnapshot, type FinanceSnapshot, type PlanningState } from "../../context/financeTypes";
import { getSupabaseClient } from "../supabaseClient";
import {
    fromBeneficiaryRow,
    fromCategoryRow,
    fromCreditCardInvoiceRow,
    fromCreditCardRow,
    fromLedgerEntryRow,
    fromTagRow,
    fromTransactionGroupRow,
    fromTransactionRow,
    fromTransactionTagRow,
    fromWalletRow,
    fromWishItemRow,
    toBeneficiaryRow,
    toCategoryRow,
    toCreditCardInvoiceRow,
    toCreditCardRow,
    toLedgerEntryRow,
    toPreferenceRow,
    toTagRow,
    toTransactionGroupRow,
    toTransactionRow,
    toTransactionTagRow,
    toWalletRow,
    toWishItemRow,
} from "./financeRowMappers";
import {
    FINANCE_TABLES,
    type BeneficiaryRow,
    type CategoryRow,
    type CreditCardInvoiceRow,
    type CreditCardRow,
    type FinancePreferenceRow,
    type LedgerEntryRow,
    type TagRow,
    type TransactionGroupRow,
    type TransactionRow,
    type TransactionTagRow,
    type WalletRow,
    type WishItemRow,
} from "./financeTables";

export interface SupabaseFinanceData extends FinanceSnapshot {
    favoriteWalletId: string | null;
}

type FinanceTableName = (typeof FINANCE_TABLES)[keyof typeof FINANCE_TABLES];

interface UserScopedRow {
    user_id: string;
}

async function throwIfError<T>(result: { data: T | null; error: Error | null }): Promise<T> {
    if (result.error) {
        throw result.error;
    }

    return result.data as T;
}

async function selectByUser<T>(client: SupabaseClient, tableName: FinanceTableName, userId: string): Promise<T[]> {
    const data = await throwIfError<T[]>(await client.from(tableName).select("*").eq("user_id", userId));
    return data ?? [];
}

async function selectPreferences(client: SupabaseClient, userId: string): Promise<FinancePreferenceRow | null> {
    const result = await client.from(FINANCE_TABLES.preferences).select("*").eq("user_id", userId).maybeSingle();
    if (result.error) {
        throw result.error;
    }

    return (result.data as FinancePreferenceRow | null) ?? null;
}

async function upsertRows<T extends UserScopedRow>(client: SupabaseClient, tableName: FinanceTableName, rows: T[]): Promise<void> {
    if (rows.length === 0) {
        return;
    }

    await throwIfError(await client.from(tableName).upsert(rows));
}

async function listExistingIds(client: SupabaseClient, tableName: FinanceTableName, userId: string): Promise<string[]> {
    const rows = await throwIfError<Array<{ id: string }>>(await client.from(tableName).select("id").eq("user_id", userId));
    return rows?.map((row) => row.id) ?? [];
}

async function deleteRowsMissingFromSnapshot(client: SupabaseClient, tableName: FinanceTableName, userId: string, currentIds: string[]): Promise<void> {
    const existingIds = await listExistingIds(client, tableName, userId);
    const currentIdSet = new Set(currentIds);
    const staleIds = existingIds.filter((id) => !currentIdSet.has(id));

    if (staleIds.length === 0) {
        return;
    }

    await throwIfError(await client.from(tableName).delete().eq("user_id", userId).in("id", staleIds));
}

function readPlanning(value: unknown): PlanningState {
    return (typeof value === "object" && value !== null ? value : {}) as PlanningState;
}

export async function loadSupabaseFinanceData(userId: string, client = getSupabaseClient()): Promise<SupabaseFinanceData | null> {
    const [
        preferences,
        walletRows,
        creditCardRows,
        invoiceRows,
        beneficiaryRows,
        categoryRows,
        tagRows,
        wishItemRows,
        groupRows,
        transactionRows,
        ledgerEntryRows,
        transactionTagRows,
    ] = await Promise.all([
        selectPreferences(client, userId),
        selectByUser<WalletRow>(client, FINANCE_TABLES.wallets, userId),
        selectByUser<CreditCardRow>(client, FINANCE_TABLES.creditCards, userId),
        selectByUser<CreditCardInvoiceRow>(client, FINANCE_TABLES.creditCardInvoices, userId),
        selectByUser<BeneficiaryRow>(client, FINANCE_TABLES.beneficiaries, userId),
        selectByUser<CategoryRow>(client, FINANCE_TABLES.categories, userId),
        selectByUser<TagRow>(client, FINANCE_TABLES.tags, userId),
        selectByUser<WishItemRow>(client, FINANCE_TABLES.wishItems, userId),
        selectByUser<TransactionGroupRow>(client, FINANCE_TABLES.transactionGroups, userId),
        selectByUser<TransactionRow>(client, FINANCE_TABLES.transactions, userId),
        selectByUser<LedgerEntryRow>(client, FINANCE_TABLES.ledgerEntries, userId),
        selectByUser<TransactionTagRow>(client, FINANCE_TABLES.transactionTags, userId),
    ]);

    const hasFinanceRows =
        walletRows.length > 0 ||
        creditCardRows.length > 0 ||
        invoiceRows.length > 0 ||
        beneficiaryRows.length > 0 ||
        categoryRows.length > 0 ||
        tagRows.length > 0 ||
        wishItemRows.length > 0 ||
        groupRows.length > 0 ||
        transactionRows.length > 0 ||
        ledgerEntryRows.length > 0 ||
        transactionTagRows.length > 0;

    if (!preferences && !hasFinanceRows) {
        return null;
    }

    const snapshot = createFinanceSnapshot(
        walletRows.map(fromWalletRow),
        creditCardRows.map(fromCreditCardRow),
        invoiceRows.map(fromCreditCardInvoiceRow),
        preferences?.favorite_credit_card_id ?? null,
        groupRows.map(fromTransactionGroupRow),
        transactionRows.map(fromTransactionRow),
        ledgerEntryRows.map(fromLedgerEntryRow),
        beneficiaryRows.map(fromBeneficiaryRow),
        categoryRows.map(fromCategoryRow),
        tagRows.map(fromTagRow),
        wishItemRows.map(fromWishItemRow),
        transactionTagRows.map(fromTransactionTagRow),
        readPlanning(preferences?.planning),
    );

    return {
        ...snapshot,
        favoriteWalletId: preferences?.favorite_wallet_id ?? null,
    };
}

export async function saveSupabaseFinanceData(userId: string, financeData: SupabaseFinanceData, client = getSupabaseClient()): Promise<void> {
    await upsertRows(client, FINANCE_TABLES.preferences, [
        toPreferenceRow({
            userId,
            favoriteWalletId: financeData.favoriteWalletId,
            favoriteCreditCardId: financeData.favoriteCreditCardId,
            planning: financeData.planning,
        }),
    ]);

    await upsertRows(client, FINANCE_TABLES.wallets, financeData.wallets.map((wallet) => toWalletRow(userId, wallet)));
    await upsertRows(client, FINANCE_TABLES.creditCards, financeData.creditCards.map((card) => toCreditCardRow(userId, card)));
    await upsertRows(client, FINANCE_TABLES.beneficiaries, financeData.beneficiaries.map((beneficiary) => toBeneficiaryRow(userId, beneficiary)));
    await upsertRows(client, FINANCE_TABLES.categories, financeData.categories.map((category) => toCategoryRow(userId, category)));
    await upsertRows(client, FINANCE_TABLES.tags, financeData.tags.map((tag) => toTagRow(userId, tag)));
    await upsertRows(client, FINANCE_TABLES.wishItems, financeData.wishItems.map((wishItem) => toWishItemRow(userId, wishItem)));
    await upsertRows(client, FINANCE_TABLES.transactionGroups, financeData.transactionGroups.map((group) => toTransactionGroupRow(userId, group)));
    await upsertRows(client, FINANCE_TABLES.creditCardInvoices, financeData.creditCardInvoices.map((invoice) => toCreditCardInvoiceRow(userId, invoice)));
    await upsertRows(client, FINANCE_TABLES.transactions, financeData.transactions.map((transaction) => toTransactionRow(userId, transaction)));
    await upsertRows(client, FINANCE_TABLES.ledgerEntries, financeData.ledgerEntries.map((entry) => toLedgerEntryRow(userId, entry)));

    await throwIfError(await client.from(FINANCE_TABLES.transactionTags).delete().eq("user_id", userId));
    await upsertRows(client, FINANCE_TABLES.transactionTags, financeData.transactionTags.map((link) => toTransactionTagRow(userId, link)));

    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.ledgerEntries, userId, financeData.ledgerEntries.map((entry) => entry.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.transactions, userId, financeData.transactions.map((transaction) => transaction.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.creditCardInvoices, userId, financeData.creditCardInvoices.map((invoice) => invoice.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.transactionGroups, userId, financeData.transactionGroups.map((group) => group.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.wishItems, userId, financeData.wishItems.map((wishItem) => wishItem.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.tags, userId, financeData.tags.map((tag) => tag.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.categories, userId, financeData.categories.map((category) => category.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.beneficiaries, userId, financeData.beneficiaries.map((beneficiary) => beneficiary.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.creditCards, userId, financeData.creditCards.map((card) => card.id));
    await deleteRowsMissingFromSnapshot(client, FINANCE_TABLES.wallets, userId, financeData.wallets.map((wallet) => wallet.id));
}
