import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinanceSnapshot } from "../financeTypes";
import {
    isFinanceRevisionConflictError,
    type SaveSupabaseFinanceDataParams,
    type SupabaseFinanceData,
    type SupabaseFinanceLoadResult,
    type SupabaseFinanceSaveResult,
} from "../../supabase/finance";

export type FinanceSyncStatus = "syncing" | "synced" | "error";

export interface FinanceSyncValue {
    status: FinanceSyncStatus;
    pendingCount: number;
    lastSyncedAt: string | null;
    lastError: string | null;
    hasPendingSync: boolean;
    retrySync: () => void;
}

interface PendingFinanceSync {
    queuedAt: string;
    baseRevision: number;
    baseData: SupabaseFinanceData;
    targetData: SupabaseFinanceData;
}

interface StoredPendingFinanceSync extends PendingFinanceSync {
    version: 2;
    userId: string;
}

interface EnqueueFinanceSyncContext {
    baseRevision: number;
    baseData: SupabaseFinanceData;
}

interface MergeFinanceSyncDataParams {
    baseData: SupabaseFinanceData;
    remoteData: SupabaseFinanceData;
    targetData: SupabaseFinanceData;
}

interface UseFinanceSyncQueueParams {
    userId: string | null;
    clientId: string;
    saveFinanceData: (params: SaveSupabaseFinanceDataParams) => Promise<SupabaseFinanceSaveResult>;
    loadFinanceData: (userId: string) => Promise<SupabaseFinanceLoadResult>;
    mergeFinanceData: (params: MergeFinanceSyncDataParams) => SupabaseFinanceData;
    onSyncAccepted: (financeData: SupabaseFinanceData, revision: number) => void;
    onConflictMerged: (financeData: SupabaseFinanceData, baseData: SupabaseFinanceData, revision: number) => void;
}

interface UseFinanceSyncQueueValue extends FinanceSyncValue {
    enqueueSync: (financeData: SupabaseFinanceData, context: EnqueueFinanceSyncContext) => void;
    getPendingSyncData: () => SupabaseFinanceData | null;
    getPendingSyncBaseRevision: () => number | null;
}

const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];
let lastPendingSyncQueuedAtMs = 0;

