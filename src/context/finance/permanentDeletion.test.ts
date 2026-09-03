import { describe, expect, it } from "vitest";
import type { Category, CreditCard, CreditCardInvoice, LedgerEntry, StoredTransaction, TransactionGroup, Wallet, WishItem } from "./financeCore";
import { permanentlyDeleteCategoryData, permanentlyDeleteCreditCardData, permanentlyDeleteWalletData } from "./permanentDeletion";

const fallbackCategory: Category = {
    id: "fallback", userId: "user", parentId: null, name: "Sem categoria", type: "expense",
    icon: "circle", color: null, isActive: true, isSystem: false, sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
};

describe("permanentlyDeleteCategoryData", () => {
    it("repoints groups, occurrence overrides and wishlist dependencies before deleting", () => {
        const category = { ...fallbackCategory, id: "removed", name: "Removida" };
        const group = {
            id: "group", categoryId: category.id, categoryName: category.name, subcategoryName: null,
        } as TransactionGroup;
        const transaction = { id: "transaction", categoryId: category.id } as StoredTransaction;
        const wishItem = { id: "wish", categoryId: category.id } as WishItem;

        const result = permanentlyDeleteCategoryData({
            categoryId: category.id,
            categories: [category, fallbackCategory],
            transactionGroups: [group],
            transactions: [transaction],
            wishItems: [wishItem],
            fallbackCategory,
        });

        expect(result.categories.map((item) => item.id)).toEqual([fallbackCategory.id]);
        expect(result.transactionGroups[0].categoryId).toBe(fallbackCategory.id);
        expect(result.transactions[0].categoryId).toBe(fallbackCategory.id);
        expect(result.wishItems[0].categoryId).toBe(fallbackCategory.id);
    });
});

describe("permanent account deletion", () => {
    it("removes occurrence-level wallet dependencies and wallet ledger rows", () => {
        const transaction = { id: "transaction", groupId: "group", sourceWalletId: "removed-wallet" } as StoredTransaction;
        const group = { id: "group", sourceWalletId: "kept-wallet" } as TransactionGroup;
        const result = permanentlyDeleteWalletData({
            walletId: "removed-wallet",
            wallets: [{ id: "removed-wallet" }, { id: "kept-wallet" }] as Wallet[],
            creditCards: [],
            transactionGroups: [group],
            transactions: [transaction],
            transactionTags: [{ transactionId: transaction.id, tagId: "tag" }],
            ledgerEntries: [
                { id: "transaction-ledger", walletId: "kept-wallet", transactionId: transaction.id },
                { id: "wallet-ledger", walletId: "removed-wallet", transactionId: null },
            ] as LedgerEntry[],
        });

        expect(result.transactions).toEqual([]);
        expect(result.transactionGroups).toEqual([group]);
        expect(result.transactionTags).toEqual([]);
        expect(result.ledgerEntries).toEqual([]);
    });

    it("removes occurrence-level card dependencies", () => {
        const transaction = { id: "transaction", groupId: "group", creditCardId: "removed-card", notes: null } as StoredTransaction;
        const result = permanentlyDeleteCreditCardData({
            creditCardId: "removed-card",
            creditCards: [{ id: "removed-card" }] as CreditCard[],
            creditCardInvoices: [],
            transactionGroups: [{ id: "group", creditCardId: null } as TransactionGroup],
            transactions: [transaction],
            transactionTags: [],
            ledgerEntries: [],
        });

        expect(result.transactions).toEqual([]);
        expect(result.transactionGroups).toHaveLength(1);
    });

    it("removes relational invoice payments when their card is deleted", () => {
        const payment = {
            id: "payment",
            groupId: "payment-group",
            paymentForInvoiceId: "removed-invoice",
            notes: null,
        } as StoredTransaction;
        const result = permanentlyDeleteCreditCardData({
            creditCardId: "removed-card",
            creditCards: [{ id: "removed-card" }] as CreditCard[],
            creditCardInvoices: [{ id: "removed-invoice", creditCardId: "removed-card" }] as CreditCardInvoice[],
            transactionGroups: [{ id: "payment-group", creditCardId: null } as TransactionGroup],
            transactions: [payment],
            transactionTags: [],
            ledgerEntries: [],
        });

        expect(result.transactions).toEqual([]);
    });
});
