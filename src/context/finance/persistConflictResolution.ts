import type { PendingFinanceSync } from "./pendingFinanceSyncStorage";

interface PersistConflictResolutionParams {
    original: PendingFinanceSync;
    resolved: PendingFinanceSync;
    isCurrent: (pending: PendingFinanceSync) => boolean;
    persist: (pending: PendingFinanceSync) => Promise<void>;
    publish: (pending: PendingFinanceSync) => void;
}

/** A failed durable write must leave the original pending action retryable. */
export async function persistConflictResolution({ original, resolved, isCurrent, persist, publish }: PersistConflictResolutionParams): Promise<boolean> {
    if (!isCurrent(original)) return false;
    await persist(resolved);
    // A newer edit can arrive while IndexedDB commits. Its queued write takes precedence.
    if (!isCurrent(original)) return false;
    publish(resolved);
    return true;
}
