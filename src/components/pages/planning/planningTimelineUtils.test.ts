import { afterEach, describe, expect, it, vi } from "vitest";
import { createLedgerEntriesForPaidTransaction, normalizeCreditCardInvoice, normalizePlanningState, toTransactionList } from "../../../context/finance/financeCore";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../../../context/finance/financeTestFixtures";
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

describe("planning installment projection", () => {
    it("splits an installment expense across consecutive months, keeping the series id", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
        const planning = normalizePlanningState({
            simulatedExpenses: [{ id: "tv", monthKey: "2026-03", description: "TV", amount: 100, installmentCount: 3, createdAt: "2026-02-01T00:00:00Z" }],
        });
        const result = buildTimelineProjection({
            wallets: [fixtureWallet], creditCards: [], creditCardInvoices: [], transactions: [], ledgerEntries: [],
            wishItems: [], planning, monthsToShow: 6,
        });
        const items = result.months.map((month) => month.simulatedExpenseItems.map(({ id, amount, installmentNumber }) => ({ id, amount, installmentNumber })));
        expect(items.slice(0, 5)).toEqual([
            [],
            [{ id: "tv", amount: 33.34, installmentNumber: 1 }],
            [{ id: "tv", amount: 33.33, installmentNumber: 2 }],
            [{ id: "tv", amount: 33.33, installmentNumber: 3 }],
            [],
        ]);
        expect(result.months[1].simulatedExpenses).toBe(33.34);
    });
});

describe("planning invoice month override", () => {
    it("charges the invoice in the overridden month instead of its due month", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
        const invoice = normalizeCreditCardInvoice({ id: "inv", creditCardId: fixtureCard.id, cycleKey: "2026-03", dueDate: "2026-03-17", totalAmount: 500 }, new Set([fixtureCard.id]));
        const project = (invoiceMonthOverrides: Record<string, string>) =>
            buildTimelineProjection({
                wallets: [fixtureWallet], creditCards: [fixtureCard], creditCardInvoices: [invoice], transactions: [], ledgerEntries: [],
                wishItems: [], planning: normalizePlanningState({ invoiceMonthOverrides }), monthsToShow: 6,
            }).months;

        expect(project({}).slice(0, 4).map((month) => month.invoiceSpendings)).toEqual([0, 500, 0, 0]);
        const moved = project({ inv: "2026-04" });
        expect(moved.slice(0, 4).map((month) => month.invoiceSpendings)).toEqual([0, 0, 500, 0]);
        // Fantasma no mês do vencimento, fora dos totais.
        expect(moved[1].movedInvoiceItems.map(({ invoiceId, movedToMonthKey, amount }) => ({ invoiceId, movedToMonthKey, amount }))).toEqual([
            { invoiceId: "inv", movedToMonthKey: "2026-04", amount: 500 },
        ]);
        expect(moved[1].inheritedItems).toEqual([]);
        expect(moved[2].movedInvoiceItems).toEqual([]);
    });
});
