import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureTransaction } from "../../context/finance/financeTestFixtures";
import { requireRecurrenceRule } from "../../context/finance/recurrence/rule";
import { buildTransactionSeriesView } from "./transactionSeriesView";

const base = { creditCards: [fixtureCard], today: "2026-01-15" };

describe("buildTransactionSeriesView", () => {
    it("lists every installment of the group in date order", () => {
        const group = fixtureGroup({ transactionMode: "installment", installmentCount: 3, totalAmount: 300 });
        const transactions = [3, 1, 2].map((number) => fixtureTransaction({ id: `tx-${number}`, installmentNumber: number, amount: 100, scheduledDate: `2026-0${number}-05`, status: number === 1 ? "paid" : "pending" }));
        const view = buildTransactionSeriesView({ groupId: group.id, groups: [group], storedTransactions: transactions, ...base })!;

        expect(view.rows.map((row) => row.number)).toEqual([1, 2, 3]);
        expect(view.hasMore).toBe(false);
        expect(view.totals).toMatchObject({ count: 3, projectedCount: 0, paidAmount: 100, pendingAmount: 200, totalAmount: 300 });
    });

    it("projects a fixed monthly series up to the window and flags that it continues", () => {
        const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100 }) });
        const view = buildTransactionSeriesView({ groupId: group.id, groups: [group], storedTransactions: [fixtureTransaction({ occurrenceNumber: 1, status: "paid" })], ...base })!;

        expect(view.rows).toHaveLength(13);
        expect(view.rows[0]).toMatchObject({ number: 1, projected: false, status: "paid" });
        expect(view.rows[view.rows.length - 1]).toMatchObject({ number: 13, projected: true, date: "2027-01-05" });
        expect(view.hasMore).toBe(true);
    });

    it("stops the window when the rule ends and keeps both segments of a split series", () => {
        const rule = requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "count", count: 3 } });
        const first = fixtureGroup({ id: "group-a", transactionMode: "recurring", recurrenceRule: { ...rule, seriesId: "series-1", stopNumber: 1 } });
        const second = fixtureGroup({ id: "group-b", transactionMode: "recurring", recurrenceRule: { ...rule, seriesId: "series-1", startNumber: 2, amount: 250 } });
        const view = buildTransactionSeriesView({ groupId: second.id, groups: [first, second], storedTransactions: [], ...base })!;

        expect(view.segments.map((segment) => segment.id)).toEqual(["group-a", "group-b"]);
        expect(view.rows.map((row) => row.amount)).toEqual([100, 250, 250]);
        expect(view.hasMore).toBe(false);
    });
});
