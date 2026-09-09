import { describe, expect, it } from "vitest";
import { toTransactionList } from "../../context/finance/financeCore";
import { fixtureGroup, fixtureTransaction, fixtureWallet } from "../../context/finance/financeTestFixtures";
import { buildDuplicateTransactionPrefill, buildDuplicateTransferPrefill } from "./duplicateTransactionPrefill";

const base = toTransactionList([fixtureTransaction({ status: "paid", paidAt: "2026-01-05T12:00:00Z" })],
    [fixtureGroup()], [], [], [], [])[0];

describe("quick duplicate prefill", () => {
    it("preserves editable wallet fields but resets status and date for review", () => {
        const source = { ...base, category: { ...base.category, id: "category-a" }, tagIds: ["tag-a"] };
        expect(buildDuplicateTransactionPrefill(source)).toEqual({
            initialAmount: 100, initialCategoryId: "category-a", initialDescription: "Teste", initialWalletId: fixtureWallet.id,
            initialBeneficiaryId: null, initialTagIds: ["tag-a"], initialStatus: "pending",
        });
        expect(buildDuplicateTransactionPrefill(source)).not.toHaveProperty("initialDate");
    });

    it("preserves both transfer routes without copying its effective date", () => {
        const source = { ...base, type: "transfer" as const, destinationWalletId: "wallet-destination" };
        expect(buildDuplicateTransferPrefill(source)).toMatchObject({ initialSourceWalletId: fixtureWallet.id,
            initialDestinationWalletId: "wallet-destination", initialStatus: "pending" });
        expect(buildDuplicateTransferPrefill(source)).not.toHaveProperty("initialDate");
    });
});
