import type { PlanningBudget, PlanningBudgetRule } from "./domainTypes";
import { asNumber, asString } from "./valueNormalization";

export const DEFAULT_BUDGET_ALERT_PERCENT = 80;
const MAX_BUDGET_NAME_LENGTH = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBudgetRule(value: unknown): PlanningBudgetRule | null {
    if (!isRecord(value)) {
        return null;
    }

    switch (value.kind) {
        case "category": {
            const categoryId = asString(value.categoryId, "");
            return categoryId ? { kind: "category", categoryId } : null;
        }
        case "recurring": {
            const groupId = asString(value.groupId, "");
            return groupId ? { kind: "recurring", groupId } : null;
        }
        case "tag": {
            const tagId = asString(value.tagId, "");
            return tagId ? { kind: "tag", tagId } : null;
        }
        case "beneficiary": {
            const beneficiaryId = asString(value.beneficiaryId, "");
            return beneficiaryId ? { kind: "beneficiary", beneficiaryId } : null;
        }
        case "wallet": {
            const walletId = asString(value.walletId, "");
            return walletId ? { kind: "wallet", walletId } : null;
        }
        case "creditCard": {
            const creditCardId = asString(value.creditCardId, "");
            return creditCardId ? { kind: "creditCard", creditCardId } : null;
        }
        case "text": {
            const text = asString(value.text, "");
            return text ? { kind: "text", text } : null;
        }
        default:
            return null;
    }
}

export function getBudgetRuleKey(rule: PlanningBudgetRule): string {
    switch (rule.kind) {
        case "category":
            return `category:${rule.categoryId}`;
        case "recurring":
            return `recurring:${rule.groupId}`;
        case "tag":
            return `tag:${rule.tagId}`;
        case "beneficiary":
            return `beneficiary:${rule.beneficiaryId}`;
        case "wallet":
            return `wallet:${rule.walletId}`;
        case "creditCard":
            return `creditCard:${rule.creditCardId}`;
        case "text":
            return `text:${rule.text.toLowerCase()}`;
    }
}

function normalizeBudgetRules(value: unknown): PlanningBudgetRule[] {
    const rulesByKey = new Map<string, PlanningBudgetRule>();
    (Array.isArray(value) ? value : []).forEach((rawRule) => {
        const rule = normalizeBudgetRule(rawRule);
        if (rule) {
            rulesByKey.set(getBudgetRuleKey(rule), rule);
        }
    });

    return Array.from(rulesByKey.values());
}

function normalizePlanningBudget(value: unknown, index: number): PlanningBudget | null {
    if (!isRecord(value)) {
        return null;
    }

    // Formato antigo: um único `target` (categoria ou série), sem nome.
    const include = normalizeBudgetRules(value.include ?? (value.target ? [value.target] : []));
    const amount = Math.round(Math.abs(asNumber(value.amount, 0)) * 100) / 100;
    if (include.length === 0 || amount <= 0) {
        return null;
    }

    const createdAt = typeof value.createdAt === "string" && !Number.isNaN(new Date(value.createdAt).getTime()) ? value.createdAt : new Date().toISOString();

    return {
        id: asString(value.id, `planning-budget-${index}-${Date.now()}`),
        name: asString(value.name, "").slice(0, MAX_BUDGET_NAME_LENGTH),
        include,
        exclude: normalizeBudgetRules(value.exclude),
        amount,
        alertPercent: Math.min(100, Math.max(1, Math.round(asNumber(value.alertPercent, DEFAULT_BUDGET_ALERT_PERCENT)))),
        createdAt,
    };
}

export function normalizePlanningBudgets(value: unknown): PlanningBudget[] {
    const budgetsById = new Map<string, PlanningBudget>();

    (Array.isArray(value) ? value : []).forEach((rawBudget, index) => {
        const budget = normalizePlanningBudget(rawBudget, index);
        if (budget) {
            budgetsById.set(budget.id, budget);
        }
    });

    return Array.from(budgetsById.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
