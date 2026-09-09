import { describe, expect, it } from "vitest";
import type { SupabaseFinanceData } from "../../supabase/finance";
import { createFinanceSnapshot, createLedgerEntriesForPaidTransaction, DEFAULT_PLANNING_STATE, normalizeCreditCardInvoice } from "../financeTypes";
import { mergeSupabaseFinanceData } from "./financeSyncMerge";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction, fixtureWallet } from "./financeTestFixtures";
import { applyTransactionStatus } from "./transactionStatus";

function financeData(wallets: SupabaseFinanceData["wallets"]): SupabaseFinanceData {
    return {
        ...createFinanceSnapshot(wallets, [], [], null, [], [], [], [], [], [], [], [], DEFAULT_PLANNING_STATE),
        favoriteWalletId: null,
    };
}

const wallet = {
    id: "wallet-1",
    name: "Principal",
    icon: "wallet",
    type: "checking" as const,
    balance: 100,
    initialBalance: 100,
    currency: "BRL",
    color: "#000000",
    isActive: true,
    includeInMainTotals: true,
    createdAt: "2026-01-01T00:00:00.000Z",
};

const invoice = normalizeCreditCardInvoice({
    id: `invoice-${fixtureCard.id}-2026-02`,
    creditCardId: fixtureCard.id,
    cycleKey: "2026-02",
    totalAmount: 100,
    paidAmount: 0,
}, new Set([fixtureCard.id]));

function invoiceFinanceData(payments: Array<{ id: string; amount: number; paidAt: string }>): SupabaseFinanceData {
    const groups = payments.map((payment) => fixtureGroup({
        id: `group-${payment.id}`,
        title: "Pagamento de fatura",
        totalAmount: payment.amount,
    }));
    const transactions = payments.map((payment) => fixtureTransaction({
        id: payment.id,
        groupId: `group-${payment.id}`,
        amount: payment.amount,
        status: "paid",
        paidAt: payment.paidAt,
        paymentForInvoiceId: invoice.id,
    }));
    const ledgerEntries = transactions.flatMap((transaction) => createLedgerEntriesForPaidTransaction(
        transaction,
        groups.find((group) => group.id === transaction.groupId)!,
    ));
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
        ...createFinanceSnapshot(
            [fixtureWallet], [fixtureCard], [{ ...invoice, paidAmount: Math.min(100, paidAmount), status: paidAmount >= 100 ? "paid" : "open" }], null,
            groups, transactions, ledgerEntries, [], [], [], [], [], DEFAULT_PLANNING_STATE,
        ),
        favoriteWalletId: fixtureWallet.id,
    };
}

