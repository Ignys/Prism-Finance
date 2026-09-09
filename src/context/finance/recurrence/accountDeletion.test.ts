import { describe, expect, it } from "vitest";
import { fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../financeTestFixtures";
import { permanentlyDeleteWalletData } from "../permanentDeletion";
import { requireRecurrenceRule } from "./rule";
import { occurrenceId, projectOccurrences } from "./projectOccurrences";
import { materializeOccurrence } from "./materializeOccurrence";
import { updateTransactionSeriesSnapshot } from "../transactionSeries/updateTransactionSeriesSnapshot";

describe("permanent account deletion with recurrence overrides", () => {
    it("does not recreate a deleted override, including after changing the series date", () => {
        const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "count", count: 3 } }) });
        const override = fixtureTransaction({ id: occurrenceId(group.id, 2), occurrenceNumber: 2, sourceWalletId: "removed", scheduledDate: "2026-03-20" });
        const initial = fixtureSnapshot([group], [override]);
        initial.wallets.push({ ...fixtureWallet, id: "removed" });
        const pruned = permanentlyDeleteWalletData({ ...initial, walletId: "removed" });
        const snapshot = { ...initial, ...pruned };
        const project = (data: typeof snapshot) => projectOccurrences({ groups: data.transactionGroups, transactions: data.transactions,
            transactionTags: [], creditCards: [], period: { startDate: "2026-01-01", endDate: "2026-12-31" } }).transactions;
        expect(snapshot.transactions).toHaveLength(0);
        expect(project(snapshot).map((row) => row.occurrenceNumber)).toEqual([1, 3]);
        const selectedId = occurrenceId(group.id, 1);
        const updated = updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(snapshot, selectedId), transactionId: selectedId,
            scope: "all", draft: { scheduledDate: "2026-01-10" }, wasProjected: true, now: "2026-01-01T12:00:00Z" }).snapshot;
        expect(project(updated).map((row) => [row.occurrenceNumber, row.scheduledDate])).toEqual([[1, "2026-01-10"], [3, "2026-03-10"]]);
    });
});
