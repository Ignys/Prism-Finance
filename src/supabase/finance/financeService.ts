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
    type FinanceSyncStateRow,
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

export interface SupabaseFinanceLoadResult {
    data: SupabaseFinanceData | null;
    revision: number;
}

export interface SaveSupabaseFinanceDataParams {
    userId: string;
    financeData: SupabaseFinanceData;
    baseRevision: number;
    clientId: string;
}

export interface SupabaseFinanceSaveResult {
    revision: number;
}

type FinanceTableName = (typeof FINANCE_TABLES)[keyof typeof FINANCE_TABLES];

interface UserScopedRow {
    user_id: string;
}

export class FinanceRevisionConflictError extends Error {
    readonly currentRevision: number;

    constructor(currentRevision: number) {
        super("Os dados financeiros foram atualizados em outra aba ou dispositivo.");
        this.name = "FinanceRevisionConflictError";
        this.currentRevision = currentRevision;
    }
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

function readPlanning(value: unknown): PlanningState {
    return (typeof value === "object" && value !== null ? value : {}) as PlanningState;
}

function toRevision(value: number | string | null | undefined): number {
    const revision = Number(value);
    return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

async function selectFinanceRevision(client: SupabaseClient, userId: string): Promise<number> {
    const result = await client.from(FINANCE_TABLES.syncState).select("revision").eq("user_id", userId).maybeSingle();
    if (result.error) {
        throw result.error;
    }

    return toRevision((result.data as Pick<FinanceSyncStateRow, "revision"> | null)?.revision);
}

function buildFinanceSnapshotPayload(userId: string, financeData: SupabaseFinanceData): Record<string, unknown> {
    return {
        preferences: toPreferenceRow({
            userId,
            favoriteWalletId: financeData.favoriteWalletId,
            favoriteCreditCardId: financeData.favoriteCreditCardId,
            planning: financeData.planning,
        }),
        wallets: financeData.wallets.map((wallet) => toWalletRow(userId, wallet)),
        credit_cards: financeData.creditCards.map((card) => toCreditCardRow(userId, card)),
        beneficiaries: financeData.beneficiaries.map((beneficiary) => toBeneficiaryRow(userId, beneficiary)),
        categories: financeData.categories.map((category) => toCategoryRow(userId, category)),
        tags: financeData.tags.map((tag) => toTagRow(userId, tag)),
        wish_items: financeData.wishItems.map((wishItem) => toWishItemRow(userId, wishItem)),
        transaction_groups: financeData.transactionGroups.map((group) => toTransactionGroupRow(userId, group)),
        credit_card_invoices: financeData.creditCardInvoices.map((invoice) => toCreditCardInvoiceRow(userId, invoice)),
        transactions: financeData.transactions.map((transaction) => toTransactionRow(userId, transaction)),
        ledger_entries: financeData.ledgerEntries.map((entry) => toLedgerEntryRow(userId, entry)),
        transaction_tags: financeData.transactionTags.map((link) => toTransactionTagRow(userId, link)),
    };
}

function parseRevisionConflict(error: Error): FinanceRevisionConflictError | null {
    const message = error.message ?? "";
    const match = /FINANCE_REVISION_CONFLICT:(\d+)/.exec(message);
    if (!match) {
        return null;
    }

    return new FinanceRevisionConflictError(toRevision(match[1]));
}

export function isFinanceRevisionConflictError(error: unknown): error is FinanceRevisionConflictError {
    return error instanceof FinanceRevisionConflictError;
}

export async function loadSupabaseFinanceData(userId: string, client = getSupabaseClient()): Promise<SupabaseFinanceLoadResult> {
    const [
        revision,
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
        selectFinanceRevision(client, userId),
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
        return {
            data: null,
            revision,
        };
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
        data: {
            ...snapshot,
            favoriteWalletId: preferences?.favorite_wallet_id ?? null,
        },
        revision,
    };
}

export async function saveSupabaseFinanceData({ userId, financeData, baseRevision, clientId }: SaveSupabaseFinanceDataParams, client = getSupabaseClient()): Promise<SupabaseFinanceSaveResult> {
    const result = await client.rpc("save_finance_snapshot", {
        expected_revision: baseRevision,
        payload: buildFinanceSnapshotPayload(userId, financeData),
        client_id: clientId,
    });

    if (result.error) {
        throw parseRevisionConflict(result.error) ?? result.error;
    }

    return {
        revision: toRevision(result.data as number | string | null),
    };
}
