import { describe, expect, it } from "vitest";
import { fixtureGroup, fixtureSnapshot } from "../financeTestFixtures";
import { requireRecurrenceRule } from "./rule";
import { materializeOccurrence } from "./materializeOccurrence";
import { occurrenceId, projectOccurrences } from "./projectOccurrences";
import { updateTransactionSeriesSnapshot } from "../transactionSeries/updateTransactionSeriesSnapshot";
import { mergeSupabaseFinanceData } from "../financeSyncMerge";
import { applyTransactionStatus } from "../transactionStatus";
import { deleteTransactionsSnapshot } from "../transactionSeries/deleteTransactions";
import type { FinanceSnapshot } from "../domainTypes";

const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "count", count: 6 } }) });
const base = fixtureSnapshot([group], []);
const data = (snapshot: FinanceSnapshot) => ({ ...snapshot, favoriteWalletId: null });
function edit(number: number, amount: number, revision: string) {
    const id = occurrenceId(group.id, number);
    return updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(base, id), transactionId: id, draft: { amount }, scope: "this_and_next",
        wasProjected: true, createGroupId: () => revision, now: "2026-01-01T12:00:00Z" }).snapshot;
}
function projected(snapshot: FinanceSnapshot) {
    return projectOccurrences({ groups: snapshot.transactionGroups, transactions: snapshot.transactions, transactionTags: snapshot.transactionTags,
        creditCards: [], period: { startDate: "2026-01-01", endDate: "2026-12-31" } }).transactions.sort((a, b) => a.occurrenceNumber! - b.occurrenceNumber!);
}

describe("concurrent series revision rebase", () => {
    it("retains a remotely deleted slot when an offline revision moves the series date", () => {
        const remote = { ...base, transactionGroups: [{ ...group, recurrenceRule: { ...group.recurrenceRule!, excludedDates: ["2026-04-05"] } }] };
        const selectedId = occurrenceId(group.id, 3);
        const local = updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(base, selectedId), transactionId: selectedId,
            draft: { scheduledDate: "2026-03-20" }, scope: "this_and_next", wasProjected: true, createGroupId: () => "local-moved" }).snapshot;
        const merged = mergeSupabaseFinanceData({ baseData: data(base), remoteData: data(remote), targetData: data(local) });
        expect(projected(merged).map((row) => [row.occurrenceNumber, row.scheduledDate])).toEqual([
            [1, "2026-01-05"], [2, "2026-02-05"], [3, "2026-03-20"], [5, "2026-05-20"], [6, "2026-06-20"],
        ]);
    });
    it("retains the remote prefix and applies local intent from its boundary without duplicate slots", () => {
        const merged = mergeSupabaseFinanceData({ baseData: data(base), remoteData: data(edit(3, 120, "remote")), targetData: data(edit(5, 150, "local")) });
        expect(projected(merged).map((item) => item.amount)).toEqual([100, 100, 120, 120, 150, 150]);
        expect(new Set(projected(merged).map((item) => item.id)).size).toBe(6);
        expect(merged.transactions).toHaveLength(0);
    });
    it("supersedes a later remote segment when local edits start earlier", () => {
        const merged = mergeSupabaseFinanceData({ baseData: data(base), remoteData: data(edit(5, 120, "remote")), targetData: data(edit(3, 150, "local")) });
        expect(projected(merged).map((item) => item.amount)).toEqual([100, 100, 150, 150, 150, 150]);
    });
    it("preserves a payment committed while the other device was editing the future", () => {
        const id = occurrenceId(group.id, 5);
        const remote = applyTransactionStatus(materializeOccurrence(edit(3, 120, "remote"), id), id, "paid", "2026-02-01T12:00:00Z");
        const merged = mergeSupabaseFinanceData({ baseData: data(base), remoteData: data(remote), targetData: data(edit(3, 150, "local")) });
        expect(merged.transactions).toEqual(remote.transactions);
        expect(projected(merged).map((item) => item.amount)).toEqual([100, 100, 150, 150, 120, 150]);
        expect(merged.ledgerEntries).toHaveLength(1);
        expect(merged.ledgerEntries[0].amount).toBe(-120);
    });
    it("applies a local termination to all remote segments beyond that boundary", () => {
        const target = deleteTransactionsSnapshot(base, occurrenceId(group.id, 4), "this_and_next");
        const merged = mergeSupabaseFinanceData({ baseData: data(base), remoteData: data(edit(5, 120, "remote")), targetData: data(target) });
        expect(projected(merged).map((item) => item.occurrenceNumber)).toEqual([1, 2, 3]);
    });
});
