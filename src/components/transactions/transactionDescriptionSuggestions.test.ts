import { describe, expect, it } from "vitest";
import type { Transaction } from "../../context/FinanceContext";
import { getTransactionDescriptionSuggestions } from "./transactionDescriptionSuggestions";

function createTransaction(overrides: Partial<Transaction> & Pick<Transaction, "id" | "description">): Transaction {
    return {
        groupId: `group-${overrides.id}`,
        type: "spending",
        value: -50,
        date: "2026-08-01",
        inWallet: "wallet-1",
        destinationWalletId: null,
        categoryId: "category-market",
        beneficiaryId: null,
        tagIds: [],
        status: "paid",
        installmentNumber: null,
        invoiceId: null,
        paymentMethod: "wallet",
        creditCardId: null,
        systemKind: null,
        invoicePaymentMeta: null,
        meta: { criado_em: "2026-08-01T12:00:00.000Z", atualizado_em: null },
        category: {
            id: "category-market",
            label: "Alimentação / Mercado",
            parentLabel: "Alimentação",
            icon: "shopping-cart",
            color: "#34D399",
            type: "expense",
        },
        beneficiary: "Eu",
        tags: [],
        ...overrides,
    };
}

describe("getTransactionDescriptionSuggestions", () => {
    it("ranks prefix matches and ignores accents and letter case", () => {
        const suggestions = getTransactionDescriptionSuggestions({
            query: "pao",
            type: "spending",
            allowedCategoryIds: ["category-market"],
            transactions: [
                createTransaction({ id: "2", description: "Compra de pão" }),
                createTransaction({ id: "1", description: "Pão de Açúcar" }),
            ],
        });

        expect(suggestions.map((transaction) => transaction.id)).toEqual(["1", "2"]);
    });

    it("keeps only usable matches and deduplicates repeated descriptions", () => {
        const suggestions = getTransactionDescriptionSuggestions({
            query: "merc",
            type: "spending",
            allowedCategoryIds: ["category-market"],
            excludeTransactionId: "current",
            transactions: [
                createTransaction({ id: "old", description: "Mercado semanal", date: "2026-07-01" }),
                createTransaction({ id: "new", description: "Mercado semanal", date: "2026-08-01" }),
                createTransaction({ id: "current", description: "Mercado atual" }),
                createTransaction({ id: "cancelled", description: "Mercado cancelado", status: "cancelled" }),
                createTransaction({ id: "income", description: "Mercado receita", type: "income" }),
                createTransaction({
                    id: "inactive-category",
                    description: "Mercado antigo",
                    categoryId: "category-old",
                    category: { id: "category-old", label: "Antiga", parentLabel: null, icon: "tag", color: null, type: "expense" },
                }),
            ],
        });

        expect(suggestions.map((transaction) => transaction.id)).toEqual(["new"]);
    });
});
