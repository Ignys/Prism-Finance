import type { SupabaseFinanceData } from "../../supabase/finance";

export interface PendingFinanceSync {
    queuedAt: string;
    baseRevision: number;
    baseData: SupabaseFinanceData;
    targetData: SupabaseFinanceData;
}

interface StoredPendingFinanceSync extends PendingFinanceSync {
    key: string;
    version: 4;
    userId: string;
    clientId: string;
}

const DATABASE_NAME = "prism-finance-sync";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-sync";
const storageOperations = new Map<string, Promise<void>>();

function getStorageKey(userId: string, clientId: string): string {
    return `${userId}:${clientId}`;
}

function enqueueStorageOperation(key: string, operation: () => Promise<void>): Promise<void> {
    const previous = storageOperations.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    storageOperations.set(key, current);
    return current.finally(() => {
        if (storageOperations.get(key) === current) {
            storageOperations.delete(key);
        }
    });
}

function getLegacyStorageKeys(userId: string, clientId: string): string[] {
    return [
        `prism.finance.pending-sync.${userId}.${clientId}`,
        `prism.finance.pending-sync.${userId}`,
    ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toRevision(value: unknown): number {
    const revision = Number(value);
    return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

export function parsePendingFinanceSync(raw: unknown, userId: string, clientId: string): PendingFinanceSync | null {
    if (!isRecord(raw) || raw.userId !== userId || typeof raw.queuedAt !== "string") {
        return null;
    }

    const matchesCurrentVersion = raw.version === 4 && raw.clientId === clientId;
    const matchesLegacyVersion = raw.version === 2 || (raw.version === 3 && raw.clientId === clientId);
    if ((matchesCurrentVersion || matchesLegacyVersion) && isRecord(raw.baseData) && isRecord(raw.targetData)) {
        return {
            queuedAt: raw.queuedAt,
            baseRevision: toRevision(raw.baseRevision),
            baseData: raw.baseData as unknown as SupabaseFinanceData,
            targetData: raw.targetData as unknown as SupabaseFinanceData,
        };
    }

    if (raw.version === 1 && isRecord(raw.data)) {
        const data = raw.data as unknown as SupabaseFinanceData;
        return { queuedAt: raw.queuedAt, baseRevision: 0, baseData: data, targetData: data };
    }

    return null;
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("FINANCE_SYNC_INDEXED_DB_UNAVAILABLE"));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("FINANCE_SYNC_INDEXED_DB_OPEN_FAILED"));
        request.onblocked = () => reject(new Error("FINANCE_SYNC_INDEXED_DB_BLOCKED"));
    });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("FINANCE_SYNC_INDEXED_DB_TRANSACTION_FAILED"));
        transaction.onabort = () => reject(transaction.error ?? new Error("FINANCE_SYNC_INDEXED_DB_TRANSACTION_ABORTED"));
    });
}

async function readFromIndexedDb(userId: string, clientId: string): Promise<PendingFinanceSync | null> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(getStorageKey(userId, clientId));
        const result = await new Promise<unknown>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("FINANCE_SYNC_INDEXED_DB_READ_FAILED"));
        });
        await waitForTransaction(transaction);
        return parsePendingFinanceSync(result, userId, clientId);
    } finally {
        database.close();
    }
}

function readLegacyPendingSync(userId: string, clientId: string): PendingFinanceSync | null {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    for (const key of getLegacyStorageKeys(userId, clientId)) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            continue;
        }
        try {
            const parsed = parsePendingFinanceSync(JSON.parse(raw), userId, clientId);
            if (parsed) {
                return parsed;
            }
        } catch {
            // Try the next legacy key.
        }
    }
    return null;
}

function clearLegacyPendingSync(userId: string, clientId: string): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    getLegacyStorageKeys(userId, clientId).forEach((key) => window.localStorage.removeItem(key));
}

export async function readPendingFinanceSync(userId: string, clientId: string): Promise<PendingFinanceSync | null> {
    const indexedRecord = await readFromIndexedDb(userId, clientId);
    if (indexedRecord) {
        return indexedRecord;
    }

    const legacyRecord = readLegacyPendingSync(userId, clientId);
    if (!legacyRecord) {
        return null;
    }

    await writePendingFinanceSync(userId, clientId, legacyRecord);
    return legacyRecord;
}

export async function writePendingFinanceSync(
    userId: string,
    clientId: string,
    pendingSync: PendingFinanceSync,
): Promise<void> {
    const key = getStorageKey(userId, clientId);
    return enqueueStorageOperation(key, async () => {
        const database = await openDatabase();
        try {
            const transaction = database.transaction(STORE_NAME, "readwrite", { durability: "strict" });
            const record: StoredPendingFinanceSync = {
                ...pendingSync,
                key,
                version: 4,
                userId,
                clientId,
            };
            transaction.objectStore(STORE_NAME).put(record);
            await waitForTransaction(transaction);
            clearLegacyPendingSync(userId, clientId);
        } finally {
            database.close();
        }
    });
}

export async function removePendingFinanceSync(
    userId: string,
    clientId: string,
    queuedAt?: string,
): Promise<void> {
    const key = getStorageKey(userId, clientId);
    return enqueueStorageOperation(key, async () => {
        const database = await openDatabase();
        try {
            const transaction = database.transaction(STORE_NAME, "readwrite", { durability: "strict" });
            const store = transaction.objectStore(STORE_NAME);
            if (!queuedAt) {
                store.delete(key);
            } else {
                const request = store.get(key);
                request.onsuccess = () => {
                    const stored = parsePendingFinanceSync(request.result, userId, clientId);
                    if (!stored || stored.queuedAt === queuedAt) {
                        store.delete(key);
                    }
                };
            }
            await waitForTransaction(transaction);
            clearLegacyPendingSync(userId, clientId);
        } finally {
            database.close();
        }
    });
}
