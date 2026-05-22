import type { Beneficiary, Category, TransactionDraft, TransactionGroup, Wallet } from "../financeTypes";
import { DEFAULT_BENEFICIARY_ID, DEFAULT_WALLET_ID, SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID } from "../financeTypes";
import { getLocalTodayDate } from "../../lib/localDate";

export function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

export function splitAmountAcrossInstallments(amount: number, installmentCount: number): number[] {
    const safeCount = Math.max(2, Math.floor(installmentCount));
    const cents = Math.round(Math.abs(amount) * 100);
    const base = Math.floor(cents / safeCount);
    const remainder = cents - base * safeCount;

    const parts: number[] = [];
    for (let index = 0; index < safeCount; index += 1) {
        const partCents = base + (index < remainder ? 1 : 0);
        parts.push(roundToCents(partCents / 100));
    }
    return parts;
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
    return getLocalTodayDate();
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

export function findCurrentUserSelfBeneficiary(beneficiaries: Beneficiary[], userId: string | null | undefined): Beneficiary | null {
    const normalizedUserId = userId?.trim() ?? "";
    if (normalizedUserId) {
        const matchedByMetadata =
            beneficiaries.find((item) => item.source === "personal" && item.isSelfProfile && item.userId === normalizedUserId) ??
            beneficiaries.find((item) => item.isSelfProfile && item.userId === normalizedUserId);
        if (matchedByMetadata) {
            return matchedByMetadata;
        }
    }

    return beneficiaries.find((item) => item.id === DEFAULT_BENEFICIARY_ID) ?? findBeneficiaryByName(beneficiaries, "eu");
}

export function isInvoicePaymentCategoryId(categoryId: string | null | undefined): boolean {
    return categoryId === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID;
}
