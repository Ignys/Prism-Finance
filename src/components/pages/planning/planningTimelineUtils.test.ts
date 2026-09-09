import { afterEach, describe, expect, it, vi } from "vitest";
import { createLedgerEntriesForPaidTransaction, toTransactionList } from "../../../context/finance/financeCore";
import { fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../../../context/finance/financeTestFixtures";
import { buildTimelineProjection } from "./planningTimelineUtils";

afterEach(() => vi.useRealTimers());

function project(scheduledDate: string, paidAt: string | null, isNonCashSettlement = false) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
    const group = fixtureGroup();
    const stored = fixtureTransaction({ scheduledDate, paidAt, status: paidAt ? "paid" : "pending" });
    const transaction = toTransactionList([stored], [group], [], [], [], [])[0];
    return buildTimelineProjection({
        wallets: [fixtureWallet], creditCards: [], creditCardInvoices: [],
        transactions: [{ ...transaction, isNonCashSettlement }],
        ledgerEntries: isNonCashSettlement ? [] : createLedgerEntriesForPaidTransaction(stored, group),
        wishItems: [], planning: fixtureSnapshot().planning, monthsToShow: 3,
    });
}

describe("planning cash timeline", () => {
    it("does not subtract a payment again when it already reduced the opening balance", () => {
        const result = project("2026-02-20", "2026-01-25T12:00:00Z");
        expect(result.openingBalance).toBe(900);
        expect(result.months[0].walletSpendings).toBe(0);
        expect(result.months[0].currentAccumulated).toBe(900);
    });

    it("includes an overdue transaction in the month it was actually paid", () => {
        const result = project("2026-01-20", "2026-02-10T12:00:00Z");
        expect(result.openingBalance).toBe(1000);
        expect(result.months[0].walletSpendings).toBe(100);
        expect(result.months[0].currentAccumulated).toBe(900);
    });

    it("keeps pending expenses on their scheduled month", () => {
        expect(project("2026-02-20", null).months[0].walletSpendings).toBe(100);
    });

    it("excludes manual invoice settlement without wallet movement", () => {
        const result = project("2026-02-20", "2026-02-20T12:00:00Z", true);
        expect(result.months[0].inheritedItems).toEqual([]);
        expect(result.months[0].currentAccumulated).toBe(1000);
    });
});