function getPendingSyncStorageKey(userId: string): string {
    return `prism.finance.pending-sync.${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toRevision(value: unknown): number {
    const revision = Number(value);
    return Number.isFinite(revision) && revision >= 0 ? revision : 0;
}

function parsePendingSyncRecord(raw: unknown, userId: string): PendingFinanceSync | null {
    if (!isRecord(raw) || raw.userId !== userId || typeof raw.queuedAt !== "string") {
        return null;
    }

    if (raw.version === 2 && isRecord(raw.baseData) && isRecord(raw.targetData)) {
        return {
            queuedAt: raw.queuedAt,
            baseRevision: toRevision(raw.baseRevision),
            baseData: raw.baseData as unknown as SupabaseFinanceData,
            targetData: raw.targetData as unknown as SupabaseFinanceData,
        };
    }

    if (raw.version === 1 && isRecord(raw.data)) {
        const data = raw.data as unknown as SupabaseFinanceData;
        return {
            queuedAt: raw.queuedAt,
            baseRevision: 0,
            baseData: data,
            targetData: data,
        };
    }

    return null;
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
        version: 2,
        userId,
        queuedAt: pendingSync.queuedAt,
        baseRevision: pendingSync.baseRevision,
        baseData: pendingSync.baseData,
        targetData: pendingSync.targetData,
    };

    try {
        window.localStorage.setItem(getPendingSyncStorageKey(userId), JSON.stringify(record));
    } catch (error) {
        console.error("Failed to store pending finance sync:", error);
    }
}

function comparePendingSyncQueuedAt(a: string, b: string): number {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

function removePendingSyncFromStorage(userId: string, queuedAt?: string): void {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }

    try {
        if (queuedAt) {
            const storedPendingSync = readPendingSyncFromStorage(userId);
            if (storedPendingSync && storedPendingSync.queuedAt !== queuedAt) {
                return;
            }
        }

        window.localStorage.removeItem(getPendingSyncStorageKey(userId));
    } catch (error) {
        console.error("Failed to clear pending finance sync:", error);
    }
}

function createQueuedAt(): string {
    const nowMs = Date.now();
    lastPendingSyncQueuedAtMs = Math.max(nowMs, lastPendingSyncQueuedAtMs + 1);
    return new Date(lastPendingSyncQueuedAtMs).toISOString();
}

function createPendingSync(financeData: SupabaseFinanceData, context: EnqueueFinanceSyncContext): PendingFinanceSync {
    return {
        queuedAt: createQueuedAt(),
        baseRevision: context.baseRevision,
        baseData: context.baseData,
        targetData: financeData,
    };
}

function replacePendingTargetData(pendingSync: PendingFinanceSync, targetData: SupabaseFinanceData): PendingFinanceSync {
    return {
        ...pendingSync,
        queuedAt: createQueuedAt(),
        targetData,
    };
}

function resolveErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Nao foi possivel sincronizar com o banco de dados.";
}

function summarizeFinanceSyncData(financeData: SupabaseFinanceData): Record<string, number> {
    return {
        wallets: financeData.wallets.length,
        creditCards: financeData.creditCards.length,
        creditCardInvoices: financeData.creditCardInvoices.length,
        beneficiaries: financeData.beneficiaries.length,
        categories: financeData.categories.length,
        tags: financeData.tags.length,
        wishItems: financeData.wishItems.length,
        transactionGroups: financeData.transactionGroups.length,
        transactions: financeData.transactions.length,
        ledgerEntries: financeData.ledgerEntries.length,
        transactionTags: financeData.transactionTags.length,
    };
}

function logFinanceSyncError(params: { error: unknown; pendingSync: PendingFinanceSync; retryAttempt: number; userId: string }): void {
    console.log("[FinanceSync] Erro ao sincronizar dados financeiros", {
        error: params.error,
        queuedAt: params.pendingSync.queuedAt,
        baseRevision: params.pendingSync.baseRevision,
        retryAttempt: params.retryAttempt,
        userId: params.userId,
        dataSummary: summarizeFinanceSyncData(params.pendingSync.targetData),
    });
}

export function useFinanceSyncQueue({
    userId,
    clientId,
    saveFinanceData,
    loadFinanceData,
    mergeFinanceData,
    onSyncAccepted,
    onConflictMerged,
}: UseFinanceSyncQueueParams): UseFinanceSyncQueueValue {
    const [status, setStatus] = useState<FinanceSyncStatus>("synced");
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const userIdRef = useRef(userId);
    const clientIdRef = useRef(clientId);
    const saveFinanceDataRef = useRef(saveFinanceData);
    const loadFinanceDataRef = useRef(loadFinanceData);
    const mergeFinanceDataRef = useRef(mergeFinanceData);
    const onSyncAcceptedRef = useRef(onSyncAccepted);
    const onConflictMergedRef = useRef(onConflictMerged);
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
        clientIdRef.current = clientId;
    }, [clientId]);

    useEffect(() => {
        saveFinanceDataRef.current = saveFinanceData;
    }, [saveFinanceData]);

    useEffect(() => {
        loadFinanceDataRef.current = loadFinanceData;
    }, [loadFinanceData]);

    useEffect(() => {
        mergeFinanceDataRef.current = mergeFinanceData;
    }, [mergeFinanceData]);

    useEffect(() => {
        onSyncAcceptedRef.current = onSyncAccepted;
    }, [onSyncAccepted]);

    useEffect(() => {
        onConflictMergedRef.current = onConflictMerged;
    }, [onConflictMerged]);

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

    const handleRevisionConflict = useCallback(
        async (activeUserId: string, pendingSync: PendingFinanceSync): Promise<void> => {
            const remoteFinance = await loadFinanceDataRef.current(activeUserId);
            const remoteData = remoteFinance.data;
            if (!remoteData) {
                throw new Error("Nao foi possivel recarregar os dados remotos para resolver o conflito.");
            }

            const mergedData = mergeFinanceDataRef.current({
                baseData: pendingSync.baseData,
                remoteData,
                targetData: pendingSync.targetData,
            });
            const mergedPendingSync = createPendingSync(mergedData, {
                baseRevision: remoteFinance.revision,
                baseData: remoteData,
            });

            pendingSyncRef.current = mergedPendingSync;
            writePendingSyncToStorage(activeUserId, mergedPendingSync);
            retryAttemptRef.current = 0;
            onConflictMergedRef.current(mergedData, remoteData, remoteFinance.revision);
            setStatus("syncing");
            setPendingCount(1);
            setLastError(null);
        },
        [],
    );

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
            .current({
                userId: activeUserId,
                financeData: pendingSync.targetData,
                baseRevision: pendingSync.baseRevision,
                clientId: clientIdRef.current,
            })
            .then((result) => {
                if (!isMountedRef.current || userIdRef.current !== activeUserId) {
                    return;
                }

                const currentPendingSync = pendingSyncRef.current;
                if (currentPendingSync?.queuedAt === pendingSync.queuedAt) {
                    pendingSyncRef.current = null;
                    removePendingSyncFromStorage(activeUserId, pendingSync.queuedAt);
                    retryAttemptRef.current = 0;
                    onSyncAcceptedRef.current(pendingSync.targetData, result.revision);
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

                if (pendingSyncRef.current?.queuedAt !== pendingSync.queuedAt) {
                    return;
                }

                if (isFinanceRevisionConflictError(error)) {
                    void handleRevisionConflict(activeUserId, pendingSync)
                        .then(() => {
                            if (isMountedRef.current && userIdRef.current === activeUserId) {
                                flushSyncRef.current();
                            }
                        })
                        .catch((conflictError) => {
                            if (!isMountedRef.current || userIdRef.current !== activeUserId || pendingSyncRef.current?.queuedAt !== pendingSync.queuedAt) {
                                return;
                            }

                            logFinanceSyncError({
                                error: conflictError,
                                pendingSync,
                                retryAttempt: retryAttemptRef.current,
                                userId: activeUserId,
                            });
                            setStatus("error");
                            setPendingCount(1);
                            setLastError(resolveErrorMessage(conflictError));
                            scheduleRetry();
                        });
                    return;
                }

                logFinanceSyncError({
                    error,
                    pendingSync,
                    retryAttempt: retryAttemptRef.current,
                    userId: activeUserId,
                });
                setStatus("error");
                setPendingCount(1);
                setLastError(resolveErrorMessage(error));
                scheduleRetry();
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
    }, [clearRetryTimer, handleRevisionConflict, scheduleRetry]);

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
        if (typeof window === "undefined") {
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            const activeUserId = userIdRef.current;
            if (!activeUserId || event.key !== getPendingSyncStorageKey(activeUserId)) {
                return;
            }

            if (!event.newValue) {
                if (!inFlightRef.current) {
                    pendingSyncRef.current = null;
                    setStatus("synced");
                    setPendingCount(0);
                    setLastError(null);
                }
                return;
            }

            let storedPendingSync: PendingFinanceSync | null = null;
            try {
                storedPendingSync = parsePendingSyncRecord(JSON.parse(event.newValue), activeUserId);
            } catch {
                return;
            }

            if (!storedPendingSync) {
                return;
            }

            const currentPendingSync = pendingSyncRef.current;
            if (currentPendingSync && comparePendingSyncQueuedAt(storedPendingSync.queuedAt, currentPendingSync.queuedAt) <= 0) {
                return;
            }

            pendingSyncRef.current = storedPendingSync;
            setStatus("syncing");
            setPendingCount(1);
            setLastError(null);

            if (!inFlightRef.current) {
                flushSyncRef.current();
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

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

    const enqueueSync = useCallback((financeData: SupabaseFinanceData, context: EnqueueFinanceSyncContext) => {
        const activeUserId = userIdRef.current;
        if (!activeUserId) {
            return;
        }

        const currentPendingSync = pendingSyncRef.current;
        const pendingSync = currentPendingSync ? replacePendingTargetData(currentPendingSync, financeData) : createPendingSync(financeData, context);
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

    const getPendingSyncData = useCallback((): SupabaseFinanceData | null => pendingSyncRef.current?.targetData ?? null, []);
    const getPendingSyncBaseRevision = useCallback((): number | null => pendingSyncRef.current?.baseRevision ?? null, []);
    const hasPendingSync = pendingCount > 0 || pendingSyncRef.current !== null;

    return useMemo(
        () => ({
            status,
            pendingCount,
            lastSyncedAt,
            lastError,
            hasPendingSync,
            retrySync,
            enqueueSync,
            getPendingSyncData,
            getPendingSyncBaseRevision,
        }),
        [enqueueSync, getPendingSyncBaseRevision, getPendingSyncData, hasPendingSync, lastError, lastSyncedAt, pendingCount, retrySync, status],
    );
}

export function toSupabaseFinanceData(snapshot: FinanceSnapshot, favoriteWalletId: string | null): SupabaseFinanceData {
    return {
        ...snapshot,
        favoriteWalletId,
    };
}
