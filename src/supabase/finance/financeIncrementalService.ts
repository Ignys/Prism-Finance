import { createFinanceSnapshot } from "../../context/financeTypes";
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
import type { FinanceTombstone, SupabaseFinanceData } from "./financeService";
import type {
    BeneficiaryRow,
    CategoryRow,
    CreditCardInvoiceRow,
    CreditCardRow,
    FinancePreferenceRow,
    LedgerEntryRow,
    TagRow,
    TransactionGroupRow,
    TransactionRow,
    TransactionTagRow,
    WalletRow,
    WishItemRow,
} from "./financeTables";

interface SupabaseFinanceRowChanges {
    preferences: FinancePreferenceRow | null;
    wallets: WalletRow[];
    credit_cards: CreditCardRow[];
    beneficiaries: BeneficiaryRow[];
    categories: CategoryRow[];
    tags: TagRow[];
    wish_items: WishItemRow[];
    transaction_groups: TransactionGroupRow[];
    credit_card_invoices: CreditCardInvoiceRow[];
    transactions: TransactionRow[];
    ledger_entries: LedgerEntryRow[];
    transaction_tags: TransactionTagRow[];
    tombstones: FinanceTombstone[];
}

export interface SupabaseFinanceChangesPage {
    from_revision: number;
    until_revision: number;
    current_revision: number;
    has_more: boolean;
    requires_full_reload: boolean;
    changes: SupabaseFinanceRowChanges;
}

export interface SupabaseIncrementalLoadResult {
    data: SupabaseFinanceData;
    revision: number;
    requiresFullReload: boolean;
}

function upsertByKey<T>(baseItems: T[], changedItems: T[], getKey: (item: T) => string): T[] {
    const changedByKey = new Map(changedItems.map((item) => [getKey(item), item]));
    const merged = baseItems.map((item) => changedByKey.get(getKey(item)) ?? item);
    const baseKeys = new Set(baseItems.map(getKey));
    changedItems.forEach((item) => {
        if (!baseKeys.has(getKey(item))) {
            merged.push(item);
        }
    });
    return merged;
}

function mergeCollection<T>(params: {
    baseItems: T[];
    changedItems: T[];
    tombstones: FinanceTombstone[];
    entityType: string;
    getKey: (item: T) => string;
}): T[] {
    const deletedKeys = new Set(
        params.tombstones
            .filter((tombstone) => tombstone.entity_type === params.entityType)
            .map((tombstone) =>
                params.entityType === "transaction_tag"
                    ? `${tombstone.entity_id}:${tombstone.related_id}`
                    : tombstone.entity_id,
            ),
    );

    return upsertByKey(params.baseItems, params.changedItems, params.getKey).filter(
        (item) => !deletedKeys.has(params.getKey(item)),
    );
}

function compareText(left: string, right: string): number {
    return left.localeCompare(right);
}

