import { describe, expect, it } from "vitest";
import { createLedgerEntriesForPaidTransaction, normalizeCreditCardInvoice } from "../financeCore";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../financeTestFixtures";
import { deleteTransactionsSnapshot } from "./deleteTransactions";

describe("installment deletion", () => {
    it("removes mutable wallet installments while preserving paid history and ledger", () => {
        const group = fixtureGroup({ transactionMode: "installment", installmentCount: 3, totalAmount: 300 });
        const paid = fixtureTransaction({ id: "installment-1", installmentNumber: 1, status: "paid", paidAt: "2026-01-05T12:00:00Z" });
        const pending = [2, 3].map((number) => fixtureTransaction({ id: `installment-${number}`, installmentNumber: number,
            scheduledDate: `2026-0${number}-05` }));
        const snapshot = fixtureSnapshot([group], [paid, ...pending]);
        snapshot.ledgerEntries = createLedgerEntriesForPaidTransaction(paid, group);

        const result = deleteTransactionsSnapshot(snapshot, paid.id, "all", "2026-01-10");

        expect(result.transactions).toEqual([paid]);
        expect(result.ledgerEntries).toEqual(snapshot.ledgerEntries);
        expect(result.transactionGroups[0]).toMatchObject({ installmentCount: 1, totalAmount: 100 });
        expect(result.wallets[0]).toEqual(fixtureWallet);
    });

    it("does not erase posted card commitments through a bulk deletion", () => {
        const group = fixtureGroup({ transactionMode: "installment", installmentCount: 3, totalAmount: 300,
            sourceWalletId: null, creditCardId: fixtureCard.id });
        const transactions = [1, 2, 3].map((number) => fixtureTransaction({ id: `installment-${number}`, installmentNumber: number,
            scheduledDate: "2026-01-05", invoiceId: `invoice-${fixtureCard.id}-2026-0${number + 1}`, commitment: "posted" }));
        const snapshot = fixtureSnapshot([group], transactions);
        snapshot.creditCardInvoices = transactions.map((transaction, index) => normalizeCreditCardInvoice({ id: transaction.invoiceId!,
            creditCardId: fixtureCard.id, cycleKey: `2026-0${index + 2}`, totalAmount: 100 }, new Set([fixtureCard.id])));

        const result = deleteTransactionsSnapshot(snapshot, transactions[0].id, "all", "2026-01-10");

        expect(result.transactions.map((row) => row.id)).toEqual(transactions.map((row) => row.id));
        expect(result.creditCardInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)).toBe(300);
    });
});
