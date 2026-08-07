import { describe, expect, it, vi } from "vitest";
import {
    createFinanceSnapshot,
    createLedgerEntriesForPaidTransaction,
    DEFAULT_PLANNING_STATE,
    resolveTransactionCategoryId,
    resolveTransactionSourceWalletId,
    resolveTransactionTitle,
    type Category,
    type CreditCard,
    type FinanceSnapshot,
    type StoredTransaction,
    type TransactionGroup,
    type Wallet,
} from "../../financeTypes";
import { ensureRecurringTransactionsHorizon } from "../recurringTransactions";
import { persistTransactionSeriesSnapshotAtomically } from "./atomicPersistence";
import { updateTransactionSeriesSnapshot } from "./updateTransactionSeriesSnapshot";

const wallet: Wallet = {
    id: "wallet-main",
    name: "Conta principal",
    icon: "wallet",
    type: "checking",
    balance: 1_000,
    initialBalance: 1_000,
    currency: "BRL",
    color: "#000000",
    isActive: true,
    includeInMainTotals: true,
    createdAt: "2026-01-01T00:00:00.000Z",
};

const secondWallet: Wallet = { ...wallet, id: "wallet-second", name: "Conta secundaria", balance: 500, initialBalance: 500 };
const creditCard: CreditCard = {
    id: "card-main",
    name: "Cartao principal",
    icon: "credit-card",
    color: "#111111",
    limit: 5_000,
    closingDay: 20,
    dueDay: 27,
    bankWalletId: wallet.id,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
};

const oldCategory: Category = {
    id: "category-old",
    userId: "user-1",
    parentId: null,
    name: "Servicos",
    type: "expense",
    icon: "receipt",
    color: null,
    isActive: true,
    isSystem: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
};

const subscriptionRoot: Category = { ...oldCategory, id: "category-bills", name: "Contas", sortOrder: 1 };
const subscriptionCategory: Category = { ...oldCategory, id: "category-subscription", parentId: subscriptionRoot.id, name: "Assinatura", sortOrder: 0 };

function recurringGroup(id: string, title: string, amount: number, day: string): TransactionGroup {
    return {
        id,
        userId: "user-1",
        beneficiaryId: "beneficiary-1",
        beneficiaryName: "Eu",
        categoryId: oldCategory.id,
        categoryName: oldCategory.name,
        subcategoryName: null,
        title,
        notes: title,
        type: "expense",
        transactionMode: "recurring",
        totalAmount: amount * 4,
        installmentCount: null,
        recurrenceRule: {
            frequency: "monthly",
            interval: 1,
            anchorDate: `2026-06-${day}`,
            amount,
            tagIds: [],
            excludedDates: [],
            notes: title,
        },
        recurrenceEndDate: null,
        sourceWalletId: wallet.id,
        destinationWalletId: null,
        creditCardId: null,
        createdAt: "2026-06-01T00:00:00.000Z",
    };
}

function occurrence(groupId: string, id: string, date: string, amount: number, status: StoredTransaction["status"]): StoredTransaction {
    return {
        id,
        groupId,
        installmentNumber: null,
        amount,
        scheduledDate: date,
        status,
        paidAt: status === "paid" ? `${date}T12:00:00.000Z` : null,
        invoiceId: null,
        notes: null,
        title: null,
        categoryId: null,
        beneficiaryId: null,
        sourceWalletId: null,
        destinationWalletId: null,
        creditCardId: null,
        createdAt: `${date}T09:00:00.000Z`,
    };
}

function makeSnapshot(groups: TransactionGroup[], transactions: StoredTransaction[], creditCards: CreditCard[] = []): FinanceSnapshot {
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const ledgerEntries = transactions.flatMap((transaction) => {
        const group = groupsById.get(transaction.groupId);
        return group ? createLedgerEntriesForPaidTransaction(transaction, group) : [];
    });
    return createFinanceSnapshot(
        [wallet, secondWallet],
        creditCards,
        [],
        null,
        groups,
        transactions,
        ledgerEntries,
        [{
            id: "beneficiary-1",
            userId: "user-1",
            familyId: null,
            source: "personal",
            isSelfProfile: true,
            name: "Eu",
            type: "person",
            avatarColor: null,
            avatarImage: null,
            isActive: true,
            sortOrder: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
        }],
        [oldCategory, subscriptionRoot, subscriptionCategory],
        [],
        [],
        [],
        DEFAULT_PLANNING_STATE,
    );
}

function standardSeries(): FinanceSnapshot {
    const group = recurringGroup("group-chatgpt", "ChatGPT Plus", 103.4, "10");
    return makeSnapshot(group ? [group] : [], [
        occurrence(group.id, "tx-june", "2026-06-10", 103.4, "paid"),
        occurrence(group.id, "tx-july", "2026-07-10", 103.4, "paid"),
        occurrence(group.id, "tx-august", "2026-08-10", 103.4, "pending"),
        occurrence(group.id, "tx-september", "2026-09-10", 103.4, "pending"),
    ]);
}

