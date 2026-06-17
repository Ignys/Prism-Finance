import type { FinanceSnapshot } from "../context/financeTypes";

const FINANCE_BACKUP_KIND = "prism-finance-backup";
const FINANCE_BACKUP_VERSION = 1;
const MAX_LOCAL_FINANCE_BACKUPS = 8;

export interface FinanceBackupStats {
    wallets: number;
    creditCards: number;
    creditCardInvoices: number;
    transactionGroups: number;
    transactions: number;
    ledgerEntries: number;
    beneficiaries: number;
    categories: number;
    tags: number;
    wishItems: number;
    transactionTags: number;
}

export interface FinanceBackupFile {
    kind: typeof FINANCE_BACKUP_KIND;
    version: typeof FINANCE_BACKUP_VERSION;
    exportedAt: string;
    source: {
        uid: string;
        email: string | null;
        displayName: string | null;
    };
    preferences: {
        favoriteWalletId: string | null;
    };
    stats: FinanceBackupStats;
    finance: FinanceSnapshot;
}

export interface LocalFinanceBackupRecord extends FinanceBackupFile {
    id: string;
    storedAt: string;
    trigger: string;
}

interface BuildFinanceBackupParams {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    favoriteWalletId?: string | null;
    finance: FinanceSnapshot;
    exportedAt?: string;
}

interface SaveLocalFinanceBackupParams extends BuildFinanceBackupParams {
    trigger: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getLocalFinanceBackupStorageKey(uid: string): string {
    return `prism.finance.backups.${uid}`;
}

function createBackupId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `backup-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function readLocalFinanceBackupsFromStorage(uid: string): LocalFinanceBackupRecord[] {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }

    try {
        const raw = window.localStorage.getItem(getLocalFinanceBackupStorageKey(uid));
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isRecord).flatMap((item) => {
            try {
                return [parseLocalFinanceBackupRecord(item)];
            } catch {
                return [];
            }
        });
    } catch {
        return [];
    }
}

function writeLocalFinanceBackupsToStorage(uid: string, backups: LocalFinanceBackupRecord[]): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(getLocalFinanceBackupStorageKey(uid), JSON.stringify(backups));
    } catch (error) {
        console.error("Failed to persist local finance backup:", error);
    }
}

export function summarizeFinanceSnapshot(finance: FinanceSnapshot): FinanceBackupStats {
    return {
        wallets: finance.wallets.length,
        creditCards: finance.creditCards.length,
        creditCardInvoices: finance.creditCardInvoices.length,
        transactionGroups: finance.transactionGroups.length,
        transactions: finance.transactions.length,
        ledgerEntries: finance.ledgerEntries.length,
        beneficiaries: finance.beneficiaries.length,
        categories: finance.categories.length,
        tags: finance.tags.length,
        wishItems: finance.wishItems.length,
        transactionTags: finance.transactionTags.length,
    };
}

export function buildFinanceBackupFile(params: BuildFinanceBackupParams): FinanceBackupFile {
    return {
        kind: FINANCE_BACKUP_KIND,
        version: FINANCE_BACKUP_VERSION,
        exportedAt: params.exportedAt ?? new Date().toISOString(),
        source: {
            uid: params.uid,
            email: params.email?.trim() || null,
            displayName: params.displayName?.trim() || null,
        },
        preferences: {
            favoriteWalletId: params.favoriteWalletId?.trim() || null,
        },
        stats: summarizeFinanceSnapshot(params.finance),
        finance: params.finance,
    };
}

export function saveLocalFinanceBackup(params: SaveLocalFinanceBackupParams): void {
    const nextBackup: LocalFinanceBackupRecord = {
        ...buildFinanceBackupFile(params),
        id: createBackupId(),
        storedAt: new Date().toISOString(),
        trigger: params.trigger.trim() || "manual",
    };

    const currentBackups = readLocalFinanceBackupsFromStorage(params.uid);
    const latestBackup = currentBackups[0] ?? null;
    const nextSignature = JSON.stringify({
        favoriteWalletId: nextBackup.preferences.favoriteWalletId,
        finance: nextBackup.finance,
    });

    const latestSignature = latestBackup
        ? JSON.stringify({
              favoriteWalletId: latestBackup.preferences.favoriteWalletId,
              finance: latestBackup.finance,
          })
        : null;

    if (latestSignature === nextSignature) {
        return;
    }

    writeLocalFinanceBackupsToStorage(params.uid, [nextBackup, ...currentBackups].slice(0, MAX_LOCAL_FINANCE_BACKUPS));
}

export function listLocalFinanceBackups(uid: string): LocalFinanceBackupRecord[] {
    return readLocalFinanceBackupsFromStorage(uid);
}

export function parseFinanceBackupFile(raw: unknown): FinanceBackupFile {
    if (!isRecord(raw)) {
        throw new Error("O arquivo nao contem um objeto JSON valido.");
    }

    if (raw.kind !== FINANCE_BACKUP_KIND) {
        throw new Error("Este arquivo nao parece ser um backup do Prism.");
    }

    if (raw.version !== FINANCE_BACKUP_VERSION) {
        throw new Error("Versao de backup nao suportada.");
    }

    const source = isRecord(raw.source) ? raw.source : null;
    const preferences = isRecord(raw.preferences) ? raw.preferences : null;
    const finance = raw.finance;

    if (!source || !preferences || !isRecord(finance)) {
        throw new Error("O arquivo de backup esta incompleto.");
    }

    return {
        kind: FINANCE_BACKUP_KIND,
        version: FINANCE_BACKUP_VERSION,
        exportedAt: asOptionalString(raw.exportedAt) ?? new Date(0).toISOString(),
        source: {
            uid: asOptionalString(source.uid) ?? "",
            email: asOptionalString(source.email),
            displayName: asOptionalString(source.displayName),
        },
        preferences: {
            favoriteWalletId: asOptionalString(preferences.favoriteWalletId),
        },
        stats: summarizeFinanceSnapshot(finance as FinanceSnapshot),
        finance: finance as FinanceSnapshot,
    };
}

export function parseLocalFinanceBackupRecord(raw: unknown): LocalFinanceBackupRecord {
    if (!isRecord(raw)) {
        throw new Error("Registro local invalido.");
    }

    const parsed = parseFinanceBackupFile(raw);
    return {
        ...parsed,
        id: asOptionalString(raw.id) ?? createBackupId(),
        storedAt: asOptionalString(raw.storedAt) ?? parsed.exportedAt,
        trigger: asOptionalString(raw.trigger) ?? "manual",
    };
}