export function applySupabaseFinanceChangesPage(baseData: SupabaseFinanceData, page: SupabaseFinanceChangesPage): SupabaseFinanceData {
    const { changes } = page;
    const getId = <T extends { id: string }>(item: T) => item.id;
    const wallets = mergeCollection({ baseItems: baseData.wallets, changedItems: changes.wallets.map(fromWalletRow), tombstones: changes.tombstones, entityType: "wallet", getKey: getId });
    const creditCards = mergeCollection({ baseItems: baseData.creditCards, changedItems: changes.credit_cards.map(fromCreditCardRow), tombstones: changes.tombstones, entityType: "credit_card", getKey: getId });
    const invoices = mergeCollection({ baseItems: baseData.creditCardInvoices, changedItems: changes.credit_card_invoices.map(fromCreditCardInvoiceRow), tombstones: changes.tombstones, entityType: "credit_card_invoice", getKey: getId });
    const groups = mergeCollection({ baseItems: baseData.transactionGroups, changedItems: changes.transaction_groups.map(fromTransactionGroupRow), tombstones: changes.tombstones, entityType: "transaction_group", getKey: getId });
    const transactions = mergeCollection({ baseItems: baseData.transactions, changedItems: changes.transactions.map(fromTransactionRow), tombstones: changes.tombstones, entityType: "transaction", getKey: getId });
    const ledgerEntries = mergeCollection({ baseItems: baseData.ledgerEntries, changedItems: changes.ledger_entries.map(fromLedgerEntryRow), tombstones: changes.tombstones, entityType: "ledger_entry", getKey: getId });
    const beneficiaries = mergeCollection({ baseItems: baseData.beneficiaries, changedItems: changes.beneficiaries.map(fromBeneficiaryRow), tombstones: changes.tombstones, entityType: "beneficiary", getKey: getId });
    const categories = mergeCollection({ baseItems: baseData.categories, changedItems: changes.categories.map(fromCategoryRow), tombstones: changes.tombstones, entityType: "category", getKey: getId });
    const tags = mergeCollection({ baseItems: baseData.tags, changedItems: changes.tags.map(fromTagRow), tombstones: changes.tombstones, entityType: "tag", getKey: getId });
    const wishItems = mergeCollection({ baseItems: baseData.wishItems, changedItems: changes.wish_items.map(fromWishItemRow), tombstones: changes.tombstones, entityType: "wish_item", getKey: getId });
    const transactionTags = mergeCollection({
        baseItems: baseData.transactionTags,
        changedItems: changes.transaction_tags.map(fromTransactionTagRow),
        tombstones: changes.tombstones,
        entityType: "transaction_tag",
        getKey: (item) => `${item.transactionId}:${item.tagId}`,
    });
    wallets.sort((left, right) => compareText(left.id, right.id));
    creditCards.sort((left, right) => compareText(left.id, right.id));
    invoices.sort((left, right) => compareText(left.dueDate, right.dueDate) || compareText(left.id, right.id));
    beneficiaries.sort((left, right) => left.sortOrder - right.sortOrder || compareText(left.id, right.id));
    categories.sort((left, right) => left.sortOrder - right.sortOrder || compareText(left.id, right.id));
    tags.sort((left, right) => left.sortOrder - right.sortOrder || compareText(left.id, right.id));
    wishItems.sort((left, right) => compareText(left.createdAt, right.createdAt) || compareText(left.id, right.id));
    groups.sort((left, right) => compareText(left.createdAt, right.createdAt) || compareText(left.id, right.id));
    transactions.sort((left, right) => compareText(left.scheduledDate, right.scheduledDate) || compareText(left.id, right.id));
    ledgerEntries.sort((left, right) => compareText(left.createdAt, right.createdAt) || compareText(left.id, right.id));
    transactionTags.sort(
        (left, right) => compareText(left.transactionId, right.transactionId) || compareText(left.tagId, right.tagId),
    );
    const preferences = changes.preferences;
    const snapshot = createFinanceSnapshot(
        wallets,
        creditCards,
        invoices,
        preferences ? preferences.favorite_credit_card_id : baseData.favoriteCreditCardId,
        groups,
        transactions,
        ledgerEntries,
        beneficiaries,
        categories,
        tags,
        wishItems,
        transactionTags,
        (preferences?.planning as typeof baseData.planning | undefined) ?? baseData.planning,
    );

    return {
        ...snapshot,
        favoriteWalletId: preferences ? preferences.favorite_wallet_id : baseData.favoriteWalletId,
    };
}

export async function loadSupabaseFinanceChanges(sinceRevision: number, revisionLimit = 50): Promise<SupabaseFinanceChangesPage> {
    const result = await getSupabaseClient().rpc("load_finance_changes", {
        since_revision: sinceRevision,
        revision_limit: revisionLimit,
    });
    if (result.error) {
        throw result.error;
    }

    return result.data as SupabaseFinanceChangesPage;
}

export async function loadSupabaseFinanceIncrementally(
    baseData: SupabaseFinanceData,
    sinceRevision: number,
): Promise<SupabaseIncrementalLoadResult> {
    let data = baseData;
    let revision = sinceRevision;

    for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
        const page = await loadSupabaseFinanceChanges(revision);
        if (page.requires_full_reload) {
            return { data: baseData, revision: sinceRevision, requiresFullReload: true };
        }

        data = applySupabaseFinanceChangesPage(data, page);
        revision = page.until_revision;
        if (!page.has_more) {
            return { data, revision, requiresFullReload: false };
        }
    }

    return { data: baseData, revision: sinceRevision, requiresFullReload: true };
}
