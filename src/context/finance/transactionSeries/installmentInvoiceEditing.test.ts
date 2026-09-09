import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../financeTestFixtures";
import { normalizeCreditCardInvoice, normalizeFinanceSnapshot, resolveTransactionCreditCardId } from "../financeCore";
import { toTransactionRow, fromTransactionRow } from "../../../supabase/finance/financeRowMappers";
import { updateTransactionSeriesSnapshot } from "./updateTransactionSeriesSnapshot";

const secondCard = { ...fixtureCard, id: "second-card", closingDay: 20 };
const group = fixtureGroup({ transactionMode: "installment", installmentCount: 3, totalAmount: 300, creditCardId: fixtureCard.id, sourceWalletId: null });
const transactions = [1, 2, 3].map((number) => fixtureTransaction({ id: `parcel-${number}`, installmentNumber: number,
    scheduledDate: "2026-01-15", invoiceId: `invoice-${fixtureCard.id}-2026-0${number + 1}`, commitment: "posted" }));
const invoices = [1, 2, 3, 4].map((month) => normalizeCreditCardInvoice({ id: `custom-${month}`, creditCardId: secondCard.id,
    cycleKey: `2026-0${month}`, totalAmount: 0 }, new Set([secondCard.id])));
const snapshot = { ...fixtureSnapshot([group], transactions), creditCards: [fixtureCard, secondCard], creditCardInvoices: invoices };

describe("installment invoice editing", () => {
    it("clears inherited card routing for one installment through mapper and reload", () => {
        const result = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[1].id, scope: "single",
            draft: { paymentMethod: "wallet", walletId: fixtureWallet.id } });
        const converted = result.snapshot.transactions[1];
        expect(converted).toMatchObject({ routingOverride: true, creditCardId: null, invoiceId: null, sourceWalletId: fixtureWallet.id });
        const mapped = fromTransactionRow(toTransactionRow("owner", converted));
        expect(resolveTransactionCreditCardId(mapped, group)).toBeNull();
        const reloaded = normalizeFinanceSnapshot({ ...result.snapshot, transactions: result.snapshot.transactions.map((row) => row.id === converted.id ? mapped : row) }).snapshot;
        expect(resolveTransactionCreditCardId(reloaded.transactions.find((row) => row.id === converted.id)!, group)).toBeNull();
        expect(result.snapshot.transactions[0]).toEqual(transactions[0]);
        expect(result.snapshot.transactions[2]).toEqual(transactions[2]);
    });
    it("converts the purchase to monthly wallet installments without losing installment identity", () => {
        const result = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[1].id, scope: "all",
            draft: { paymentMethod: "wallet", walletId: fixtureWallet.id } });
        expect(result.snapshot.transactions.map((row) => [row.installmentNumber, row.scheduledDate, resolveTransactionCreditCardId(row, group)])).toEqual([
            [1, "2026-01-15", null], [2, "2026-02-15", null], [3, "2026-03-15", null],
        ]);
    });
    it("preserves sibling routing overrides when changing only the description of all installments", () => {
        const converted = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[1].id, scope: "single",
            draft: { paymentMethod: "wallet", walletId: fixtureWallet.id } }).snapshot;
        const updated = updateTransactionSeriesSnapshot({ snapshot: converted, transactionId: transactions[1].id, scope: "all",
            draft: { description: "Updated purchase" } }).snapshot;
        expect(updated.transactions.map((row) => resolveTransactionCreditCardId(row, group))).toEqual([fixtureCard.id, null, fixtureCard.id]);
        expect(updated.transactions.map((row) => row.title)).toEqual(Array(3).fill("Updated purchase"));
    });
    it("reassigns every installment on a card change without a date change", () => {
        const result = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[0].id, scope: "all",
            draft: { paymentMethod: "credit_card", creditCardId: secondCard.id } });
        expect(result.snapshot.transactions.map((row) => row.invoiceId)).toEqual(["custom-2", "custom-3", "custom-4"]);
        expect(result.snapshot.transactions.map((row) => row.scheduledDate)).toEqual(Array(3).fill("2026-01-15"));
    });

    it("uses an explicitly selected cycle as the anchor for subsequent installments", () => {
        const result = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[1].id, scope: "this_and_next",
            draft: { paymentMethod: "credit_card", creditCardId: secondCard.id, invoiceId: "custom-3" } });
        expect(result.snapshot.transactions.map((row) => row.invoiceId)).toEqual([transactions[0].invoiceId, "custom-3", "custom-4"]);
        expect(result.snapshot.transactions[0]).toEqual(transactions[0]);
    });
    it("anchors automatic cycles to the purchase even when editing from the second installment", () => {
        const result = updateTransactionSeriesSnapshot({ snapshot, transactionId: transactions[1].id, scope: "all",
            draft: { paymentMethod: "credit_card", creditCardId: secondCard.id } });
        expect(result.snapshot.transactions.map((row) => row.invoiceId)).toEqual(["custom-2", "custom-3", "custom-4"]);
    });
});
