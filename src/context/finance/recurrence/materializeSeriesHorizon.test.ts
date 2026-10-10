import { describe, expect, it } from "vitest";
import { fixtureGroup, fixtureSnapshot, fixtureTransaction } from "../financeTestFixtures";
import { applyTransactionStatus } from "../transactionStatus";
import { materializeSeriesHorizon, recurringSeriesIdsOf } from "./materializeSeriesHorizon";
import { occurrenceId } from "./projectOccurrences";
import { requireRecurrenceRule } from "./rule";

const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-10-10", amount: 103.4, excludedDates: ["2027-01-10"] }) });
const first = fixtureTransaction({ id: occurrenceId(group.id, 1), groupId: group.id, occurrenceNumber: 1, scheduledDate: "2026-10-10", amount: 103.4, status: "pending" });

describe("materializeSeriesHorizon", () => {
    it("stores a never-ending series through the planning horizon, skipping excluded and existing occurrences", () => {
        const next = materializeSeriesHorizon(fixtureSnapshot([group], [first]), "2026-09-30");
        const numbers = next.transactions.map((item) => item.occurrenceNumber);
        // Horizon ends 2027-09-30: occurrences 1..12, minus the excluded 2027-01-10 (#4).
        expect(numbers).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(next.transactions.every((item) => !("isProjected" in item))).toBe(true);
        expect(materializeSeriesHorizon(next, "2026-09-30")).toBe(next);
    });

    it("rolls forward after a status change as months enter the horizon", () => {
        const stored = materializeSeriesHorizon(fixtureSnapshot([group], [first]), "2026-09-30");
        const paid = applyTransactionStatus(stored, first.id, "paid", "2026-10-10T12:00:00.000Z");
        const next = materializeSeriesHorizon(paid, "2026-10-10", recurringSeriesIdsOf(paid, [first.id]));
        expect(next.transactions[next.transactions.length - 1]).toMatchObject({ occurrenceNumber: 13, scheduledDate: "2027-10-10", status: "pending" });
        expect(materializeSeriesHorizon(paid, "2026-10-10", new Set(["other-series"]))).toBe(paid);
    });
});
