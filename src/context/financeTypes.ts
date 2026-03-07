export type TransactionType = "income" | "spending";

export interface Transaction {
    id: string;
    type: TransactionType;
    value: number;
    date: string;
    inWallet: string;
    category: {
        principal: string;
        sub: string | null;
    };
    beneficiary: string;
    description: string;
    status: boolean;
    meta: {
        criado_em: string;
        atualizado_em: string | null;
        observacoes?: unknown[];
    };
}

export interface Wallet {
    id: string;
    name: string;
    icon: string;
    balance: number;
    startBalance: number;
}

export interface FinanceSnapshot {
    despesas: number;
    receitas: number;
    transactions: Transaction[];
    wallets: Wallet[];
}

interface NormalizeFinanceResult {
    snapshot: FinanceSnapshot;
    changed: boolean;
}

export const DEFAULT_WALLET_ID = "default";
const LEGACY_DEFAULT_WALLET_ID = "first_wallet";

export const DEFAULT_WALLET: Wallet = {
    id: DEFAULT_WALLET_ID,
    name: "Carteira Principal",
    icon: "/assets/Nubank.png",
    balance: 0,
    startBalance: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function inferTransactionType(type: unknown, signedValue: number): TransactionType {
    if (type === "income" || type === "spending") {
        return type;
    }
    return signedValue < 0 ? "spending" : "income";
}

function asWalletId(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (isRecord(value) && typeof value.id === "string") {
        return value.id;
    }
    return DEFAULT_WALLET_ID;
}

export function normalizeWalletId(walletId: string): string {
    if (walletId === LEGACY_DEFAULT_WALLET_ID) {
        return DEFAULT_WALLET_ID;
    }
    return walletId || DEFAULT_WALLET_ID;
}

export function normalizeWallet(wallet: Wallet): Wallet {
    const id = normalizeWalletId(wallet.id);
    const startBalance = roundToCents(asNumber(wallet.startBalance, 0));
    const balance = roundToCents(asNumber(wallet.balance, startBalance));

    return {
        id,
        name: asString(wallet.name, id === DEFAULT_WALLET_ID ? DEFAULT_WALLET.name : "Carteira"),
        icon: asString(wallet.icon, DEFAULT_WALLET.icon),
        balance,
        startBalance,
    };
}

export function normalizeTransaction(transaction: Transaction): Transaction {
    const signedValue = asNumber(transaction.value, 0);
    const type = inferTransactionType(transaction.type, signedValue);
    const value = roundToCents(Math.abs(signedValue));

    return {
        id: asString(transaction.id, `${Date.now()}`),
        type,
        value,
        date: asString(transaction.date, new Date().toISOString().split("T")[0]),
        inWallet: normalizeWalletId(asWalletId(transaction.inWallet)),
        category: {
            principal: asString(transaction.category?.principal, "Sem categoria"),
            sub: typeof transaction.category?.sub === "string" && transaction.category.sub.trim() ? transaction.category.sub : null,
        },
        beneficiary: asString(transaction.beneficiary, "Eu"),
        description: typeof transaction.description === "string" ? transaction.description : "",
        status: Boolean(transaction.status),
        meta: {
            criado_em: asString(transaction.meta?.criado_em, new Date().toISOString()),
            atualizado_em: typeof transaction.meta?.atualizado_em === "string" ? transaction.meta.atualizado_em : null,
            observacoes: Array.isArray(transaction.meta?.observacoes) ? transaction.meta.observacoes : undefined,
        },
    };
}

export function getSignedTransactionValue(transaction: Transaction): number {
    const absoluteValue = Math.abs(transaction.value);
    return transaction.type === "income" ? absoluteValue : -absoluteValue;
}

export function calculateFinanceSummary(transactions: Transaction[]): Pick<FinanceSnapshot, "despesas" | "receitas"> {
    return transactions.reduce(
        (acc, transaction) => {
            const absoluteValue = Math.abs(transaction.value);
            if (transaction.type === "income") {
                acc.receitas += absoluteValue;
            } else {
                acc.despesas += absoluteValue;
            }
            return acc;
        },
        { despesas: 0, receitas: 0 },
    );
}

export function calculateTotalBalance(wallets: Wallet[]): number {
    return wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
}

export function createFinanceSnapshot(wallets: Wallet[], transactions: Transaction[]): FinanceSnapshot {
    const summary = calculateFinanceSummary(transactions);
    return {
        despesas: roundToCents(summary.despesas),
        receitas: roundToCents(summary.receitas),
        wallets,
        transactions,
    };
}

export function normalizeFinanceSnapshot(rawFinance: unknown): NormalizeFinanceResult {
    let changed = false;
    const financeRecord = isRecord(rawFinance) ? rawFinance : {};
    if (!isRecord(rawFinance)) {
        changed = true;
    }

    const walletsRaw = Array.isArray(financeRecord.wallets) ? financeRecord.wallets : [];
    if (!Array.isArray(financeRecord.wallets)) {
        changed = true;
    }

    const walletsById = new Map<string, Wallet>();
    for (const rawWallet of walletsRaw) {
        if (!isRecord(rawWallet) || typeof rawWallet.id !== "string") {
            changed = true;
            continue;
        }

        const normalizedWallet = normalizeWallet({
            id: rawWallet.id,
            name: asString(rawWallet.name, "Carteira"),
            icon: asString(rawWallet.icon, DEFAULT_WALLET.icon),
            balance: asNumber(rawWallet.balance, asNumber(rawWallet.startBalance, 0)),
            startBalance: asNumber(rawWallet.startBalance, 0),
        });

        if (normalizedWallet.id !== rawWallet.id) {
            changed = true;
        }
        if (walletsById.has(normalizedWallet.id)) {
            changed = true;
            continue;
        }

        walletsById.set(normalizedWallet.id, normalizedWallet);
    }

    if (!walletsById.has(DEFAULT_WALLET_ID)) {
        walletsById.set(DEFAULT_WALLET_ID, DEFAULT_WALLET);
        changed = true;
    }

    const normalizedWallets = Array.from(walletsById.values()).sort((a, b) => {
        if (a.id === DEFAULT_WALLET_ID) {
            return -1;
        }
        if (b.id === DEFAULT_WALLET_ID) {
            return 1;
        }
        return 0;
    });

    const transactionsRaw = Array.isArray(financeRecord.transactions) ? financeRecord.transactions : [];
    if (!Array.isArray(financeRecord.transactions)) {
        changed = true;
    }

    const normalizedTransactions: Transaction[] = [];
    transactionsRaw.forEach((rawTransaction, index) => {
        if (!isRecord(rawTransaction)) {
            changed = true;
            return;
        }

        const signedValue = asNumber(rawTransaction.value, 0);
        const walletId = normalizeWalletId(asWalletId(rawTransaction.inWallet));
        const normalizedTransaction = normalizeTransaction({
            id: asString(rawTransaction.id, `tx-${index}-${Date.now()}`),
            type: inferTransactionType(rawTransaction.type, signedValue),
            value: signedValue,
            date: asString(rawTransaction.date, new Date().toISOString().split("T")[0]),
            inWallet: walletId,
            category: {
                principal: isRecord(rawTransaction.category) ? asString(rawTransaction.category.principal, "Sem categoria") : "Sem categoria",
                sub: isRecord(rawTransaction.category) ? asString(rawTransaction.category.sub, "") || null : null,
            },
            beneficiary: asString(rawTransaction.beneficiary, "Eu"),
            description: typeof rawTransaction.description === "string" ? rawTransaction.description : "",
            status: Boolean(rawTransaction.status),
            meta: {
                criado_em: isRecord(rawTransaction.meta) ? asString(rawTransaction.meta.criado_em, new Date().toISOString()) : new Date().toISOString(),
                atualizado_em: isRecord(rawTransaction.meta) && typeof rawTransaction.meta.atualizado_em === "string" ? rawTransaction.meta.atualizado_em : null,
                observacoes: isRecord(rawTransaction.meta) && Array.isArray(rawTransaction.meta.observacoes) ? rawTransaction.meta.observacoes : undefined,
            },
        });

        if (walletId !== asWalletId(rawTransaction.inWallet)) {
            changed = true;
        }
        if (normalizedTransaction.value !== Math.abs(signedValue)) {
            changed = true;
        }
        if (normalizedTransaction.type !== rawTransaction.type) {
            changed = true;
        }

        normalizedTransactions.push(normalizedTransaction);
    });

    return {
        snapshot: createFinanceSnapshot(normalizedWallets, normalizedTransactions),
        changed,
    };
}
