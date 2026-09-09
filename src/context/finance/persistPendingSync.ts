import type { PendingFinanceSync } from "./pendingFinanceSyncStorage";

interface PersistPendingSyncParams {
    pending: PendingFinanceSync;
    isCurrent: (pending: PendingFinanceSync) => boolean;
    persist: (pending: PendingFinanceSync) => Promise<void>;
    onDurable: (pending: PendingFinanceSync) => void;
}

/** A remote flush may start only after the current pending snapshot is durable. */
export async function persistPendingSync({ pending, isCurrent, persist, onDurable }: PersistPendingSyncParams): Promise<boolean> {
    await persist(pending);
    if (!isCurrent(pending)) return false;
    onDurable(pending);
    return true;
}
