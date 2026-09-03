import { describe, expect, it } from "vitest";
import { buildInvoiceSettlement } from "./invoiceSettlement";
import { createLedgerEntriesForPaidTransaction, type Category, type CreditCardInvoice } from "../financeTypes";

const invoice: CreditCardInvoice = {
    id: "invoice-1",
    creditCardId: "card-1",
    cycleKey: "2026-09",
    closingDate: "2026-09-10",
    dueDate: "2026-09-17",
    totalAmount: 100,
    paidAmount: 25,
    status: "open",
    paidAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
};

const category: Category = {
    id: "system-category-expense-card-invoice",
    userId: null,
    parentId: null,
    name: "Fatura do Cartão",
    type: "expense",
    icon: "credit-card",
    color: null,
    isActive: true,
    isSystem: false,
    sortOrder: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
};

describe("buildInvoiceSettlement", () => {
    it("represents a manual close as a linked payment transaction", () => {
        const result = buildInvoiceSettlement({
            invoiceIds: [invoice.id],
            markAsPaid: true,
            userId: "user-1",
            invoices: [invoice],
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            beneficiaries: [],
            categories: [category],
            nowIso: "2026-09-02T12:00:00.000Z",
        });

        expect(result.changed).toBe(true);
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0]?.amount).toBe(75);
        expect(result.transactions[0]?.paymentForInvoiceId).toBe(invoice.id);
        expect(result.transactions[0]?.notes).toContain(`|${invoice.id}|${invoice.creditCardId}`);
        expect(result.transactionGroups[0]?.sourceWalletId).toBeNull();
        expect(createLedgerEntriesForPaidTransaction(result.transactions[0]!, result.transactionGroups[0]!)).toEqual([]);
        expect(result.invoices[0]).toMatchObject({ paidAmount: 100, status: "paid" });
    });

    it("reopens an invoice by deleting its linked settlements and ledger projections", () => {
        const closed = buildInvoiceSettlement({
            invoiceIds: [invoice.id],
            markAsPaid: true,
            userId: "user-1",
            invoices: [invoice],
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            beneficiaries: [],
            categories: [category],
            nowIso: "2026-09-02T12:00:00.000Z",
        });
        const transactionId = closed.transactions[0]!.id;
        const reopened = buildInvoiceSettlement({
            invoiceIds: [invoice.id],
            markAsPaid: false,
            userId: "user-1",
            invoices: closed.invoices,
            transactionGroups: closed.transactionGroups,
            transactions: closed.transactions,
            ledgerEntries: [
                {
                    id: "ledger-1",
                    walletId: "wallet-1",
                    transactionId,
                    invoiceId: null,
                    amount: -75,
                    balanceAfter: 0,
                    description: "legacy",
                    createdAt: "2026-09-02T12:00:00.000Z",
                },
            ],
            beneficiaries: [],
            categories: [category],
            nowIso: "2026-09-03T12:00:00.000Z",
        });

        expect(reopened.changed).toBe(true);
        expect(reopened.transactions).toHaveLength(0);
        expect(reopened.transactionGroups).toHaveLength(0);
        expect(reopened.ledgerEntries).toHaveLength(0);
        expect(reopened.invoices[0]).toMatchObject({ paidAmount: 0, status: "open", paidAt: null });
    });
});
