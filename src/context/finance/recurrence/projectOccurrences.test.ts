import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureTransaction } from "../financeTestFixtures";
import { requireRecurrenceRule } from "./rule";
import { projectOccurrences } from "./projectOccurrences";

const rule = requireRecurrenceRule({ anchorDate: "2026-01-31", amount: 100 });
const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: rule });
const params = { groups: [group], transactions: [], transactionTags: [], creditCards: [fixtureCard], period: { startDate: "2026-01-01", endDate: "2026-12-31" } };

describe("recurrence projections", () => {
    it("projects indefinite fixed values without writing rows or accumulating month-end drift", () => {
        const before = JSON.stringify(params);
        const result = projectOccurrences(params);
        expect(result.transactions).toHaveLength(12);
        expect(result.transactions.slice(0, 3).map((item) => item.scheduledDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
        expect(JSON.stringify(params)).toBe(before);
        expect(projectOccurrences({ ...params, period: { startDate: "2040-01-01", endDate: "2040-01-31" } }).transactions).toHaveLength(1);
    });

    it("repeats R$100 six times, without dividing the amount", () => {
        const result = projectOccurrences({ ...params, groups: [{ ...group, recurrenceRule: { ...rule, end: { type: "count", count: 6 } } }] });
        expect(result.transactions.map((item) => item.amount)).toEqual([100, 100, 100, 100, 100, 100]);
    });

    it("masks moved overrides and skipped occurrences by stable ordinal", () => {
        const transactions = [fixtureTransaction({ occurrenceNumber: 1, scheduledDate: "2027-01-02" }), fixtureTransaction({ id: "skip", occurrenceNumber: 2, status: "skipped", scheduledDate: "2026-02-28" })];
        const result = projectOccurrences({ ...params, transactions });
        expect(result.transactions.filter((item) => item.isProjected)).toHaveLength(10);
        expect(result.transactions.some((item) => item.isProjected && (item.occurrenceNumber ?? 0) < 3)).toBe(false);
    });

    it("projects future card charges as forecasts with deterministic invoice cycles", () => {
        const result = projectOccurrences({ ...params, groups: [{ ...group, creditCardId: fixtureCard.id }] });
        expect(result.transactions.every((item) => item.commitment === "forecast" && item.isProjected)).toBe(true);
        expect(result.transactions[0].invoiceId).toBe(`invoice-${fixtureCard.id}-2026-02`);
    });

    it("validates finite rules and honors skips and until dates", () => {
        expect(() => requireRecurrenceRule({ ...rule, end: { type: "count", count: 0 } })).toThrow();
        expect(() => requireRecurrenceRule({ ...rule, anchorDate: "2026-02-30" })).toThrow();
        expect(() => requireRecurrenceRule({ ...rule, amount: 0.001 })).toThrow();
        const result = projectOccurrences({ ...params, groups: [{ ...group, recurrenceRule: { ...rule, end: { type: "until", date: "2026-03-31" }, excludedDates: ["2026-02-28"] } }] });
        expect(result.transactions.map((item) => item.scheduledDate)).toEqual(["2026-01-31", "2026-03-31"]);
    });
});
