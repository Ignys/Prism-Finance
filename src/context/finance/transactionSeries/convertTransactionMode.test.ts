import { describe, expect, it } from "vitest";
import { fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "../financeTestFixtures";
import { normalizeCreditCardInvoice } from "../financeCore";
import { fixtureCard } from "../financeTestFixtures";
import { updateTransactionSeriesSnapshot } from "./updateTransactionSeriesSnapshot";

function editDraft(transactionMode: "single" | "installment" | "recurring") {
    return {
        value: 120,
        date: "2026-01-05",
        inWallet: fixtureWallet.id,
        paymentMethod: "wallet" as const,
        description: "Academia",
        status: "pending" as const,
        transactionMode,
        installmentCount: transactionMode === "installment" ? 3 : null,
        recurrenceRule: transactionMode === "recurring"
            ? {
                  frequency: "monthly" as const,
                  interval: 1,
                  anchorDate: "2026-01-05",
                  amount: 120,
                  end: { type: "count" as const, count: 4 },
              }
            : null,
    };
}

describe("transaction mode conversion", () => {
    it("converts a single transaction into installments", () => {
        const result = updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot(),
            transactionId: "tx-test",
            draft: editDraft("installment"),
            scope: "single",
            now: "2026-01-01T12:00:00.000Z",
        });

        const group = result.snapshot.transactionGroups.find((item) => item.id === "group-test")!;
        const installments = result.snapshot.transactions.filter((item) => item.groupId === group.id);

        expect(group.transactionMode).toBe("installment");
        expect(group.installmentCount).toBe(3);
        expect(installments.map((item) => item.installmentNumber)).toEqual([1, 2, 3]);
        expect(installments.reduce((sum, item) => sum + item.amount, 0)).toBe(120);
        expect(installments[0].id).toBe("tx-test");
    });

    it("converts a single transaction into a finite recurring series", () => {
        const result = updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot(),
            transactionId: "tx-test",
            draft: editDraft("recurring"),
            scope: "single",
            now: "2026-01-01T12:00:00.000Z",
        });

        const group = result.snapshot.transactionGroups.find((item) => item.id === "group-test")!;
        expect(group.transactionMode).toBe("recurring");
        expect(group.recurrenceRule).toMatchObject({
            anchorDate: "2026-01-05",
            amount: 120,
            end: { type: "count", count: 4 },
        });
    });

    it("detaches one installment as a single transaction and keeps the remainder consistent", () => {
        const group = fixtureGroup({ transactionMode: "installment", installmentCount: 3, totalAmount: 300 });
        const transactions = [1, 2, 3].map((installmentNumber) => fixtureTransaction({
            id: `tx-${installmentNumber}`,
            amount: 100,
            installmentNumber,
            scheduledDate: `2026-0${installmentNumber}-05`,
        }));
        const result = updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot([group], transactions),
            transactionId: "tx-2",
            draft: { ...editDraft("single"), date: "2026-02-05" },
            scope: "single",
            createGroupId: () => "group-detached",
            now: "2026-01-01T12:00:00.000Z",
        });

        const detached = result.snapshot.transactions.find((item) => item.id === "tx-2")!;
        const remainingGroup = result.snapshot.transactionGroups.find((item) => item.id === group.id)!;
        const detachedGroup = result.snapshot.transactionGroups.find((item) => item.id === "group-detached")!;

        expect(detached.groupId).toBe(detachedGroup.id);
        expect(detachedGroup.transactionMode).toBe("single");
        expect(remainingGroup.transactionMode).toBe("installment");
        expect(remainingGroup.installmentCount).toBe(2);
        expect(result.snapshot.transactions.filter((item) => item.groupId === group.id).map((item) => item.installmentNumber)).toEqual([1, 2]);
    });

    it("converts a card charge on an open partially paid invoice to a monthly series", () => {
        const dateBasedPaidInvoiceId = `invoice-${fixtureCard.id}-2026-01`;
        const selectedOpenInvoiceId = `invoice-${fixtureCard.id}-2026-02`;
        const group = fixtureGroup({ creditCardId: fixtureCard.id, sourceWalletId: fixtureWallet.id });
        const transaction = fixtureTransaction({
            creditCardId: fixtureCard.id,
            sourceWalletId: fixtureWallet.id,
            invoiceId: selectedOpenInvoiceId,
            commitment: "posted",
        });
        const selectedInvoice = normalizeCreditCardInvoice({
            id: selectedOpenInvoiceId,
            creditCardId: fixtureCard.id,
            cycleKey: "2026-02",
            totalAmount: 100,
            paidAmount: 50,
            status: "open",
        }, new Set([fixtureCard.id]));
        const dateBasedInvoice = normalizeCreditCardInvoice({
            id: dateBasedPaidInvoiceId,
            creditCardId: fixtureCard.id,
            cycleKey: "2026-01",
            totalAmount: 100,
            paidAmount: 100,
            status: "paid",
        }, new Set([fixtureCard.id]));
        const before = {
            ...fixtureSnapshot([group], [transaction]),
            creditCardInvoices: [dateBasedInvoice, selectedInvoice],
        };

        const result = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: transaction.id,
            draft: {
                ...editDraft("recurring"),
                value: 100,
                paymentMethod: "credit_card",
                creditCardId: fixtureCard.id,
                invoiceId: selectedOpenInvoiceId,
                recurrenceRule: {
                    frequency: "monthly",
                    interval: 1,
                    anchorDate: "2026-01-05",
                    amount: 100,
                    end: { type: "never" },
                },
            },
            scope: "single",
            now: "2026-02-01T12:00:00.000Z",
        });

        expect(result.snapshot.transactionGroups.find((item) => item.id === group.id)?.transactionMode).toBe("recurring");
        expect(result.snapshot.transactions.find((item) => item.id === transaction.id)?.invoiceId).toBe(selectedOpenInvoiceId);
        expect(result.snapshot.creditCardInvoices.find((item) => item.id === selectedOpenInvoiceId)?.status).toBe("open");
        expect(result.snapshot.transactions.some((item) => item.invoiceId === dateBasedPaidInvoiceId)).toBe(false);
    });
});
