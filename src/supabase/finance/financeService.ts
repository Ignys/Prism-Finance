import { createFinanceSnapshot, DEFAULT_PLANNING_STATE, type FinanceSnapshot, type PlanningState } from "../../context/financeTypes";
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
} from "./financeRowMappers";
import {
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
import { buildFinanceChangesPayload } from "./financeChanges";
import { drainAttachmentDeletionQueue } from "./attachmentCleanupService";
import {
    applySupabaseFinanceChangesPage,
    type SupabaseFinanceChangesPage,
} from "./financeIncrementalService";

export interface SupabaseFinanceData extends FinanceSnapshot {
    favoriteWalletId: string | null;
}

export interface SupabaseFinanceLoadResult {
    data: SupabaseFinanceData | null;
    revision: number;
    tombstones: FinanceTombstone[];
}

export interface FinanceTombstone {
    entity_type: string;
    entity_id: string;
    related_id: string;
    version: number | string;
    deleted_at: string;
    deleted_by: string | null;
}

export interface SaveSupabaseFinanceDataParams {
    userId: string;
    financeData: SupabaseFinanceData;
    baseData: SupabaseFinanceData;
    baseRevision: number;
    clientId: string;
}

export interface SupabaseFinanceSaveResult {
    revision: number;
    data: SupabaseFinanceData;
}

export function createEmptySupabaseFinanceData(): SupabaseFinanceData {
    return {
        ...createFinanceSnapshot([], [], [], null, [], [], [], [], [], [], [], [], DEFAULT_PLANNING_STATE),
        favoriteWalletId: null,
    };
}

export class FinanceRevisionConflictError extends Error {
    readonly currentRevision: number;

    constructor(currentRevision: number) {
        super("Os dados financeiros foram atualizados em outra aba ou dispositivo.");
        this.name = "FinanceRevisionConflictError";
        this.currentRevision = currentRevision;
    }
}

function readPlanning(value: unknown): PlanningState {
    return (typeof value === "object" && value !== null ? value : {}) as PlanningState;
}

function toRevision(value: number | string | null | undefined): number {
    const revision = Number(value);
    return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

interface AtomicFinanceSnapshotRow {
    error?: string;
    revision?: number | string;
    tombstones?: FinanceTombstone[];
    data?: {
        preferences?: FinancePreferenceRow | null;
        wallets?: WalletRow[];
        credit_cards?: CreditCardRow[];
        credit_card_invoices?: CreditCardInvoiceRow[];
        beneficiaries?: BeneficiaryRow[];
        categories?: CategoryRow[];
        tags?: TagRow[];
        wish_items?: WishItemRow[];
        transaction_groups?: TransactionGroupRow[];
        transactions?: TransactionRow[];
        ledger_entries?: LedgerEntryRow[];
        transaction_tags?: TransactionTagRow[];
    } | null;
}

interface ApplyFinanceChangesResult {
    revision?: number | string;
    snapshot?: AtomicFinanceSnapshotRow;
    changes?: SupabaseFinanceChangesPage;
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

function fromAtomicFinanceSnapshot(atomicSnapshot: AtomicFinanceSnapshotRow): SupabaseFinanceLoadResult {
    if (atomicSnapshot.error) {
        throw new Error(atomicSnapshot.error);
    }
    const revision = toRevision(atomicSnapshot.revision);
    const rows = atomicSnapshot.data;
    const preferences = rows?.preferences ?? null;
    const walletRows = rows?.wallets ?? [];
    const creditCardRows = rows?.credit_cards ?? [];
    const invoiceRows = rows?.credit_card_invoices ?? [];
    const beneficiaryRows = rows?.beneficiaries ?? [];
    const categoryRows = rows?.categories ?? [];
    const tagRows = rows?.tags ?? [];
    const wishItemRows = rows?.wish_items ?? [];
    const groupRows = rows?.transaction_groups ?? [];
    const transactionRows = rows?.transactions ?? [];
    const ledgerEntryRows = rows?.ledger_entries ?? [];
    const transactionTagRows = rows?.transaction_tags ?? [];

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
            tombstones: atomicSnapshot.tombstones ?? [],
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
        tombstones: atomicSnapshot.tombstones ?? [],
    };
}

export async function loadSupabaseFinanceData(userId: string, client = getSupabaseClient()): Promise<SupabaseFinanceLoadResult> {
    void userId;
    const result = await client.rpc("load_finance_snapshot");
    if (result.error) {
        throw result.error;
    }

    return fromAtomicFinanceSnapshot((result.data ?? {}) as AtomicFinanceSnapshotRow);
}

export async function saveSupabaseFinanceData({ userId, financeData, baseData, baseRevision, clientId }: SaveSupabaseFinanceDataParams, client = getSupabaseClient()): Promise<SupabaseFinanceSaveResult> {
    const result = await client.rpc("apply_finance_changes", {
        expected_revision: baseRevision,
        changes: buildFinanceChangesPayload(userId, baseData, financeData),
        client_id: clientId,
    });

    if (result.error) {
        throw parseRevisionConflict(result.error) ?? result.error;
    }

    const commit = (result.data ?? {}) as ApplyFinanceChangesResult;
    const committedRevision = toRevision(commit.revision);
    let canonicalData: SupabaseFinanceData;

    if (commit.changes) {
        const changeRevision = toRevision(commit.changes.until_revision);
        if (commit.changes.requires_full_reload || changeRevision !== committedRevision) {
            const fallback = await loadSupabaseFinanceData(userId, client);
            if (!fallback.data || fallback.revision < committedRevision) {
                throw new Error("FINANCE_COMMIT_RESPONSE_INVALID");
            }
            canonicalData = fallback.data;
        } else {
            canonicalData = applySupabaseFinanceChangesPage(financeData, commit.changes);
        }
    } else if (commit.snapshot) {
        // Compatibility with database revisions prior to migration 015.
        const canonical = fromAtomicFinanceSnapshot(commit.snapshot);
        if (!canonical.data) {
            throw new Error("FINANCE_COMMIT_SNAPSHOT_MISSING");
        }
        if (committedRevision !== canonical.revision) {
            throw new Error("FINANCE_COMMIT_REVISION_MISMATCH");
        }
        canonicalData = canonical.data;
    } else {
        throw new Error("FINANCE_COMMIT_RESPONSE_INVALID");
    }

    try {
        await drainAttachmentDeletionQueue(client);
    } catch (error) {
        // The durable queue keeps the path for the next successful sync.
        console.error("Failed to drain attachment deletion queue:", error);
    }

    return {
        revision: committedRevision,
        data: canonicalData,
    };
}
