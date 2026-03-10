import type { Beneficiary, Category, TransactionDraft, TransactionGroup, Wallet } from "../financeTypes";
import { DEFAULT_WALLET_ID } from "../financeTypes";

export function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

export function createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function resolveGroupType(type: TransactionDraft["type"], signedValue: number): TransactionGroup["type"] {
    if (type === "income") {
        return "income";
    }
    if (type === "expense" || type === "spending") {
        return "expense";
    }
    if (type === "transfer") {
        return "transfer";
    }
    return signedValue < 0 ? "expense" : "income";
}

export function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

export function ensureWalletId(candidateWalletId: string, wallets: Wallet[]): string {
    if (wallets.some((wallet) => wallet.id === candidateWalletId)) {
        return candidateWalletId;
    }
    return DEFAULT_WALLET_ID;
}

export function toCategoryTypeFromGroupType(type: TransactionGroup["type"]): Category["type"] {
    return type === "income" ? "income" : "expense";
}

export function normalizeComparisonText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase();
}

export function findCategoryByName(categories: Category[], type: Category["type"], name: string, parentId: string | null): Category | null {
    const normalizedName = normalizeComparisonText(name);
    return categories.find((item) => item.type === type && item.parentId === parentId && normalizeComparisonText(item.name) === normalizedName) ?? null;
}

export function findBeneficiaryByName(beneficiaries: Beneficiary[], name: string): Beneficiary | null {
    const normalizedName = normalizeComparisonText(name);
    return beneficiaries.find((item) => normalizeComparisonText(item.name) === normalizedName) ?? null;
}