function metadataDraft(snapshot: FinanceSnapshot, transactionId: string, description: string) {
    const transaction = snapshot.transactions.find((item) => item.id === transactionId)!;
    const group = snapshot.transactionGroups.find((item) => item.id === transaction.groupId)!;
    return {
        value: transaction.amount,
        date: transaction.scheduledDate,
        inWallet: resolveTransactionSourceWalletId(transaction, group) ?? wallet.id,
        paymentMethod: "wallet" as const,
        creditCardId: null,
        categoryId: subscriptionCategory.id,
        beneficiaryId: group.beneficiaryId,
        tagIds: [],
        description,
        notes: description,
        status: transaction.status,
        transactionMode: "recurring" as const,
    };
}

describe("updateTransactionSeriesSnapshot", () => {
    it("Caso A: edita metadados de toda a serie sem trocar IDs, pagamentos ou saldo", () => {
        const before = standardSeries();
        const beforeIds = before.transactions.map((transaction) => transaction.id);
        const beforeLedgerIds = before.ledgerEntries.map((entry) => entry.id);
        const beforeBalances = before.wallets.map((item) => item.balance);

        const result = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: "tx-august",
            draft: metadataDraft(before, "tx-august", "ChatGPT Premium"),
            scope: "all",
            now: "2026-08-06T12:00:00.000Z",
        });

        expect(result.snapshot.transactions.map((transaction) => transaction.id)).toEqual(beforeIds);
        expect(result.snapshot.transactions.filter((transaction) => transaction.status === "paid").map((transaction) => transaction.id)).toEqual(["tx-june", "tx-july"]);
        expect(result.snapshot.ledgerEntries.map((entry) => entry.id)).toEqual(beforeLedgerIds);
        expect(result.snapshot.wallets.map((item) => item.balance)).toEqual(beforeBalances);
        expect(result.snapshot.transactionGroups).toHaveLength(1);
        const group = result.snapshot.transactionGroups[0];
        result.snapshot.transactions.forEach((transaction) => {
            expect(resolveTransactionTitle(transaction, group)).toBe("ChatGPT Premium");
            expect(resolveTransactionCategoryId(transaction, group)).toBe(subscriptionCategory.id);
        });
    });

    it("Caso B: divide esta e proximas, preserva o passado e nao duplica na hidratacao", () => {
        const before = standardSeries();
        const result = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: "tx-august",
            draft: metadataDraft(before, "tx-august", "ChatGPT Premium"),
            scope: "this_and_next",
            createGroupId: () => "group-chatgpt-split",
            now: "2026-08-06T12:00:00.000Z",
        });
        const oldGroup = result.snapshot.transactionGroups.find((group) => group.id === "group-chatgpt")!;
        const newGroup = result.snapshot.transactionGroups.find((group) => group.id === "group-chatgpt-split")!;

        expect(result.snapshot.transactions.find((transaction) => transaction.id === "tx-june")?.groupId).toBe(oldGroup.id);
        expect(result.snapshot.transactions.find((transaction) => transaction.id === "tx-july")?.groupId).toBe(oldGroup.id);
        expect(result.snapshot.transactions.find((transaction) => transaction.id === "tx-august")?.groupId).toBe(newGroup.id);
        expect(result.snapshot.transactions.find((transaction) => transaction.id === "tx-september")?.groupId).toBe(newGroup.id);
        expect(oldGroup.recurrenceEndDate).toBe("2026-08-09");
        expect(newGroup.recurrenceRule?.anchorDate).toBe("2026-08-10");
        expect(result.snapshot.ledgerEntries).toEqual(before.ledgerEntries.map((entry) => ({ ...entry })));

        let sequence = 0;
        const hydrated = ensureRecurringTransactionsHorizon({
            groups: result.snapshot.transactionGroups,
            transactions: result.snapshot.transactions,
            transactionTags: result.snapshot.transactionTags,
            tags: result.snapshot.tags,
            today: "2026-08-01",
            now: "2026-08-06T12:00:00.000Z",
            createTransactionId: () => `tx-hydrated-${sequence++}`,
        });
        const keys = hydrated.transactions.map((transaction) => `${transaction.groupId}:${transaction.scheduledDate}`);
        expect(new Set(keys).size).toBe(keys.length);
        expect(hydrated.transactions.filter((transaction) => transaction.id === "tx-august")).toHaveLength(1);
    });

    it("Caso C: preserva os quatro pagamentos reais e os R$ 246,80 do ledger", () => {
        const chatgpt = recurringGroup("group-chatgpt", "ChatGPT Plus", 103.4, "10");
        const spotify = recurringGroup("group-spotify", "Spotify", 20, "03");
        const before = makeSnapshot([chatgpt, spotify], [
            occurrence(chatgpt.id, "chat-june", "2026-06-10", 103.4, "paid"),
            occurrence(chatgpt.id, "chat-july", "2026-07-10", 103.4, "paid"),
            occurrence(chatgpt.id, "chat-august", "2026-08-10", 103.4, "pending"),
            occurrence(spotify.id, "spotify-june", "2026-06-03", 20, "paid"),
            occurrence(spotify.id, "spotify-july", "2026-07-03", 20, "paid"),
            occurrence(spotify.id, "spotify-august", "2026-08-03", 20, "pending"),
        ]);
        const afterChat = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: "chat-august",
            draft: metadataDraft(before, "chat-august", "ChatGPT Plus"),
            scope: "all",
        }).snapshot;
        const afterBoth = updateTransactionSeriesSnapshot({
            snapshot: afterChat,
            transactionId: "spotify-august",
            draft: metadataDraft(afterChat, "spotify-august", "Spotify"),
            scope: "all",
        }).snapshot;

        expect(afterBoth.transactions.filter((transaction) => transaction.status === "paid")).toHaveLength(4);
        expect(afterBoth.ledgerEntries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0)).toBeCloseTo(246.8, 2);
        expect(afterBoth.ledgerEntries.map((entry) => entry.transactionId).sort()).toEqual(before.ledgerEntries.map((entry) => entry.transactionId).sort());
    });

    it("Caso D: falha de persistencia nao confirma estado intermediario", async () => {
        const before = standardSeries();
        const candidate = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: "tx-august",
            draft: metadataDraft(before, "tx-august", "ChatGPT Premium"),
            scope: "all",
        }).snapshot;
        const persist = vi.fn(async () => { throw new Error("falha simulada"); });
        const commit = vi.fn();

        await expect(persistTransactionSeriesSnapshotAtomically({ snapshot: candidate, persist, commit })).rejects.toThrow("falha simulada");
        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith(candidate);
        expect(commit).not.toHaveBeenCalled();
    });

    it("Caso E: altera valor e carteira apenas nas pendentes do escopo", () => {
        const before = standardSeries();
        const draft = {
            ...metadataDraft(before, "tx-august", "ChatGPT Plus"),
            value: 120,
            inWallet: secondWallet.id,
        };
        const result = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: "tx-august",
            draft,
            scope: "this_and_next",
            createGroupId: () => "group-chatgpt-future",
        });

        ["tx-june", "tx-july"].forEach((id) => {
            expect(result.snapshot.transactions.find((transaction) => transaction.id === id)).toEqual(before.transactions.find((transaction) => transaction.id === id));
        });
        ["tx-august", "tx-september"].forEach((id) => {
            const transaction = result.snapshot.transactions.find((item) => item.id === id)!;
            const group = result.snapshot.transactionGroups.find((item) => item.id === transaction.groupId)!;
            expect(transaction.amount).toBe(120);
            expect(resolveTransactionSourceWalletId(transaction, group)).toBe(secondWallet.id);
        });
        expect(result.snapshot.ledgerEntries).toEqual(before.ledgerEntries);
    });

    it("preserva cartao e fatura historicos ao mover apenas as pendentes para carteira", () => {
        const group = { ...recurringGroup("group-card", "Streaming", 50, "05"), creditCardId: creditCard.id };
        const paid = { ...occurrence(group.id, "card-paid", "2026-07-05", 50, "paid"), invoiceId: "invoice-card-main-2026-07" };
        const pending = { ...occurrence(group.id, "card-pending", "2026-08-05", 50, "pending"), invoiceId: "invoice-card-main-2026-08" };
        const before = makeSnapshot([group], [paid, pending], [creditCard]);
        const result = updateTransactionSeriesSnapshot({
            snapshot: before,
            transactionId: pending.id,
            draft: {
                ...metadataDraft(before, pending.id, "Streaming"),
                paymentMethod: "wallet",
                creditCardId: null,
                invoiceId: null,
            },
            scope: "all",
        });
        const nextGroup = result.snapshot.transactionGroups[0];
        const nextPaid = result.snapshot.transactions.find((transaction) => transaction.id === paid.id)!;
        const nextPending = result.snapshot.transactions.find((transaction) => transaction.id === pending.id)!;

        expect(resolveTransactionSourceWalletId(nextPaid, nextGroup)).toBe(wallet.id);
        expect(nextPaid.invoiceId).toBe(paid.invoiceId);
        expect(nextPaid.creditCardId).toBe(creditCard.id);
        expect(nextPending.invoiceId).toBeNull();
        expect(nextPending.creditCardId).toBeNull();
        expect(nextGroup.creditCardId).toBeNull();
    });
});
