import type { SupabaseFinanceData } from "./financeService";
import {
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

export type FinanceEntityType =
    | "wallet"
    | "credit_card"
    | "beneficiary"
    | "category"
    | "tag"
    | "wish_item"
    | "transaction_group"
    | "credit_card_invoice"
    | "transaction"
    | "ledger_entry"
    | "transaction_tag";

export interface FinanceDeleteMutation {
    entity_type: FinanceEntityType;
    entity_id: string;
    related_id?: string;
}

export interface FinanceChangesPayload {
    protocol_version: 2;
    preferences: Record<string, unknown>;
    upserts: Record<string, unknown[]>;
    deletes: FinanceDeleteMutation[];
}

interface EntityConfig<T> {
    payloadKey: string;
    entityType: FinanceEntityType;
    baseItems: T[];
    targetItems: T[];
    getKey: (item: T) => string;
    toRow: (item: T) => unknown;
    toDelete?: (item: T) => Omit<FinanceDeleteMutation, "entity_type">;
    includeUpserts?: boolean;
    includeDeletes?: boolean;
}

function isSameValue(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function collectEntityChanges<T>(config: EntityConfig<T>, upserts: Record<string, unknown[]>, deletes: FinanceDeleteMutation[]): void {
    const baseByKey = new Map(config.baseItems.map((item) => [config.getKey(item), item]));
    const targetByKey = new Map(config.targetItems.map((item) => [config.getKey(item), item]));

    upserts[config.payloadKey] = config.includeUpserts === false
        ? []
        : config.targetItems
              .filter((item) => {
                  const baseItem = baseByKey.get(config.getKey(item));
                  return !baseItem || !isSameValue(baseItem, item);
              })
              .map(config.toRow);

    if (config.includeDeletes === false) {
        return;
    }

    config.baseItems.forEach((item) => {
        const key = config.getKey(item);
        if (targetByKey.has(key)) {
            return;
        }

        deletes.push({
            entity_type: config.entityType,
            ...(config.toDelete?.(item) ?? { entity_id: key }),
        });
    });
}

export function buildFinanceChangesPayload(userId: string, baseData: SupabaseFinanceData, targetData: SupabaseFinanceData): FinanceChangesPayload {
    const upserts: Record<string, unknown[]> = {};
    const deletes: FinanceDeleteMutation[] = [];
    const getId = <T extends { id: string }>(item: T) => item.id;

    collectEntityChanges({ payloadKey: "wallets", entityType: "wallet", baseItems: baseData.wallets, targetItems: targetData.wallets, getKey: getId, toRow: (item) => toWalletRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "credit_cards", entityType: "credit_card", baseItems: baseData.creditCards, targetItems: targetData.creditCards, getKey: getId, toRow: (item) => toCreditCardRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "beneficiaries", entityType: "beneficiary", baseItems: baseData.beneficiaries, targetItems: targetData.beneficiaries, getKey: getId, toRow: (item) => toBeneficiaryRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "categories", entityType: "category", baseItems: baseData.categories, targetItems: targetData.categories, getKey: getId, toRow: (item) => toCategoryRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "tags", entityType: "tag", baseItems: baseData.tags, targetItems: targetData.tags, getKey: getId, toRow: (item) => toTagRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "wish_items", entityType: "wish_item", baseItems: baseData.wishItems, targetItems: targetData.wishItems, getKey: getId, toRow: (item) => toWishItemRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "transaction_groups", entityType: "transaction_group", baseItems: baseData.transactionGroups, targetItems: targetData.transactionGroups, getKey: getId, toRow: (item) => toTransactionGroupRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "credit_card_invoices", entityType: "credit_card_invoice", baseItems: baseData.creditCardInvoices, targetItems: targetData.creditCardInvoices, getKey: getId, toRow: (item) => toCreditCardInvoiceRow(userId, item) }, upserts, deletes);
    collectEntityChanges({ payloadKey: "transactions", entityType: "transaction", baseItems: baseData.transactions, targetItems: targetData.transactions, getKey: getId, toRow: (item) => toTransactionRow(userId, item) }, upserts, deletes);
    collectEntityChanges({
        payloadKey: "ledger_entries",
        entityType: "ledger_entry",
        baseItems: baseData.ledgerEntries,
        targetItems: targetData.ledgerEntries,
        getKey: getId,
        toRow: (item) => toLedgerEntryRow(userId, item),
        includeUpserts: false,
        includeDeletes: false,
    }, upserts, deletes);
    collectEntityChanges({
        payloadKey: "transaction_tags",
        entityType: "transaction_tag",
        baseItems: baseData.transactionTags,
        targetItems: targetData.transactionTags,
        getKey: (item) => `${item.transactionId}:${item.tagId}`,
        toRow: (item) => toTransactionTagRow(userId, item),
        toDelete: (item) => ({ entity_id: item.transactionId, related_id: item.tagId }),
    }, upserts, deletes);

    return {
        protocol_version: 2,
        // Preferences are tiny and also mark a brand-new account as initialized.
        preferences: toPreferenceRow({
            userId,
            favoriteWalletId: targetData.favoriteWalletId,
            favoriteCreditCardId: targetData.favoriteCreditCardId,
            planning: targetData.planning,
        }) as unknown as Record<string, unknown>,
        upserts,
        deletes,
    };
}
