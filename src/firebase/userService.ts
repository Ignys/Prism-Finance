import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

interface UserFieldUpdate {
    [key: string]: unknown;
}

interface UserDocumentData {
    finance?: unknown;
    [key: string]: unknown;
}

const FINANCE_KEYS = [
    "wallets",
    "creditCards",
    "creditCardInvoices",
    "favoriteCreditCardId",
    "transactionGroups",
    "transactions",
    "ledgerEntries",
    "beneficiaries",
    "categories",
    "tags",
    "transactionTags",
    "favoriteWalletId",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function buildNestedMergePayload(fieldName: string, value: unknown): UserFieldUpdate {
    const segments = fieldName
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
        return {};
    }

    let payload: unknown = value;
    for (let index = segments.length - 1; index >= 0; index -= 1) {
        payload = { [segments[index]]: payload };
    }

    return payload as UserFieldUpdate;
}

function buildFinancePayload(fields: FinanceFieldsUpdate): UserFieldUpdate {
    const financePayload: UserFieldUpdate = {};

    if (fields.wallets !== undefined) {
        financePayload.wallets = fields.wallets;
    }

    if (fields.creditCards !== undefined) {
        financePayload.creditCards = fields.creditCards;
    }

    if (fields.creditCardInvoices !== undefined) {
        financePayload.creditCardInvoices = fields.creditCardInvoices;
    }

    if (fields.favoriteCreditCardId !== undefined) {
        financePayload.favoriteCreditCardId = fields.favoriteCreditCardId;
    }

    if (fields.transactionGroups !== undefined) {
        financePayload.transactionGroups = fields.transactionGroups;
    }

    if (fields.transactions !== undefined) {
        financePayload.transactions = fields.transactions;
    }

    if (fields.ledgerEntries !== undefined) {
        financePayload.ledgerEntries = fields.ledgerEntries;
    }

    if (fields.beneficiaries !== undefined) {
        financePayload.beneficiaries = fields.beneficiaries;
    }

    if (fields.categories !== undefined) {
        financePayload.categories = fields.categories;
    }

    if (fields.tags !== undefined) {
        financePayload.tags = fields.tags;
    }

    if (fields.transactionTags !== undefined) {
        financePayload.transactionTags = fields.transactionTags;
    }

    if (fields.favoriteWalletId !== undefined) {
        financePayload.favoriteWalletId = fields.favoriteWalletId;
    }

    return financePayload;
}

interface ReadFinanceResult {
    finance: unknown;
    hasLegacyDotFields: boolean;
}

export function readFinanceFromUserData(userData: unknown): ReadFinanceResult {
    if (!isRecord(userData)) {
        return {
            finance: null,
            hasLegacyDotFields: false,
        };
    }

    const nestedFinance = isRecord(userData.finance) ? userData.finance : null;
    const legacyFinance: UserFieldUpdate = {};
    let hasLegacyDotFields = false;

    FINANCE_KEYS.forEach((key) => {
        const legacyKey = `finance.${key}`;
        if (Object.prototype.hasOwnProperty.call(userData, legacyKey)) {
            legacyFinance[key] = (userData as UserDocumentData)[legacyKey];
            hasLegacyDotFields = true;
        }
    });

    if (nestedFinance && hasLegacyDotFields) {
        return {
            finance: {
                ...legacyFinance,
                ...nestedFinance,
            },
            hasLegacyDotFields: true,
        };
    }

    if (nestedFinance) {
        return {
            finance: nestedFinance,
            hasLegacyDotFields: false,
        };
    }

    return {
        finance: hasLegacyDotFields ? legacyFinance : null,
        hasLegacyDotFields,
    };
}

export async function setUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
    const payload = buildNestedMergePayload(fieldName, value);
    if (Object.keys(payload).length === 0) {
        return;
    }

    const ref = doc(db, "users", uid);
    await setDoc(ref, payload, { merge: true });
}

export async function updateUserField(uid: string, fieldName: string, value: unknown): Promise<void> {
    if (!fieldName.trim()) {
        return;
    }

    const ref = doc(db, "users", uid);
    await updateDoc(ref, { [fieldName]: value });
}

interface FinanceFieldsUpdate {
    wallets?: unknown[];
    creditCards?: unknown[];
    creditCardInvoices?: unknown[];
    transactionGroups?: unknown[];
    transactions?: unknown[];
    ledgerEntries?: unknown[];
    beneficiaries?: unknown[];
    categories?: unknown[];
    tags?: unknown[];
    transactionTags?: unknown[];
    favoriteWalletId?: string;
    favoriteCreditCardId?: string | null;
}

export async function mergeFinanceFields(uid: string, fields: FinanceFieldsUpdate): Promise<void> {
    const financePayload = buildFinancePayload(fields);
    if (Object.keys(financePayload).length === 0) {
        return;
    }

    const ref = doc(db, "users", uid);
    await setDoc(ref, { finance: financePayload }, { merge: true });
}
