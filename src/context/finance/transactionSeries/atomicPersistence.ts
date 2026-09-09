import type { FinanceSnapshot } from "../../financeTypes";

export async function persistTransactionSeriesSnapshotAtomically(params: {
    snapshot: FinanceSnapshot;
    persist: (snapshot: FinanceSnapshot) => void | Promise<void>;
    commit: (snapshot: FinanceSnapshot) => void;
}): Promise<void> {
    const persistence = params.persist(params.snapshot);
    // Enqueuing an offline mutation is synchronous; publish its new refs before
    // a second action can construct a snapshot from stale state.
    if (persistence) await persistence;
    params.commit(params.snapshot);
}
