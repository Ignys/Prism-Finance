import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinanceSnapshot } from "../financeTypes";
import { toSupabasePlanningState } from "../../lib/planningLocalPreferences";
import {
    isFinanceRevisionConflictError,
    type SaveSupabaseFinanceDataParams,
    type SupabaseFinanceData,
    type SupabaseFinanceLoadResult,
    type SupabaseFinanceSaveResult,
} from "../../supabase/finance";
import {
    readPendingFinanceSync,
    removePendingFinanceSync,
    writePendingFinanceSync,
    type PendingFinanceSync,
} from "./pendingFinanceSyncStorage";

export type FinanceSyncStatus = "syncing" | "synced" | "error";

export interface FinanceSyncValue {
    status: FinanceSyncStatus;
    pendingCount: number;
    lastSyncedAt: string | null;
    lastError: string | null;
    hasPendingSync: boolean;
    retrySync: () => void;
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

function logPendingStorageError(error: unknown): void {
    console.error("Failed to persist the pending finance sync in IndexedDB:", error);
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
            await writePendingFinanceSync(activeUserId, clientIdRef.current, mergedPendingSync);
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
                baseData: pendingSync.baseData,
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
                    void removePendingFinanceSync(activeUserId, clientIdRef.current, pendingSync.queuedAt).catch(logPendingStorageError);
                    retryAttemptRef.current = 0;
                    onSyncAcceptedRef.current(result.data, result.revision);
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

        let cancelled = false;
        void readPendingFinanceSync(userId, clientIdRef.current)
            .then((storedPendingSync) => {
                if (cancelled || userIdRef.current !== userId || pendingSyncRef.current) {
                    return;
                }
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
            })
            .catch((error) => {
                if (!cancelled) {
                    logPendingStorageError(error);
                    setLastError(resolveErrorMessage(error));
                }
            });

        return () => {
            cancelled = true;
        };
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

    const enqueueSync = useCallback((financeData: SupabaseFinanceData, context: EnqueueFinanceSyncContext) => {
        const activeUserId = userIdRef.current;
        if (!activeUserId) {
            return;
        }

        const currentPendingSync = pendingSyncRef.current;
        const pendingSync = currentPendingSync ? replacePendingTargetData(currentPendingSync, financeData) : createPendingSync(financeData, context);
        pendingSyncRef.current = pendingSync;
        setStatus("syncing");
        setPendingCount(1);
        setLastError(null);
        void writePendingFinanceSync(activeUserId, clientIdRef.current, pendingSync)
            .catch(logPendingStorageError)
            .finally(() => flushSyncRef.current());
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
        planning: toSupabasePlanningState(snapshot.planning),
        favoriteWalletId,
    };
}
