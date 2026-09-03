import type { FinanceSnapshot } from "../context/financeTypes";
import {
    readFinanceBackupsFromIndexedDb,
    replaceFinanceBackupsInIndexedDb,
} from "./financeBackupStorage";

const FINANCE_BACKUP_KIND = "prism-finance-backup";
const FINANCE_BACKUP_VERSION = 1;
const MAX_LOCAL_FINANCE_BACKUPS = 8;
const backupSaveOperations = new Map<string, Promise<void>>();

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

function removeLegacyFinanceBackups(uid: string): void {
    if (typeof window !== "undefined") {
        window.localStorage?.removeItem(getLocalFinanceBackupStorageKey(uid));
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

export function downloadFinanceBackupFile(backup: FinanceBackupFile, label: string): void {
    const safeLabel = label.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "backup";
    const filename = `${safeLabel}-${backup.exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
}

export function saveLocalFinanceBackup(params: SaveLocalFinanceBackupParams): void {
    const nextBackup: LocalFinanceBackupRecord = {
        ...buildFinanceBackupFile(params),
        id: createBackupId(),
        storedAt: new Date().toISOString(),
        trigger: params.trigger.trim() || "manual",
    };

    const previous = backupSaveOperations.get(params.uid) ?? Promise.resolve();
    const current = previous
        .catch(() => undefined)
        .then(async () => {
            const currentBackups = await listLocalFinanceBackups(params.uid);
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

            if (latestSignature !== nextSignature) {
                await replaceFinanceBackupsInIndexedDb(
                    params.uid,
                    [nextBackup, ...currentBackups].slice(0, MAX_LOCAL_FINANCE_BACKUPS),
                );
                removeLegacyFinanceBackups(params.uid);
            }
        });
    backupSaveOperations.set(params.uid, current);
    void current
        .catch((error) => console.error("Failed to persist local finance backup in IndexedDB:", error))
        .finally(() => {
            if (backupSaveOperations.get(params.uid) === current) {
                backupSaveOperations.delete(params.uid);
            }
        });
}

export async function listLocalFinanceBackups(uid: string): Promise<LocalFinanceBackupRecord[]> {
    try {
        const indexedBackups = await readFinanceBackupsFromIndexedDb(uid);
        if (indexedBackups.length > 0) {
            return indexedBackups;
        }

        const legacyBackups = readLocalFinanceBackupsFromStorage(uid);
        if (legacyBackups.length > 0) {
            await replaceFinanceBackupsInIndexedDb(uid, legacyBackups);
            removeLegacyFinanceBackups(uid);
        }
        return legacyBackups;
    } catch (error) {
        console.error("Failed to read local finance backups from IndexedDB:", error);
        return readLocalFinanceBackupsFromStorage(uid);
    }
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
        stats: summarizeFinanceSnapshot(finance as unknown as FinanceSnapshot),
        finance: finance as unknown as FinanceSnapshot,
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
