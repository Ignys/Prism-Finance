import { describe, expect, it } from "vitest";
import { duplicateTransactionDraft } from "./duplicateTransactionDraft";
import { createTransactionSnapshot } from "../../context/finance/transactionCreation/createTransactionSnapshot";
import { fixtureSnapshot, fixtureWallet } from "../../context/finance/financeTestFixtures";

describe("duplicate occurrence", () => {
    it.each(["recurring", "installment"] as const)("does not copy the payment or the %s series", (transactionMode) => {
        const draft = duplicateTransactionDraft({ id: "original", groupId: "original-group", type: "spending", amount: 100,
            scheduledDate: "2026-01-05", walletId: fixtureWallet.id, status: "paid", transactionMode, installmentCount: 6,
            ignoredInstallmentsCount: 2, recurrenceRule: { end: { type: "count", count: 6 } }, invoiceId: "old-invoice",
            commitment: "forecast", description: "Original", tagIds: [] });
        const snapshot = createTransactionSnapshot(fixtureSnapshot([], []), draft, { userId: "user", now: "2026-01-01T12:00:00Z" });
        expect(snapshot.transactions).toHaveLength(1);
        expect(snapshot.transactions[0]).toMatchObject({ status: "pending", amount: 100, scheduledDate: "2026-01-05", invoiceId: null });
        expect(snapshot.transactions[0].id).not.toBe("original");
        expect(snapshot.transactionGroups[0]).toMatchObject({ transactionMode: "single", recurrenceRule: null });
        expect(snapshot.ledgerEntries).toEqual([]);
        expect(snapshot.wallets[0].balance).toBe(1000);
    });
});
