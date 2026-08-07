import type { FinanceSnapshot } from "../../financeTypes";

export async function persistTransactionSeriesSnapshotAtomically(params: {
    snapshot: FinanceSnapshot;
    persist: (snapshot: FinanceSnapshot) => Promise<void>;
    commit: (snapshot: FinanceSnapshot) => void;
}): Promise<void> {
    await params.persist(params.snapshot);
    params.commit(params.snapshot);
}
