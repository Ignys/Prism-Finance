import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinanceSnapshot } from "../financeTypes";
import type { FinanceSyncStatus, FinanceSyncValue } from "./contextTypes";
import { toSupabasePlanningState } from "../../lib/planningLocalPreferences";
import { describeFinanceSyncError } from "./financeSyncErrors";
import { persistConflictResolution } from "./persistConflictResolution";
import { persistPendingSync } from "./persistPendingSync";
import { recoverPendingSync } from "./recoverPendingSync";
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
    backupPendingData: (financeData: SupabaseFinanceData) => Promise<void>;
}

interface UseFinanceSyncQueueValue extends FinanceSyncValue {
    hydratedUserId: string | null;
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
    return describeFinanceSyncError(error).message;
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
    backupPendingData,
}: UseFinanceSyncQueueParams): UseFinanceSyncQueueValue {
    const [status, setStatus] = useState<FinanceSyncStatus>("synced");
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

    const userIdRef = useRef(userId);
    const clientIdRef = useRef(clientId);
    const saveFinanceDataRef = useRef(saveFinanceData);
    const loadFinanceDataRef = useRef(loadFinanceData);
    const mergeFinanceDataRef = useRef(mergeFinanceData);
    const onSyncAcceptedRef = useRef(onSyncAccepted);
    const onConflictMergedRef = useRef(onConflictMerged);
    const backupPendingDataRef = useRef(backupPendingData);
    const pendingSyncRef = useRef<PendingFinanceSync | null>(null);
    const durablePendingQueuedAtRef = useRef<string | null>(null);
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
    useEffect(() => { backupPendingDataRef.current = backupPendingData; }, [backupPendingData]);

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
            if (userIdRef.current !== activeUserId || pendingSyncRef.current?.queuedAt !== pendingSync.queuedAt) return;
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

            const published = await persistConflictResolution({
                original: pendingSync,
                resolved: mergedPendingSync,
                isCurrent: (pending) => isMountedRef.current && userIdRef.current === activeUserId && pendingSyncRef.current?.queuedAt === pending.queuedAt,
                persist: (pending) => writePendingFinanceSync(activeUserId, clientIdRef.current, pending),
                publish: (pending) => {
                    pendingSyncRef.current = pending;
                    durablePendingQueuedAtRef.current = pending.queuedAt;
                },
            });
            if (!published) return;
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
                    durablePendingQueuedAtRef.current = null;
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
                    return handleRevisionConflict(activeUserId, pendingSync)
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
                if (describeFinanceSyncError(error).retryAutomatically) scheduleRetry();
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
                if (currentPendingSync
                    && currentPendingSync.queuedAt !== pendingSync.queuedAt
                    && durablePendingQueuedAtRef.current === currentPendingSync.queuedAt) {
                    flushSyncRef.current();
                }
            });
    }, [clearRetryTimer, handleRevisionConflict, scheduleRetry]);

    useEffect(() => {
        flushSyncRef.current = flushSync;
    }, [flushSync]);

    useEffect(() => {
        userIdRef.current = userId;
        durablePendingQueuedAtRef.current = null;
        setHydratedUserId(null);
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
                    durablePendingQueuedAtRef.current = storedPendingSync.queuedAt;
                    setStatus("syncing");
                    setPendingCount(1);
                    setLastError(null);
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
            })
            .finally(() => {
                if (!cancelled && userIdRef.current === userId) {
                    setHydratedUserId(userId);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [clearRetryTimer, userId]);

    useEffect(() => {
        const handleOnline = () => {
            const activeUserId = userIdRef.current;
            const pendingSync = pendingSyncRef.current;
            if (!activeUserId || !pendingSync) return;
            if (durablePendingQueuedAtRef.current === pendingSync.queuedAt) flushSyncRef.current();
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

    const persistPendingThenFlush = useCallback((activeUserId: string, pendingSync: PendingFinanceSync) => {
        void persistPendingSync({
            pending: pendingSync,
            isCurrent: (candidate) => isMountedRef.current
                && userIdRef.current === activeUserId
                && pendingSyncRef.current?.queuedAt === candidate.queuedAt,
            persist: (candidate) => writePendingFinanceSync(activeUserId, clientIdRef.current, candidate),
            onDurable: (candidate) => {
                durablePendingQueuedAtRef.current = candidate.queuedAt;
                flushSyncRef.current();
            },
        }).catch((error) => {
            logPendingStorageError(error);
            if (!isMountedRef.current
                || userIdRef.current !== activeUserId
                || pendingSyncRef.current?.queuedAt !== pendingSync.queuedAt) {
                return;
            }
            setStatus("error");
            setPendingCount(1);
            setLastError("Não foi possível proteger as alterações locais no armazenamento do navegador. Tente novamente antes de sair.");
        });
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
        persistPendingThenFlush(activeUserId, pendingSync);
    }, [persistPendingThenFlush]);

    const restoreConfirmedData = useCallback(async () => {
        const activeUserId = userIdRef.current;
        const pending = pendingSyncRef.current;
        if (!activeUserId || !pending) return;
        if (inFlightRef.current) throw new Error("Aguarde a sincronização em andamento terminar.");
        const recoveryId = ++activeFlushIdRef.current;
        clearRetryTimer();
        inFlightRef.current = true;
        setStatus("syncing");
        try {
            await recoverPendingSync({
                load: () => loadFinanceDataRef.current(activeUserId),
                backup: () => backupPendingDataRef.current(pending.targetData),
                removePending: () => removePendingFinanceSync(activeUserId, clientIdRef.current, pending.queuedAt),
                isCurrent: () => isMountedRef.current && activeFlushIdRef.current === recoveryId && userIdRef.current === activeUserId && pendingSyncRef.current?.queuedAt === pending.queuedAt,
                publish: (remote) => {
                    pendingSyncRef.current = null;
                    durablePendingQueuedAtRef.current = null;
                    onSyncAcceptedRef.current(remote.data!, remote.revision);
                    setPendingCount(0);
                    setLastError(null);
                    setLastSyncedAt(new Date().toISOString());
                    setStatus("synced");
                },
            });
        } catch (error) {
            if (isMountedRef.current && activeFlushIdRef.current === recoveryId && userIdRef.current === activeUserId) {
                setStatus("error");
                setLastError(resolveErrorMessage(error));
            }
            throw error;
        } finally {
            if (activeFlushIdRef.current === recoveryId && userIdRef.current === activeUserId) {
                inFlightRef.current = false;
                const currentPendingSync = pendingSyncRef.current;
                if (currentPendingSync
                    && currentPendingSync.queuedAt !== pending.queuedAt
                    && durablePendingQueuedAtRef.current === currentPendingSync.queuedAt) {
                    flushSyncRef.current();
                }
            }
        }
    }, [clearRetryTimer]);

    const retrySync = useCallback(() => {
        retryAttemptRef.current = 0;
        const activeUserId = userIdRef.current;
        const pendingSync = pendingSyncRef.current;
        if (!activeUserId || !pendingSync) return;
        persistPendingThenFlush(activeUserId, pendingSync);
    }, [persistPendingThenFlush]);

    const getPendingSyncData = useCallback((): SupabaseFinanceData | null => pendingSyncRef.current?.targetData ?? null, []);
    const getPendingSyncBaseRevision = useCallback((): number | null => pendingSyncRef.current?.baseRevision ?? null, []);
    const hasPendingSync = pendingCount > 0 || pendingSyncRef.current !== null;

    return useMemo(
        () => ({
            hydratedUserId,
            status,
            pendingCount,
            lastSyncedAt,
            lastError,
            hasPendingSync,
            retrySync,
            restoreConfirmedData,
            enqueueSync,
            getPendingSyncData,
            getPendingSyncBaseRevision,
        }),
        [enqueueSync, getPendingSyncBaseRevision, getPendingSyncData, hasPendingSync, hydratedUserId, lastError, lastSyncedAt, pendingCount, retrySync, restoreConfirmedData, status],
    );
}

export function toSupabaseFinanceData(snapshot: FinanceSnapshot, favoriteWalletId: string | null): SupabaseFinanceData {
    return {
        ...snapshot,
        planning: toSupabasePlanningState(snapshot.planning),
        favoriteWalletId,
    };
}