describe("mergeSupabaseFinanceData", () => {
    it("keeps the first canonical settlement date and a single ledger entry after concurrent payments", () => {
        const snapshot = fixtureSnapshot();
        const baseData = { ...snapshot, favoriteWalletId: null };
        const remoteData = { ...applyTransactionStatus(snapshot, "tx-test", "paid", "2026-09-05T12:00:00.000Z"), favoriteWalletId: null };
        const targetData = { ...applyTransactionStatus(snapshot, "tx-test", "paid", "2026-09-05T12:01:00.000Z"), favoriteWalletId: null };
        const merged = mergeSupabaseFinanceData({ baseData, remoteData, targetData });
        expect(merged.transactions[0].paidAt).toBe(remoteData.transactions[0].paidAt);
        expect(merged.transactions[0].scheduledDate).toBe(snapshot.transactions[0].scheduledDate);
        expect(merged.ledgerEntries).toHaveLength(1);
        expect(merged.ledgerEntries[0]).toMatchObject({ amount: -100, createdAt: remoteData.transactions[0].paidAt });
    });

    it("drops a redundant local invoice payment after the remote device pays the whole balance", () => {
        const baseData = invoiceFinanceData([]);
        const remoteData = invoiceFinanceData([{ id: "remote-payment", amount: 100, paidAt: "2026-09-05T12:00:00.000Z" }]);
        const targetData = invoiceFinanceData([{ id: "local-payment", amount: 100, paidAt: "2026-09-05T12:01:00.000Z" }]);

        const merged = mergeSupabaseFinanceData({ baseData, remoteData, targetData });

        expect(merged.transactions.map((transaction) => transaction.id)).toEqual(["remote-payment"]);
        expect(merged.transactionGroups.map((group) => group.id)).toEqual(["group-remote-payment"]);
        expect(merged.ledgerEntries).toHaveLength(1);
        expect(merged.ledgerEntries[0]).toMatchObject({ transactionId: "remote-payment", amount: -100 });
        expect(merged.creditCardInvoices[0]).toMatchObject({ paidAmount: 100, status: "paid", paidAt: "2026-09-05T12:00:00.000Z" });
    });

    it("limits a concurrent local partial payment to the remaining invoice balance", () => {
        const baseData = invoiceFinanceData([]);
        const remoteData = invoiceFinanceData([{ id: "remote-payment", amount: 60, paidAt: "2026-09-05T12:00:00.000Z" }]);
        const targetData = invoiceFinanceData([{ id: "local-payment", amount: 60, paidAt: "2026-09-05T12:01:00.000Z" }]);

        const merged = mergeSupabaseFinanceData({ baseData, remoteData, targetData });

        expect(merged.transactions.map((transaction) => [transaction.id, transaction.amount])).toEqual([
            ["remote-payment", 60], ["local-payment", 40],
        ]);
        expect(merged.transactionGroups.find((group) => group.id === "group-local-payment")?.totalAmount).toBe(40);
        expect(merged.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-100);
        expect(merged.creditCardInvoices[0]).toMatchObject({ paidAmount: 100, status: "paid", paidAt: "2026-09-05T12:01:00.000Z" });
    });

    it("adds compatible concurrent partial payments instead of keeping one scalar paid amount", () => {
        const baseData = invoiceFinanceData([]);
        const remoteData = invoiceFinanceData([{ id: "remote-payment", amount: 40, paidAt: "2026-09-05T12:00:00.000Z" }]);
        const targetData = invoiceFinanceData([{ id: "local-payment", amount: 60, paidAt: "2026-09-05T12:01:00.000Z" }]);

        const merged = mergeSupabaseFinanceData({ baseData, remoteData, targetData });

        expect(merged.transactions.map((transaction) => transaction.amount)).toEqual([40, 60]);
        expect(merged.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-100);
        expect(merged.creditCardInvoices[0]).toMatchObject({ paidAmount: 100, status: "paid" });
    });

    it("does not undo a remote payment when an offline device materializes the same forecast for annotations", () => {
        const baseData = { ...fixtureSnapshot([fixtureGroup()], []), favoriteWalletId: null };
        const materialized = { ...baseData, transactions: [fixtureTransaction()] };
        const remoteData = { ...applyTransactionStatus(materialized, "tx-test", "paid", "2026-09-05T12:00:00.000Z"), favoriteWalletId: null };
        const targetData = { ...materialized, transactions: [fixtureTransaction({ notes: "Offline annotation" })] };
        const merged = mergeSupabaseFinanceData({ baseData, remoteData, targetData });
        expect(merged.transactions).toHaveLength(1);
        expect(merged.transactions[0]).toMatchObject({ status: "paid", notes: "Offline annotation", paidAt: remoteData.transactions[0].paidAt });
        expect(merged.ledgerEntries).toHaveLength(1);
    });
    it("keeps a confirmed remote deletion instead of resurrecting a stale row", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([wallet]),
            remoteData: financeData([]),
            targetData: financeData([{ ...wallet, name: "Alterada offline" }]),
        });

        expect(merged.wallets).toEqual([]);
    });

    it("preserves independent local and remote inserts", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([]),
            remoteData: financeData([{ ...wallet, id: "remote" }]),
            targetData: financeData([{ ...wallet, id: "local" }]),
        });

        expect(merged.wallets.map((item) => item.id)).toEqual(["remote", "local"]);
    });

    it("combines concurrent edits to different fields of the same entity", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([wallet]),
            remoteData: financeData([{ ...wallet, balance: 150, initialBalance: 150 }]),
            targetData: financeData([{ ...wallet, name: "Conta conjunta" }]),
        });

        expect(merged.wallets[0]).toMatchObject({ name: "Conta conjunta", balance: 150, initialBalance: 150 });
    });
});
