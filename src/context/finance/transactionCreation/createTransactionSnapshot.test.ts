import { describe, expect, it } from "vitest";
import { createTransactionSnapshot } from "./createTransactionSnapshot";
import { fixtureCard, fixtureSnapshot, fixtureWallet } from "../financeTestFixtures";
import { projectOccurrences } from "../recurrence/projectOccurrences";
import type { TransactionDraft } from "../domainTypes";

const options = { userId: "user-test", now: "2026-01-01T12:00:00.000Z" };
const draft: TransactionDraft = { id: "new", groupId: "new-group", type: "spending", amount: 100, scheduledDate: "2026-01-05", walletId: fixtureWallet.id, status: "pending" };
const empty = () => fixtureSnapshot([], []);

describe("transaction creation through the domain entry point", () => {
    it("uses submitted creation values instead of stale recurring metadata", () => {
        const created = createTransactionSnapshot(empty(), { ...draft, transactionMode: "recurring", recurrenceRule: {
            seriesId: "unrelated-series", anchorDate: "2020-01-01", amount: 500, startNumber: 8, stopNumber: 9, creditCardId: "missing-card",
            end: { type: "count", count: 6 },
        } }, options);
        expect(created.transactionGroups[0].recurrenceRule).toMatchObject({ seriesId: draft.groupId, anchorDate: draft.scheduledDate, amount: 100,
            startNumber: 1, creditCardId: null, end: { type: "count", count: 6 } });
        expect(created.transactionGroups[0].recurrenceRule?.stopNumber).toBeUndefined();
    });
    it("rejects invalid card selection instead of silently using another card or wallet", () => {
        expect(() => createTransactionSnapshot(empty(), { ...draft, paymentMethod: "credit_card", creditCardId: "missing" }, options)).toThrow(/cartão válido/);
        expect(() => createTransactionSnapshot({ ...empty(), creditCards: [] }, { ...draft, paymentMethod: "credit_card" }, options)).toThrow(/cartão válido/);
    });
    it("materializes only the first forecast when a different invoice cycle is explicitly selected", () => {
        const invoiceId = `invoice-${fixtureCard.id}-2026-03`;
        const created = createTransactionSnapshot(empty(), { ...draft, paymentMethod: "credit_card", creditCardId: fixtureCard.id,
            transactionMode: "recurring", invoiceId }, options);
        expect(created.transactions).toHaveLength(1);
        expect(created.transactions[0]).toMatchObject({ occurrenceNumber: 1, invoiceId, commitment: "forecast", amount: 100 });
        expect(created.creditCardInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)).toBe(0);
        const projected = projectOccurrences({ groups: created.transactionGroups, transactions: created.transactions, transactionTags: [],
            creditCards: created.creditCards, period: { startDate: "2026-01-01", endDate: "2026-03-31" } });
        expect(projected.transactions).toHaveLength(3);
    });
    it("creates only the rule for a fixed wallet or future card recurrence", () => {
        for (const paymentMethod of ["wallet", "credit_card"] as const) {
            const created = createTransactionSnapshot(empty(), { ...draft, paymentMethod, creditCardId: fixtureCard.id, transactionMode: "recurring" }, options);
            expect(created.transactions).toHaveLength(0);
            expect(created.transactionGroups).toHaveLength(1);
            expect(created.transactionGroups[0].recurrenceRule).toMatchObject({ amount: 100, end: { type: "never" } });
            expect(created.creditCardInvoices.reduce((sum, item) => sum + item.totalAmount, 0)).toBe(0);
        }
    });
    it("distinguishes six whole recurring amounts from a six-part purchase and is idempotent", () => {
        const recurringDraft = { ...draft, transactionMode: "recurring" as const, recurrenceRule: { end: { type: "count" as const, count: 6 } } };
        const recurring = createTransactionSnapshot(empty(), recurringDraft, options);
        const projected = projectOccurrences({ groups: recurring.transactionGroups, transactions: recurring.transactions, transactionTags: [], creditCards: [], period: { startDate: "2026-01-01", endDate: "2026-12-31" } });
        expect(projected.transactions.map((item) => item.amount)).toEqual([100, 100, 100, 100, 100, 100]);
        expect(createTransactionSnapshot(recurring, recurringDraft, options)).toBe(recurring);
        const installmentDraft = { ...draft, amount: 600, transactionMode: "installment" as const, installmentCount: 6, paymentMethod: "credit_card" as const, creditCardId: fixtureCard.id };
        const installments = createTransactionSnapshot(empty(), installmentDraft, options);
        expect(installments.transactions.map((item) => item.amount)).toEqual([100, 100, 100, 100, 100, 100]);
        expect(new Set(installments.transactions.map((item) => item.invoiceId)).size).toBe(6);
        expect(installments.creditCardInvoices.reduce((sum, item) => sum + item.totalAmount, 0)).toBe(600);
        expect(createTransactionSnapshot(installments, installmentDraft, options)).toBe(installments);
    });
    it("posts a card occurrence created on its effective date and rejects invalid dates and individual card settlement", () => {
        const cardDraft = { ...draft, scheduledDate: "2026-01-01", paymentMethod: "credit_card" as const, creditCardId: fixtureCard.id, transactionMode: "recurring" as const };
        const created = createTransactionSnapshot(empty(), cardDraft, options);
        expect(created.transactions).toHaveLength(1);
        expect(created.transactions[0].commitment).toBe("posted");
        expect(created.creditCardInvoices[0].totalAmount).toBe(100);
        expect(created.ledgerEntries).toHaveLength(0);
        expect(() => createTransactionSnapshot(empty(), { ...draft, date: "2026-02-30", scheduledDate: "2026-02-30" }, options)).toThrow();
        expect(() => createTransactionSnapshot(empty(), { ...cardDraft, status: "paid" }, options)).toThrow(/fatura/);
    });

    it("keeps an individual card expense forecast out of the invoice until it is posted", () => {
        const cardDraft = { ...draft, paymentMethod: "credit_card" as const, creditCardId: fixtureCard.id };
        const forecast = createTransactionSnapshot(empty(), { ...cardDraft, commitment: "forecast" }, options);
        const posted = createTransactionSnapshot(empty(), { ...cardDraft, commitment: "posted" }, options);
        expect(forecast.transactions[0].commitment).toBe("forecast");
        expect(forecast.creditCardInvoices[0].totalAmount).toBe(0);
        expect(posted.transactions[0].commitment).toBe("posted");
        expect(posted.creditCardInvoices[0].totalAmount).toBe(100);
    });
});
