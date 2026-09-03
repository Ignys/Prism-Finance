import type { SupabaseFinanceData } from "../../supabase/finance";

function stableStringify(value: unknown): string {
    return JSON.stringify(value);
}

function isSameValue<T>(a: T | undefined, b: T | undefined): boolean {
    return stableStringify(a ?? null) === stableStringify(b ?? null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValue<T>(baseValue: T, remoteValue: T, targetValue: T): T {
    if (isSameValue(baseValue, targetValue)) {
        return remoteValue;
    }
    if (isSameValue(baseValue, remoteValue) || isSameValue(remoteValue, targetValue)) {
        return targetValue;
    }
    if (isRecord(baseValue) && isRecord(remoteValue) && isRecord(targetValue)) {
        const merged: Record<string, unknown> = {};
        const keys = new Set([...Object.keys(baseValue), ...Object.keys(remoteValue), ...Object.keys(targetValue)]);
        keys.forEach((key) => {
            merged[key] = mergeValue(baseValue[key], remoteValue[key], targetValue[key]);
        });
        return merged as T;
    }

    // Simultaneous edits to the same scalar remain local. The retry still goes
    // through CAS and server-side invariants before becoming canonical.
    return targetValue;
}

function mergeByKey<T>(params: {
    baseItems: T[];
    remoteItems: T[];
    targetItems: T[];
    getKey: (item: T) => string;
}): T[] {
    const baseByKey = new Map(params.baseItems.map((item) => [params.getKey(item), item]));
    const remoteByKey = new Map(params.remoteItems.map((item) => [params.getKey(item), item]));
    const targetByKey = new Map(params.targetItems.map((item) => [params.getKey(item), item]));
    const orderedKeys = new Set<string>();

    params.remoteItems.forEach((item) => orderedKeys.add(params.getKey(item)));
    params.targetItems.forEach((item) => orderedKeys.add(params.getKey(item)));
    params.baseItems.forEach((item) => orderedKeys.add(params.getKey(item)));

    const mergedItems: T[] = [];
    orderedKeys.forEach((key) => {
        const baseItem = baseByKey.get(key);
        const remoteItem = remoteByKey.get(key);
        const targetItem = targetByKey.get(key);
        const existedInBase = baseByKey.has(key);
        const existsInTarget = targetByKey.has(key);
        const wasLocallyChanged = existsInTarget ? !isSameValue(baseItem, targetItem) : existedInBase;

        // A confirmed remote deletion is authoritative. This prevents a stale
        // device from resurrecting an entity after a revision conflict.
        if (existedInBase && !remoteItem) {
            return;
        }

        if (!existsInTarget && existedInBase) {
            return;
        }

        if (wasLocallyChanged && targetItem) {
            mergedItems.push(baseItem && remoteItem ? mergeValue(baseItem, remoteItem, targetItem) : targetItem);
            return;
        }

        if (remoteItem) {
            mergedItems.push(remoteItem);
            return;
        }

        if (targetItem) {
            mergedItems.push(targetItem);
        }
    });

    return mergedItems;
}

function getId<T extends { id: string }>(item: T): string {
    return item.id;
}

function getTransactionTagKey(item: { transactionId: string; tagId: string }): string {
    return `${item.transactionId}:${item.tagId}`;
}

export function mergeSupabaseFinanceData(params: {
    baseData: SupabaseFinanceData;
    remoteData: SupabaseFinanceData;
    targetData: SupabaseFinanceData;
}): SupabaseFinanceData {
    const { baseData, remoteData, targetData } = params;

    return {
        despesas: mergeValue(baseData.despesas, remoteData.despesas, targetData.despesas),
        receitas: mergeValue(baseData.receitas, remoteData.receitas, targetData.receitas),
        wallets: mergeByKey({ baseItems: baseData.wallets, remoteItems: remoteData.wallets, targetItems: targetData.wallets, getKey: getId }),
        creditCards: mergeByKey({ baseItems: baseData.creditCards, remoteItems: remoteData.creditCards, targetItems: targetData.creditCards, getKey: getId }),
        creditCardInvoices: mergeByKey({ baseItems: baseData.creditCardInvoices, remoteItems: remoteData.creditCardInvoices, targetItems: targetData.creditCardInvoices, getKey: getId }),
        favoriteCreditCardId: mergeValue(baseData.favoriteCreditCardId, remoteData.favoriteCreditCardId, targetData.favoriteCreditCardId),
        transactionGroups: mergeByKey({ baseItems: baseData.transactionGroups, remoteItems: remoteData.transactionGroups, targetItems: targetData.transactionGroups, getKey: getId }),
        transactions: mergeByKey({ baseItems: baseData.transactions, remoteItems: remoteData.transactions, targetItems: targetData.transactions, getKey: getId }),
        ledgerEntries: mergeByKey({ baseItems: baseData.ledgerEntries, remoteItems: remoteData.ledgerEntries, targetItems: targetData.ledgerEntries, getKey: getId }),
        beneficiaries: mergeByKey({ baseItems: baseData.beneficiaries, remoteItems: remoteData.beneficiaries, targetItems: targetData.beneficiaries, getKey: getId }),
        categories: mergeByKey({ baseItems: baseData.categories, remoteItems: remoteData.categories, targetItems: targetData.categories, getKey: getId }),
        tags: mergeByKey({ baseItems: baseData.tags, remoteItems: remoteData.tags, targetItems: targetData.tags, getKey: getId }),
        wishItems: mergeByKey({ baseItems: baseData.wishItems, remoteItems: remoteData.wishItems, targetItems: targetData.wishItems, getKey: getId }),
        transactionTags: mergeByKey({ baseItems: baseData.transactionTags, remoteItems: remoteData.transactionTags, targetItems: targetData.transactionTags, getKey: getTransactionTagKey }),
        planning: mergeValue(baseData.planning, remoteData.planning, targetData.planning),
        favoriteWalletId: mergeValue(baseData.favoriteWalletId, remoteData.favoriteWalletId, targetData.favoriteWalletId),
    };
}
