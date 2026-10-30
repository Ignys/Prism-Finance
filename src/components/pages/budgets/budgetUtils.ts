import type { Category, PlanningBudget, Transaction } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { shiftMonth } from "../statement/statementPageShared";
import { buildBudgetRuleContext, matchesBudgetRules, type BudgetRuleContext, type BudgetRuleSet } from "./budgetRules";

export const BUDGET_HISTORY_MONTHS = 6;
const SUGGESTION_MONTHS = 3;

/** exceeded: realizado passou do teto · at_risk: o previsto do mês vai passar · warning: realizado atingiu o alerta. */
export type BudgetStatus = "ok" | "warning" | "at_risk" | "exceeded";

export interface BudgetHistoryPoint {
    monthKey: string;
    amount: number;
}

export interface BudgetTransactionEntry {
    transaction: Transaction;
    isForecast: boolean;
    /** Outros orçamentos em que a mesma despesa também entra. */
    alsoInBudgetIds: string[];
}

export interface BudgetProgress {
    budget: PlanningBudget;
    /** Lançado até hoje. */
    spent: number;
    /** Agendado para depois de hoje ou ocorrência projetada de série. */
    forecast: number;
    projected: number;
    remaining: number;
    usedPercent: number;
    status: BudgetStatus;
    /** Quanto ainda dá para gastar por dia até o fim do mês (só no mês corrente). */
    dailyAllowance: number | null;
    history: BudgetHistoryPoint[];
    /** Transações do mês que compõem `spent` (lançadas) e `forecast` (previstas), mais recentes primeiro. */
    entries: BudgetTransactionEntry[];
    /** Quantas dessas transações também entram em outro orçamento. */
    sharedCount: number;
}

export interface BudgetsOverview {
    progresses: BudgetProgress[];
    budgeted: number;
    /** Totais por despesa distinta: uma despesa em dois orçamentos conta uma vez. */
    spent: number;
    projected: number;
    unbudgetedSpent: number;
    exceededCount: number;
    attentionCount: number;
}

export interface BudgetComputationInput {
    budgets: PlanningBudget[];
    categories: Category[];
    transactions: Transaction[];
    monthKey: string;
    /** yyyy-MM-dd */
    today: string;
}

const STATUS_SEVERITY: Record<BudgetStatus, number> = { exceeded: 3, at_risk: 2, warning: 1, ok: 0 };

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function sumValues(transactions: Transaction[]): number {
    return roundToCents(transactions.reduce((sum, transaction) => sum + transaction.value, 0));
}

export function isBudgetSpending(transaction: Transaction): boolean {
    return (
        transaction.type === "spending" &&
        transaction.systemKind !== "invoice_payment" &&
        !transaction.isNonCashSettlement &&
        transaction.status !== "cancelled" &&
        transaction.status !== "skipped"
    );
}

function isInMonth(transaction: Transaction, monthKey: string): boolean {
    return getMonthKeyFromDateValue(transaction.date) === monthKey;
}

function isForecast(transaction: Transaction, today: string): boolean {
    return Boolean(transaction.isProjected) || transaction.date.slice(0, 10) > today;
}

function getDaysLeftInMonth(monthKey: string, today: string): number | null {
    if (!today.startsWith(monthKey)) {
        return null;
    }

    const [year, month] = monthKey.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return lastDay - Number(today.slice(8, 10)) + 1;
}

function resolveStatus(spent: number, projected: number, budget: PlanningBudget): BudgetStatus {
    if (spent > budget.amount) return "exceeded";
    if (projected > budget.amount) return "at_risk";
    if (spent >= (budget.amount * budget.alertPercent) / 100) return "warning";
    return "ok";
}

function findMatchingBudgetIds(transaction: Transaction, budgets: PlanningBudget[], context: BudgetRuleContext): string[] {
    return budgets.filter((budget) => matchesBudgetRules(transaction, budget, context)).map((budget) => budget.id);
}

function toMonthEntries(matched: Transaction[], monthKey: string, today: string, alsoIn: (transaction: Transaction) => string[]): BudgetTransactionEntry[] {
    return matched
        .filter((transaction) => isInMonth(transaction, monthKey))
        .map((transaction) => ({ transaction, isForecast: isForecast(transaction, today), alsoInBudgetIds: alsoIn(transaction) }))
        .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date) || b.transaction.value - a.transaction.value);
}

function sumEntries(entries: BudgetTransactionEntry[]) {
    const projected = sumValues(entries.map((entry) => entry.transaction));
    const forecast = sumValues(entries.filter((entry) => entry.isForecast).map((entry) => entry.transaction));
    return { projected, forecast, spent: roundToCents(projected - forecast) };
}

