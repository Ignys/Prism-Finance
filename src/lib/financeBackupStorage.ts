import type { LocalFinanceBackupRecord } from "./financeBackup";

interface StoredFinanceBackup {
    key: string;
    userId: string;
    backup: LocalFinanceBackupRecord;
}

const DATABASE_NAME = "prism-finance-backups";
const DATABASE_VERSION = 1;
const STORE_NAME = "backups";
const USER_INDEX = "user-id";
const storageOperations = new Map<string, Promise<void>>();

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("FINANCE_BACKUP_INDEXED_DB_UNAVAILABLE"));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
                store.createIndex(USER_INDEX, "userId");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("FINANCE_BACKUP_INDEXED_DB_OPEN_FAILED"));
        request.onblocked = () => reject(new Error("FINANCE_BACKUP_INDEXED_DB_BLOCKED"));
    });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("FINANCE_BACKUP_INDEXED_DB_TRANSACTION_FAILED"));
        transaction.onabort = () => reject(transaction.error ?? new Error("FINANCE_BACKUP_INDEXED_DB_TRANSACTION_ABORTED"));
    });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("FINANCE_BACKUP_INDEXED_DB_REQUEST_FAILED"));
    });
}

function enqueueStorageOperation(userId: string, operation: () => Promise<void>): Promise<void> {
    const previous = storageOperations.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    storageOperations.set(userId, current);
    return current.finally(() => {
        if (storageOperations.get(userId) === current) {
            storageOperations.delete(userId);
        }
    });
}

export async function readFinanceBackupsFromIndexedDb(userId: string): Promise<LocalFinanceBackupRecord[]> {
    await (storageOperations.get(userId) ?? Promise.resolve()).catch(() => undefined);
    const database = await openDatabase();
    try {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const rows = await requestResult(
            transaction.objectStore(STORE_NAME).index(USER_INDEX).getAll(IDBKeyRange.only(userId)),
        ) as StoredFinanceBackup[];
        await waitForTransaction(transaction);
        return rows.map((row) => row.backup).sort((left, right) => right.storedAt.localeCompare(left.storedAt));
    } finally {
        database.close();
    }
}

export function replaceFinanceBackupsInIndexedDb(
    userId: string,
    backups: LocalFinanceBackupRecord[],
): Promise<void> {
    return enqueueStorageOperation(userId, async () => {
        const database = await openDatabase();
        try {
            const transaction = database.transaction(STORE_NAME, "readwrite", { durability: "strict" });
            const store = transaction.objectStore(STORE_NAME);
            const existing = await requestResult(store.index(USER_INDEX).getAllKeys(IDBKeyRange.only(userId)));
            existing.forEach((key) => store.delete(key));
            backups.forEach((backup) => {
                const row: StoredFinanceBackup = {
                    key: `${userId}:${backup.id}`,
                    userId,
                    backup,
                };
                store.put(row);
            });
            await waitForTransaction(transaction);
        } finally {
            database.close();
        }
    });
}
