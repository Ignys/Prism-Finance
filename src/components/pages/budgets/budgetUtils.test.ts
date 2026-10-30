import { describe, expect, it } from "vitest";
import type { Category, PlanningBudget, Transaction } from "../../../context/FinanceContext";
import { normalizePlanningBudgets } from "../../../context/finance/planningBudgets";
import { buildBudgetRuleContext, matchesBudgetRules } from "./budgetRules";
import { buildBudgetsOverview, previewBudgetRules, suggestBudgetAmount } from "./budgetUtils";

function category(id: string, parentId: string | null = null): Category {
    return {
        id,
        userId: null,
        parentId,
        name: id,
        type: "expense",
        icon: "tag",
        color: null,
        isActive: true,
        isSystem: false,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

function spending(id: string, value: number, date: string, overrides: Partial<Transaction> = {}): Transaction {
    return {
        id,
        groupId: `group-${id}`,
        type: "spending",
        value,
        date,
        inWallet: "wallet",
        destinationWalletId: null,
        categoryId: "water",
        beneficiaryId: null,
        tagIds: [],
        description: id,
        status: "paid",
        installmentNumber: null,
        invoiceId: null,
        paymentMethod: "wallet",
        creditCardId: null,
        systemKind: null,
        invoicePaymentMeta: null,
        meta: { criado_em: "2026-01-01T00:00:00.000Z", atualizado_em: null },
        category: { id: "water", label: "water", parentLabel: "bills", icon: "tag", color: null, type: "expense" },
        beneficiary: "",
        tags: [],
        ...overrides,
    };
}

function budget(id: string, rules: Pick<PlanningBudget, "include" | "exclude">, amount: number, alertPercent = 80): PlanningBudget {
    return { id, name: id, ...rules, amount, alertPercent, createdAt: "2026-01-01T00:00:00.000Z" };
}

// Contas (pai) com água, energia e assinaturas; mercado à parte.
const categories = [category("bills"), category("water", "bills"), category("power", "bills"), category("subscriptions", "bills"), category("market")];
const billsWithoutSubscriptions = budget("bills", { include: [{ kind: "category", categoryId: "bills" }], exclude: [{ kind: "category", categoryId: "subscriptions" }] }, 500);
const subscriptions = budget("subs", { include: [{ kind: "category", categoryId: "subscriptions" }], exclude: [] }, 60);

describe("matchesBudgetRules", () => {
    const context = buildBudgetRuleContext(categories);

    it("entra por qualquer regra de inclusão e sai por qualquer exclusão", () => {
        const rules = {
            include: [
                { kind: "category" as const, categoryId: "market" },
                { kind: "tag" as const, tagId: "trip" },
            ],
            exclude: [
                { kind: "text" as const, text: "Farmácia" },
                { kind: "beneficiary" as const, beneficiaryId: "mom" },
            ],
        };

        expect(matchesBudgetRules(spending("a", 1, "2026-10-01", { categoryId: "market" }), rules, context)).toBe(true);
        expect(matchesBudgetRules(spending("b", 1, "2026-10-01", { tagIds: ["trip"] }), rules, context)).toBe(true);
        expect(matchesBudgetRules(spending("c", 1, "2026-10-01", { categoryId: "market", description: "Compra na FARMACIA" }), rules, context)).toBe(false);
        expect(matchesBudgetRules(spending("d", 1, "2026-10-01", { categoryId: "market", beneficiaryId: "mom" }), rules, context)).toBe(false);
        expect(matchesBudgetRules(spending("e", 1, "2026-10-01"), rules, context)).toBe(false);
    });

    it("casa uma série recorrente pelo grupo", () => {
        const rules = { include: [{ kind: "recurring" as const, groupId: "netflix" }], exclude: [] };
        expect(matchesBudgetRules(spending("n", 1, "2026-10-01", { groupId: "netflix" }), rules, context)).toBe(true);
        expect(matchesBudgetRules(spending("o", 1, "2026-10-01"), rules, context)).toBe(false);
    });
});

describe("buildBudgetsOverview", () => {
    it("separa contas de assinaturas, distingue realizado de previsto e conta cada despesa uma vez nos totais", () => {
        const overview = buildBudgetsOverview({
            budgets: [billsWithoutSubscriptions, subscriptions],
            categories,
            transactions: [
                spending("water", 120, "2026-10-05"),
                spending("power", 200, "2026-10-20", { categoryId: "power" }),
                spending("netflix", 50, "2026-10-10", { categoryId: "subscriptions" }),
                spending("projected", 30, "2026-10-01", { isProjected: true }),
                spending("cancelled", 999, "2026-10-02", { status: "cancelled" }),
                spending("invoice", 999, "2026-10-02", { systemKind: "invoice_payment" }),
                spending("old", 90, "2026-09-02"),
                spending("market", 40, "2026-10-03", { categoryId: "market" }),
            ],
            monthKey: "2026-10",
            today: "2026-10-13",
        });

        const bills = overview.progresses.find((progress) => progress.budget.id === "bills")!;
        const subs = overview.progresses.find((progress) => progress.budget.id === "subs")!;

        expect(bills).toMatchObject({ spent: 120, forecast: 230, projected: 350, remaining: 150, status: "ok", sharedCount: 0 });
        expect(bills.entries.map((entry) => [entry.transaction.id, entry.isForecast])).toEqual([
            ["power", true],
            ["water", false],
            ["projected", true],
        ]);
        // 150 livres / 19 dias restantes (13 a 31, inclusive)
        expect(bills.dailyAllowance).toBeCloseTo(7.89, 2);
        expect(bills.history[bills.history.length - 2]).toEqual({ monthKey: "2026-09", amount: 90 });
        expect(subs).toMatchObject({ spent: 50, status: "warning" });
        expect(overview).toMatchObject({ budgeted: 560, spent: 170, projected: 400, unbudgetedSpent: 40, exceededCount: 0, attentionCount: 1 });
    });

    it("aponta despesas que caem em dois orçamentos sem duplicar o total", () => {
        const overview = buildBudgetsOverview({
            budgets: [budget("bills", { include: [{ kind: "category", categoryId: "bills" }], exclude: [] }, 500), subscriptions],
            categories,
            transactions: [spending("netflix", 45, "2026-10-10", { categoryId: "subscriptions" })],
            monthKey: "2026-10",
            today: "2026-10-13",
        });

        const bills = overview.progresses.find((progress) => progress.budget.id === "bills")!;
        expect(bills.sharedCount).toBe(1);
        expect(bills.entries[0].alsoInBudgetIds).toEqual(["subs"]);
        expect(overview.spent).toBe(45);
    });

    it("marca estouro e alerta pelo realizado, e só calcula ritmo diário no mês corrente", () => {
        const overview = buildBudgetsOverview({
            budgets: [
                budget("over", { include: [{ kind: "recurring", groupId: "netflix" }], exclude: [] }, 40),
                budget("warn", { include: [{ kind: "category", categoryId: "market" }], exclude: [] }, 100, 50),
            ],
            categories,
            transactions: [spending("n", 45.9, "2026-08-05", { groupId: "netflix" }), spending("m", 60, "2026-08-06", { categoryId: "market" })],
            monthKey: "2026-08",
            today: "2026-10-13",
        });

        expect(overview.progresses.map((progress) => [progress.budget.id, progress.status, progress.dailyAllowance])).toEqual([
            ["over", "exceeded", null],
            ["warn", "warning", null],
        ]);
    });
});

describe("previewBudgetRules", () => {
    it("mostra o que as regras em edição puxam e onde elas se sobrepõem", () => {
        const preview = previewBudgetRules({ include: [{ kind: "category", categoryId: "bills" }], exclude: [] }, [subscriptions], {
            categories,
            transactions: [spending("water", 120, "2026-10-05"), spending("netflix", 45, "2026-10-10", { categoryId: "subscriptions" })],
            monthKey: "2026-10",
            today: "2026-10-13",
        });

        expect(preview).toMatchObject({ spent: 165, forecast: 0 });
        expect(preview.entries.map((entry) => [entry.transaction.id, entry.alsoInBudgetIds])).toEqual([
            ["netflix", ["subs"]],
            ["water", []],
        ]);
    });
});

describe("suggestBudgetAmount", () => {
    it("usa a média dos 3 meses anteriores com as regras, arredondada para cima", () => {
        const transactions = [
            spending("1", 100, "2026-07-10"),
            spending("2", 200.5, "2026-08-10"),
            spending("3", 300, "2026-09-10"),
            spending("sub", 999, "2026-09-11", { categoryId: "subscriptions" }),
            spending("4", 5000, "2026-10-01"),
        ];
        expect(suggestBudgetAmount(billsWithoutSubscriptions, { categories, transactions, monthKey: "2026-10" })).toBe(201);
        expect(suggestBudgetAmount({ include: [{ kind: "category", categoryId: "market" }], exclude: [] }, { categories, transactions, monthKey: "2026-10" })).toBeNull();
    });
});

describe("normalizePlanningBudgets", () => {
    it("descarta inválidos, limita o alerta, remove regras repetidas e converte o formato antigo", () => {
        const budgets = normalizePlanningBudgets([
            {
                id: "rules",
                name: " Contas ",
                include: [{ kind: "category", categoryId: "bills" }, { kind: "category", categoryId: "bills" }, { kind: "text", text: "  " }, { kind: "other" }],
                exclude: [{ kind: "tag", tagId: "trip" }],
                amount: 200,
                alertPercent: 500,
                createdAt: "2026-02-01T00:00:00.000Z",
            },
            { id: "legacy", target: { kind: "recurring", groupId: "netflix" }, amount: 50, createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "no-rules", include: [], amount: 10 },
            { id: "zero", include: [{ kind: "category", categoryId: "market" }], amount: 0 },
        ]);

        expect(budgets).toEqual([
            { id: "legacy", name: "", include: [{ kind: "recurring", groupId: "netflix" }], exclude: [], amount: 50, alertPercent: 80, createdAt: "2026-01-01T00:00:00.000Z" },
            {
                id: "rules",
                name: "Contas",
                include: [{ kind: "category", categoryId: "bills" }],
                exclude: [{ kind: "tag", tagId: "trip" }],
                amount: 200,
                alertPercent: 100,
                createdAt: "2026-02-01T00:00:00.000Z",
            },
        ]);
    });
});

describe("regras de carteira e cartão", () => {
    const context = buildBudgetRuleContext([]);
    const fromWallet = spending("pix", 10, "2026-03-05");
    const onCard = spending("card", 20, "2026-03-05", { creditCardId: "nubank", paymentMethod: "credit_card" });

    it("carteira pega só o que saiu direto dela, não compras no cartão do mesmo banco", () => {
        const rules = { include: [{ kind: "wallet" as const, walletId: "wallet" }], exclude: [] };
        expect(matchesBudgetRules(fromWallet, rules, context)).toBe(true);
        expect(matchesBudgetRules(onCard, rules, context)).toBe(false);
    });

    it("cartão pega as compras do cartão e sobrevive à normalização", () => {
        const [budget] = normalizePlanningBudgets([{ id: "b", include: [{ kind: "creditCard", creditCardId: "nubank" }], exclude: [], amount: 100 }]);
        expect(matchesBudgetRules(onCard, budget, context)).toBe(true);
        expect(matchesBudgetRules(fromWallet, budget, context)).toBe(false);
    });
});
