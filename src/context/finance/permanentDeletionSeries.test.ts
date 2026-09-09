import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "./financeTestFixtures";
import { permanentlyDeleteCreditCardData, permanentlyDeleteWalletData } from "./permanentDeletion";
import { requireRecurrenceRule } from "./recurrence/rule";

describe("permanent registry deletion", () => {
    it("removes an entire linked purchase including individually rerouted installments and their ledger", () => {
        const group = fixtureGroup({ transactionMode: "installment", creditCardId: fixtureCard.id });
        const override = fixtureTransaction({ routingOverride: true, creditCardId: null, sourceWalletId: fixtureWallet.id, installmentNumber: 2 });
        const unrelatedGroup = fixtureGroup({ id: "unrelated" });
        const unrelated = fixtureTransaction({ id: "unrelated", groupId: unrelatedGroup.id });
        const snapshot = fixtureSnapshot([group, unrelatedGroup], [override, unrelated]);
        snapshot.transactionTags = [{ transactionId: override.id, tagId: "tag" }];
        snapshot.ledgerEntries = [{ id: "ledger", transactionId: override.id, walletId: fixtureWallet.id,
            invoiceId: null, amount: -100, balanceAfter: 900, description: "Test", createdAt: "2026-01-05T12:00:00Z" }];
        const result = permanentlyDeleteCreditCardData({ ...snapshot, creditCardId: fixtureCard.id });
        expect(result.transactionGroups.map((row) => row.id)).toEqual([unrelatedGroup.id]);
        expect(result.transactions.map((row) => row.id)).toEqual([unrelated.id]);
        expect(result.transactionTags).toEqual([]);
        expect(result.ledgerEntries).toEqual([]);
    });

    it.each(["sourceWalletId", "destinationWalletId"] as const)("removes a recurring series referring to a wallet only through %s in its rule", (field) => {
        const rule = requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "never" }, [field]: "removed" });
        const snapshot = fixtureSnapshot([fixtureGroup({ transactionMode: "recurring", recurrenceRule: rule })], []);
        snapshot.wallets.push({ ...fixtureWallet, id: "removed" });
        const result = permanentlyDeleteWalletData({ ...snapshot, walletId: "removed" });
        expect(result.transactionGroups).toEqual([]);
        expect(result.wallets.map((row) => row.id)).toEqual([fixtureWallet.id]);
    });

    it("removes a recurring series referring to a card only through its rule", () => {
        const rule = requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100, end: { type: "never" }, creditCardId: fixtureCard.id });
        const snapshot = fixtureSnapshot([fixtureGroup({ transactionMode: "recurring", recurrenceRule: rule })], []);
        expect(permanentlyDeleteCreditCardData({ ...snapshot, creditCardId: fixtureCard.id }).transactionGroups).toEqual([]);
    });
});
