import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "./financeTestFixtures";
import { updateTransactionSeriesSnapshot } from "./transactionSeries/updateTransactionSeriesSnapshot";

describe("paid transaction routing", () => {
    it("rejects converting a paid wallet expense directly into a paid card charge", () => {
        const group = fixtureGroup();
        const transaction = fixtureTransaction({ status: "paid", paidAt: "2026-01-05T12:00:00Z" });
        expect(() => updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot([group], [transaction]), transactionId: transaction.id, scope: "single",
            draft: { paymentMethod: "credit_card", creditCardId: fixtureCard.id },
        })).toThrow(/cartão são liquidados pelo pagamento da fatura/);
    });

    it("allows metadata edits on a legacy charge already paid on the same card", () => {
        const group = fixtureGroup({ sourceWalletId: null, creditCardId: fixtureCard.id });
        const transaction = fixtureTransaction({ status: "paid", paidAt: "2026-01-05T12:00:00Z", sourceWalletId: null,
            creditCardId: fixtureCard.id, invoiceId: `invoice-${fixtureCard.id}-2026-02` });
        const result = updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot([group], [transaction]), transactionId: transaction.id, scope: "single",
            draft: { description: "Descrição corrigida" },
        });
        expect(result.snapshot.transactions[0]).toMatchObject({ status: "paid", creditCardId: fixtureCard.id, title: "Descrição corrigida" });
        expect(result.snapshot.wallets[0].balance).toBe(fixtureWallet.balance);
    });
});
