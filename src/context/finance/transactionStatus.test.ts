import { describe, expect, it } from "vitest";
import { toTransactionList } from "./financeCore";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction } from "./financeTestFixtures";
import { applyTransactionStatus } from "./transactionStatus";
import { buildTransactionContextActions } from "../../components/transactions/transactionContextActions";

describe("wallet settlement actions", () => {
    it.each(["income", "expense"] as const)("settles a pending %s today exactly once and keeps its scheduled date", (type) => {
        const snapshot = fixtureSnapshot([fixtureGroup({ type })]);
        const paidAt = "2026-09-05T01:30:00.000Z";
        const paid = applyTransactionStatus(snapshot, "tx-test", "paid", paidAt);
        expect(paid.transactions[0]).toMatchObject({ scheduledDate: "2026-01-05", paidAt, status: "paid" });
        expect(paid.ledgerEntries).toHaveLength(1);
        expect(paid.ledgerEntries[0]).toMatchObject({ amount: type === "income" ? 100 : -100, createdAt: paidAt });
        expect(applyTransactionStatus(paid, "tx-test", "paid", "2026-09-06T12:00:00Z")).toBe(paid);
        const transaction = toTransactionList(snapshot.transactions, snapshot.transactionGroups, [], [], [], [])[0];
        expect(buildTransactionContextActions({ transaction, group: snapshot.transactionGroups[0] })).toContainEqual({
            id: "pay_today", label: type === "income" ? "Marcar como recebida hoje" : "Marcar como paga hoje", nextStatus: "paid",
        });
    });

    it("moves a pay-today occurrence to the effective date and records the timestamp", () => {
        const snapshot = fixtureSnapshot();
        const paidAt = "2026-09-05T01:30:00.000Z";
        const paid = applyTransactionStatus(snapshot, "tx-test", "paid", paidAt, "2026-09-04");
        expect(paid.transactions[0]).toMatchObject({ scheduledDate: "2026-09-04", paidAt, status: "paid" });
        expect(paid.ledgerEntries[0]).toMatchObject({ transactionId: "tx-test", createdAt: paidAt });
    });

    it("does not offer settlement for paid, skipped, transfer, card or invoice-payment transactions", () => {
        const snapshot = fixtureSnapshot();
        const transaction = toTransactionList(snapshot.transactions, snapshot.transactionGroups, [], [], [], [])[0];
        const cases = [
            { ...transaction, status: "paid" as const }, { ...transaction, status: "skipped" as const },
            { ...transaction, type: "transfer" as const }, { ...transaction, paymentMethod: "credit_card" as const },
            { ...transaction, systemKind: "invoice_payment" as const },
        ];
        for (const item of cases) expect(buildTransactionContextActions({ transaction: item, group: undefined }).some((action) => action.id === "pay_today")).toBe(false);
        const cardSnapshot = fixtureSnapshot([fixtureGroup({ creditCardId: fixtureCard.id })]);
        expect(() => applyTransactionStatus(cardSnapshot, "tx-test", "paid")).toThrow("fatura");
        const paymentSnapshot = fixtureSnapshot([fixtureGroup()], [fixtureTransaction({ paymentForInvoiceId: "invoice-test" })]);
        expect(() => applyTransactionStatus(paymentSnapshot, "tx-test", "paid")).toThrow("fatura");
    });

    it("offers navigation between both representations of an invoice payment", () => {
        const snapshot = fixtureSnapshot([fixtureGroup()], [fixtureTransaction({ paymentForInvoiceId: "invoice-test" })]);
        const payment = toTransactionList(snapshot.transactions, snapshot.transactionGroups, [], [], [], [])[0];
        expect(buildTransactionContextActions({ transaction: payment, group: snapshot.transactionGroups[0] })).toContainEqual({
            id: "view_invoice", label: "Ver na fatura",
        });
        expect(buildTransactionContextActions({ transaction: payment, group: snapshot.transactionGroups[0], context: "invoice" })).toContainEqual({
            id: "view_expenses", label: "Ver nas despesas",
        });
    });
});
