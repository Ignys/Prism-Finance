import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinanceSnapshot } from "../financeTypes";
import type { SupabaseFinanceData } from "../../supabase/finance";

export type FinanceSyncStatus = "syncing" | "synced" | "error";

export interface FinanceSyncValue {
    status: FinanceSyncStatus;
    pendingCount: number;
    lastSyncedAt: string | null;
    lastError: string | null;
    retrySync: () => void;
}

interface PendingFinanceSync {
    queuedAt: string;
    data: SupabaseFinanceData;
}

interface StoredPendingFinanceSync extends PendingFinanceSync {
    version: 1;
    userId: string;
}

interface UseFinanceSyncQueueParams {
    userId: string | null;
    saveFinanceData: (userId: string, financeData: SupabaseFinanceData) => Promise<void>;
}

interface UseFinanceSyncQueueValue extends FinanceSyncValue {
    enqueueSync: (financeData: SupabaseFinanceData) => void;
    getPendingSyncData: () => SupabaseFinanceData | null;
}

const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];

function getPendingSyncStorageKey(userId: string): string {
    return `prism.finance.pending-sync.${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parsePendingSyncRecord(raw: unknown, userId: string): PendingFinanceSync | null {
    if (!isRecord(raw) || raw.version !== 1 || raw.userId !== userId || typeof raw.queuedAt !== "string" || !isRecord(raw.data)) {
        return null;
    }

    return {
        queuedAt: raw.queuedAt,
        data: raw.data as SupabaseFinanceData,
    };
}

function readPendingSyncFromStorage(userId: string): PendingFinanceSync | null {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(getPendingSyncStorageKey(userId));
        if (!raw) {
            return null;
        }

        return parsePendingSyncRecord(JSON.parse(raw), userId);
    } catch {
        return null;
    }
}

function writePendingSyncToStorage(userId: string, pendingSync: PendingFinanceSync): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    const record: StoredPendingFinanceSync = {
        version: 1,
        userId,
        queuedAt: pendingSync.queuedAt,
        data: pendingSync.data,
    };

    try {
        window.localStorage.setItem(getPendingSyncStorageKey(userId), JSON.stringify(record));
    } catch (error) {
        console.error("Failed to store pending finance sync:", error);
    }
}

function removePendingSyncFromStorage(userId: string): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.removeItem(getPendingSyncStorageKey(userId));
    } catch (error) {
        console.error("Failed to clear pending finance sync:", error);
    }
}

function createPendingSync(financeData: SupabaseFinanceData): PendingFinanceSync {
    return {
        queuedAt: new Date().toISOString(),
        data: financeData,
    };
}

function resolveErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Nao foi possivel sincronizar com o banco de dados.";
}

export function useFinanceSyncQueue({ userId, saveFinanceData }: UseFinanceSyncQueueParams): UseFinanceSyncQueueValue {
    const [status, setStatus] = useState<FinanceSyncStatus>("synced");
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const userIdRef = useRef(userId);
    const saveFinanceDataRef = useRef(saveFinanceData);
    const pendingSyncRef = useRef<PendingFinanceSync | null>(null);
    const inFlightRef = useRef(false);
    const activeFlushIdRef = useRef(0);
    const retryAttemptRef = useRef(0);
    const retryTimerRef = useRef<number | null>(null);
    const isMountedRef = useRef(false);
    const flushSyncRef = useRef<() => void>(() => undefined);
    const syncStateRef = useRef({ status, pendingCount });

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        saveFinanceDataRef.current = saveFinanceData;
    }, [saveFinanceData]);

    useEffect(() => {
        syncStateRef.current = { status, pendingCount };
    }, [pendingCount, status]);

    const clearRetryTimer = useCallback(() => {
        if (retryTimerRef.current === null) {
            return;
        }

        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
    }, []);

    const scheduleRetry = useCallback(() => {
        clearRetryTimer();

        const delay = RETRY_DELAYS_MS[Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)];
        retryAttemptRef.current += 1;
        retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            flushSyncRef.current();
        }, delay);
    }, [clearRetryTimer]);

    const flushSync = useCallback(() => {
        const activeUserId = userIdRef.current;
        const pendingSync = pendingSyncRef.current;

        if (!activeUserId || !pendingSync || inFlightRef.current) {
            return;
        }

        const flushId = activeFlushIdRef.current + 1;
        activeFlushIdRef.current = flushId;
        clearRetryTimer();
        inFlightRef.current = true;
        setStatus("syncing");
        setPendingCount(1);
        setLastError(null);

        void saveFinanceDataRef
            .current(activeUserId, pendingSync.data)
            .then(() => {
                if (!isMountedRef.current || userIdRef.current !== activeUserId) {
                    return;
                }

                const currentPendingSync = pendingSyncRef.current;
                if (currentPendingSync?.queuedAt === pendingSync.queuedAt) {
                    pendingSyncRef.current = null;
                    removePendingSyncFromStorage(activeUserId);
                    retryAttemptRef.current = 0;
                    setStatus("synced");
                    setPendingCount(0);
                    setLastSyncedAt(new Date().toISOString());
                    setLastError(null);
                }
            })
            .catch((error) => {
                if (!isMountedRef.current || userIdRef.current !== activeUserId) {
                    return;
                }

                if (pendingSyncRef.current?.queuedAt === pendingSync.queuedAt) {
                    setStatus("error");
                    setPendingCount(1);
                    setLastError(resolveErrorMessage(error));
                    scheduleRetry();
                }
            })
            .finally(() => {
                if (activeFlushIdRef.current !== flushId) {
                    return;
                }

                inFlightRef.current = false;

                if (!isMountedRef.current || userIdRef.current !== activeUserId) {
                    return;
                }

                const currentPendingSync = pendingSyncRef.current;
                if (currentPendingSync && currentPendingSync.queuedAt !== pendingSync.queuedAt) {
                    flushSyncRef.current();
                }
            });
    }, [clearRetryTimer, scheduleRetry]);

    useEffect(() => {
        flushSyncRef.current = flushSync;
    }, [flushSync]);

    useEffect(() => {
        userIdRef.current = userId;
        clearRetryTimer();
        activeFlushIdRef.current += 1;
        inFlightRef.current = false;
        retryAttemptRef.current = 0;

        if (!userId) {
            pendingSyncRef.current = null;
            setStatus("synced");
            setPendingCount(0);
            setLastError(null);
            return;
        }

        const storedPendingSync = readPendingSyncFromStorage(userId);
        pendingSyncRef.current = storedPendingSync;

        if (storedPendingSync) {
            setStatus("syncing");
            setPendingCount(1);
            setLastError(null);
            flushSyncRef.current();
            return;
        }

        setStatus("synced");
        setPendingCount(0);
        setLastError(null);
    }, [clearRetryTimer, userId]);

    useEffect(() => {
        const handleOnline = () => {
            if (pendingSyncRef.current) {
                flushSyncRef.current();
            }
        };

        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const syncState = syncStateRef.current;
            if (syncState.status === "synced" && syncState.pendingCount === 0) {
                return;
            }

            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    const enqueueSync = useCallback((financeData: SupabaseFinanceData) => {
        const activeUserId = userIdRef.current;
        if (!activeUserId) {
            return;
        }

        const pendingSync = createPendingSync(financeData);
        pendingSyncRef.current = pendingSync;
        writePendingSyncToStorage(activeUserId, pendingSync);
        setStatus("syncing");
        setPendingCount(1);
        setLastError(null);
        flushSyncRef.current();
    }, []);

    const retrySync = useCallback(() => {
        retryAttemptRef.current = 0;
        flushSyncRef.current();
    }, []);

    const getPendingSyncData = useCallback((): SupabaseFinanceData | null => pendingSyncRef.current?.data ?? null, []);

    return useMemo(
        () => ({
            status,
            pendingCount,
            lastSyncedAt,
            lastError,
            retrySync,
            enqueueSync,
            getPendingSyncData,
        }),
        [enqueueSync, getPendingSyncData, lastError, lastSyncedAt, pendingCount, retrySync, status],
    );
}

export function toSupabaseFinanceData(snapshot: FinanceSnapshot, favoriteWalletId: string | null): SupabaseFinanceData {
    return {
        ...snapshot,
        favoriteWalletId,
    };
}