export function buildBudgetsOverview({ budgets, categories, transactions, monthKey, today }: BudgetComputationInput): BudgetsOverview {
    const context = buildBudgetRuleContext(categories);
    const spending = transactions.filter(isBudgetSpending);
    const monthSpending = spending.filter((transaction) => isInMonth(transaction, monthKey));
    const budgetIdsByTransactionId = new Map(monthSpending.map((transaction) => [transaction.id, findMatchingBudgetIds(transaction, budgets, context)]));
    const daysLeft = getDaysLeftInMonth(monthKey, today);
    const historyMonthKeys = Array.from({ length: BUDGET_HISTORY_MONTHS }, (_, index) => shiftMonth(monthKey, index - BUDGET_HISTORY_MONTHS + 1));

    const progresses = budgets.map((budget): BudgetProgress => {
        const matched = spending.filter((transaction) => matchesBudgetRules(transaction, budget, context));
        const entries = toMonthEntries(matched, monthKey, today, (transaction) => (budgetIdsByTransactionId.get(transaction.id) ?? []).filter((id) => id !== budget.id));
        const { spent, forecast, projected } = sumEntries(entries);

        return {
            budget,
            spent,
            forecast,
            projected,
            remaining: roundToCents(budget.amount - projected),
            usedPercent: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
            status: resolveStatus(spent, projected, budget),
            dailyAllowance: daysLeft === null ? null : roundToCents(Math.max(0, budget.amount - projected) / daysLeft),
            history: historyMonthKeys.map((historyMonthKey) => ({
                monthKey: historyMonthKey,
                amount: sumValues(matched.filter((transaction) => isInMonth(transaction, historyMonthKey))),
            })),
            entries,
            sharedCount: entries.filter((entry) => entry.alsoInBudgetIds.length > 0).length,
        };
    });

    progresses.sort((a, b) => STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status] || b.projected / b.budget.amount - a.projected / a.budget.amount);

    const isBudgeted = (transaction: Transaction) => (budgetIdsByTransactionId.get(transaction.id) ?? []).length > 0;
    const isPosted = (transaction: Transaction) => !isForecast(transaction, today);

    return {
        progresses,
        budgeted: roundToCents(budgets.reduce((sum, budget) => sum + budget.amount, 0)),
        spent: sumValues(monthSpending.filter((transaction) => isBudgeted(transaction) && isPosted(transaction))),
        projected: sumValues(monthSpending.filter(isBudgeted)),
        unbudgetedSpent: sumValues(monthSpending.filter((transaction) => !isBudgeted(transaction) && isPosted(transaction))),
        exceededCount: progresses.filter((progress) => progress.status === "exceeded").length,
        attentionCount: progresses.filter((progress) => progress.status === "warning" || progress.status === "at_risk").length,
    };
}

export interface BudgetRulesPreview {
    entries: BudgetTransactionEntry[];
    spent: number;
    forecast: number;
    projected: number;
}

/** O que regras ainda em edição puxariam no mês; `otherBudgets` aponta as sobreposições. */
export function previewBudgetRules(
    rules: BudgetRuleSet,
    otherBudgets: PlanningBudget[],
    { categories, transactions, monthKey, today }: Omit<BudgetComputationInput, "budgets">,
): BudgetRulesPreview {
    const context = buildBudgetRuleContext(categories);
    const matched = transactions.filter((transaction) => isBudgetSpending(transaction) && matchesBudgetRules(transaction, rules, context));
    const entries = toMonthEntries(matched, monthKey, today, (transaction) => findMatchingBudgetIds(transaction, otherBudgets, context));

    return { entries, ...sumEntries(entries) };
}

/** Média mensal dos 3 meses anteriores a `monthKey`, arredondada para cima em reais; null sem histórico. */
export function suggestBudgetAmount(
    rules: BudgetRuleSet,
    { categories, transactions, monthKey }: Pick<BudgetComputationInput, "categories" | "transactions" | "monthKey">,
): number | null {
    const context = buildBudgetRuleContext(categories);
    const previousMonthKeys = new Set(Array.from({ length: SUGGESTION_MONTHS }, (_, index) => shiftMonth(monthKey, -(index + 1))));
    const total = sumValues(
        transactions.filter(
            (transaction) => isBudgetSpending(transaction) && previousMonthKeys.has(getMonthKeyFromDateValue(transaction.date)) && matchesBudgetRules(transaction, rules, context),
        ),
    );

    return total > 0 ? Math.ceil(total / SUGGESTION_MONTHS) : null;
}
