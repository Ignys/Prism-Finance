import type { Category, PlanningBudget, PlanningBudgetRule, Transaction } from "../../../context/FinanceContext";
import { normalizeComparisonText } from "../../../context/finance/helpers";

export type BudgetRuleSet = Pick<PlanningBudget, "include" | "exclude">;

export interface BudgetRuleContext {
    parentByCategoryId: Map<string, string | null>;
}

export function buildBudgetRuleContext(categories: Category[]): BudgetRuleContext {
    return { parentByCategoryId: new Map(categories.map((category) => [category.id, category.parentId])) };
}

export function matchesBudgetRule(transaction: Transaction, rule: PlanningBudgetRule, { parentByCategoryId }: BudgetRuleContext): boolean {
    switch (rule.kind) {
        case "category":
            return Boolean(transaction.categoryId) && (transaction.categoryId === rule.categoryId || parentByCategoryId.get(transaction.categoryId ?? "") === rule.categoryId);
        case "recurring":
            return transaction.groupId === rule.groupId;
        case "tag":
            return transaction.tagIds.includes(rule.tagId);
        case "beneficiary":
            return transaction.beneficiaryId === rule.beneficiaryId;
        case "wallet":
            // Compra no cartão também carrega a carteira do banco em inWallet; ela pertence ao cartão.
            return !transaction.creditCardId && transaction.inWallet === rule.walletId;
        case "creditCard":
            return transaction.creditCardId === rule.creditCardId;
        case "text":
            return normalizeComparisonText(transaction.description).includes(normalizeComparisonText(rule.text));
    }
}

/** Entra quem atende a alguma regra de inclusão e a nenhuma de exclusão. */
export function matchesBudgetRules(transaction: Transaction, { include, exclude }: BudgetRuleSet, context: BudgetRuleContext): boolean {
    return include.some((rule) => matchesBudgetRule(transaction, rule, context)) && !exclude.some((rule) => matchesBudgetRule(transaction, rule, context));
}
