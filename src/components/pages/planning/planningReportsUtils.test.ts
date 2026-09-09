import { describe, expect, it } from "vitest";
import { normalizeCreditCardInvoice, toTransactionList } from "../../../context/finance/financeCore";
import { fixtureCard, fixtureGroup, fixtureTransaction } from "../../../context/finance/financeTestFixtures";
import type { Transaction } from "../../../context/finance/domainTypes";
import { buildReportsDataset } from "./planningReportsUtils";

const base = toTransactionList([fixtureTransaction()], [fixtureGroup()], [], [], [], [])[0];
const invoice = normalizeCreditCardInvoice({ id: "invoice", creditCardId: fixtureCard.id, cycleKey: "2026-01", totalAmount: 0.06 }, new Set([fixtureCard.id]));

function purchase(id: string, value: number, commitment: Transaction["commitment"] = "posted"): Transaction {
    return { ...base, id, value, commitment, invoiceId: invoice.id, paymentMethod: "credit_card",
        beneficiary: id, category: { ...base.category, id, label: id } };
}

function report(paymentValue: number, purchases: Transaction[]) {
    const payment: Transaction = { ...base, id: "payment", value: paymentValue, status: "paid", systemKind: "invoice_payment",
        invoicePaymentMeta: { invoiceId: invoice.id, creditCardId: fixtureCard.id } };
    return buildReportsDataset({ startMonth: "2026-01", endMonth: "2026-01" }, [payment], [invoice], purchases);
}

describe("invoice payment reports", () => {
    it("does not report a manual close without wallet movement as spending", () => {
        const manual = { ...base, status: "paid" as const, systemKind: "invoice_payment" as const, paymentForInvoiceId: invoice.id, isNonCashSettlement: true };
        const result = buildReportsDataset({ startMonth: "2026-01", endMonth: "2026-01" }, [manual], [invoice]);
        expect(result.summary.spending).toBe(0);
        expect(result.summary.transactionCount).toBe(0);
        expect(result.categoryReports).toEqual([]);
    });
    it("conserves a partial payment when individual rounding would overallocate cents", () => {
        const result = report(0.03, Array.from({ length: 6 }, (_, index) => purchase(`purchase-${index}`, 0.01)));
        expect(result.summary.spending).toBe(0.03);
        expect(result.categoryReports.reduce((sum, row) => sum + Math.round(row.totalAmount * 100), 0)).toBe(3);
        expect(result.beneficiaryReports.reduce((sum, row) => sum + Math.round(row.totalAmount * 100), 0)).toBe(3);
        expect(result.categoryReports.every((row) => row.totalAmount > 0)).toBe(true);
    });

    it("excludes recurring forecasts from the allocation of an actual payment", () => {
        const result = report(0.03, [purchase("posted", 0.06), purchase("forecast", 100, "forecast")]);
        expect(result.categoryReports.map((row) => [row.label, row.totalAmount])).toEqual([["posted", 0.03]]);
        expect(result.beneficiaryReports.map((row) => [row.name, row.totalAmount])).toEqual([["posted", 0.03]]);
    });

    it("keeps payments with unavailable purchase history in their own category", () => {
        const result = report(0.03, []);
        expect(result.categoryReports[0].totalAmount).toBe(0.03);
        expect(result.summary.methodReports.find((row) => row.key === "invoice_payment")?.amount).toBe(0.03);
    });
});
