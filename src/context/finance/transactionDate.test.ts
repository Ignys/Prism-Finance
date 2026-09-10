import { describe, expect, it } from "vitest";
import { normalizeCreditCardInvoice, normalizeFinanceSnapshot } from "./financeCore";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction } from "./financeTestFixtures";
import { updateTransactionSeriesSnapshot } from "./transactionSeries/updateTransactionSeriesSnapshot";
import { fromTransactionRow, toTransactionRow } from "../../supabase/finance/financeRowMappers";

describe("transaction date persistence", () => {
    it.each(["income", "expense"] as const)("persists a new %s date through mapping and reload with unrelated card installments present", (type) => {
        const installmentGroup = fixtureGroup({ id: "installments", transactionMode: "installment", installmentCount: 2, creditCardId: fixtureCard.id });
        const transactions = [fixtureTransaction(), ...[1, 2].map((installmentNumber) => fixtureTransaction({ id: `part-${installmentNumber}`, groupId: installmentGroup.id, installmentNumber }))];
        const snapshot = fixtureSnapshot([fixtureGroup({ type }), installmentGroup], transactions);
        const updated = updateTransactionSeriesSnapshot({ snapshot, transactionId: "tx-test", draft: { date: "2026-03-29" }, scope: "single" }).snapshot;
        const reloaded = normalizeFinanceSnapshot({ ...updated, transactions: updated.transactions.map((transaction) => fromTransactionRow(toTransactionRow("user-test", transaction))) }).snapshot;
        expect(reloaded.transactions.find((item) => item.id === "tx-test")?.scheduledDate).toBe("2026-03-29");
    });

    it("recalculates the invoice from the date when no invoice input is submitted", () => {
        const snapshot = fixtureSnapshot([fixtureGroup({ creditCardId: fixtureCard.id })], [fixtureTransaction({ invoiceId: "invoice-card-test-2026-01" })]);
        const updated = updateTransactionSeriesSnapshot({ snapshot, transactionId: "tx-test", draft: { date: "2026-02-15" }, scope: "single" }).snapshot;
        expect(updated.transactions[0].invoiceId).toBe("invoice-card-test-2026-03");
        const reloaded = normalizeFinanceSnapshot(updated).snapshot;
        expect(reloaded.creditCardInvoices.find((invoice) => invoice.id === reloaded.transactions[0].invoiceId)?.cycleKey).toBe("2026-03");
    });

    it("uses the invoice input instead of the date when validating a paid invoice", () => {
        const openInvoiceId = `invoice-${fixtureCard.id}-2026-02`;
        const paidInvoiceId = `invoice-${fixtureCard.id}-2026-01`;
        const transaction = fixtureTransaction({ scheduledDate: "2026-02-05", invoiceId: openInvoiceId });
        const snapshot = {
            ...fixtureSnapshot([fixtureGroup({ creditCardId: fixtureCard.id })], [transaction]),
            creditCardInvoices: [
                normalizeCreditCardInvoice({ id: paidInvoiceId, creditCardId: fixtureCard.id, cycleKey: "2026-01", totalAmount: 100, paidAmount: 100, status: "paid" }, new Set([fixtureCard.id])),
                normalizeCreditCardInvoice({ id: openInvoiceId, creditCardId: fixtureCard.id, cycleKey: "2026-02", totalAmount: 100, paidAmount: 0, status: "open" }, new Set([fixtureCard.id])),
            ],
        };

        const updated = updateTransactionSeriesSnapshot({
            snapshot,
            transactionId: transaction.id,
            draft: { date: "2026-01-05", invoiceId: openInvoiceId },
            scope: "single",
        }).snapshot;

        expect(updated.transactions[0]).toMatchObject({ scheduledDate: "2026-01-05", invoiceId: openInvoiceId });
    });

    it("keeps the selected invoice authoritative when changing a recurring series date", () => {
        const openInvoiceId = `invoice-${fixtureCard.id}-2026-02`;
        const paidInvoiceId = `invoice-${fixtureCard.id}-2026-01`;
        const group = fixtureGroup({
            creditCardId: fixtureCard.id,
            transactionMode: "recurring",
            recurrenceRule: {
                frequency: "monthly",
                interval: 1,
                end: { type: "never" },
                anchorDate: "2026-02-05",
                amount: 100,
                tagIds: [],
                excludedDates: [],
                notes: null,
            },
        });
        const transaction = fixtureTransaction({
            scheduledDate: "2026-02-05",
            occurrenceNumber: 1,
            commitment: "posted",
            invoiceId: openInvoiceId,
        });
        const snapshot = {
            ...fixtureSnapshot([group], [transaction]),
            creditCardInvoices: [
                normalizeCreditCardInvoice({ id: paidInvoiceId, creditCardId: fixtureCard.id, cycleKey: "2026-01", totalAmount: 100, paidAmount: 100, status: "paid" }, new Set([fixtureCard.id])),
                normalizeCreditCardInvoice({ id: openInvoiceId, creditCardId: fixtureCard.id, cycleKey: "2026-02", totalAmount: 100, paidAmount: 0, status: "open" }, new Set([fixtureCard.id])),
            ],
        };

        const updated = updateTransactionSeriesSnapshot({
            snapshot,
            transactionId: transaction.id,
            draft: { date: "2026-01-05", invoiceId: openInvoiceId },
            scope: "all",
            now: "2026-01-01T12:00:00.000Z",
            createGroupId: () => "group-revised",
        }).snapshot;

        expect(updated.transactions[0]).toMatchObject({ scheduledDate: "2026-01-05", invoiceId: openInvoiceId });
    });

    it("retains individual overrides and the effective settlement timestamp on reload", () => {
        const transaction = fixtureTransaction({ title: "Override", notes: "Detalhes", sourceWalletId: "wallet-test", paidAt: "2026-08-01T12:00:00Z", status: "paid" });
        const reloaded = normalizeFinanceSnapshot(fixtureSnapshot([fixtureGroup()], [transaction])).snapshot;
        expect(reloaded.transactions[0]).toMatchObject(transaction);
        expect(reloaded.ledgerEntries[0].createdAt).toBe("2026-08-01T12:00:00.000Z");
    });
});
