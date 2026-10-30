import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { monthPeriod } from "../../context/finance/recurrence/period";
import {
    type PlanningBudget,
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCreditCards,
    useFinanceWallets,
    useFinanceCategories,
    useFinancePlanning,
    useFinanceTags,
    useFinanceTransactionGroups,
    useFinanceTransactions,
} from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { getLocalTodayDate } from "../../lib/localDate";
import { BudgetFormModal, type BudgetFormDraft } from "../modal/BudgetFormModal";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { BudgetCard } from "./budgets/BudgetCard";
import { BudgetDetailView } from "./budgets/BudgetDetailView";
import { BudgetsEmptyState } from "./budgets/BudgetsEmptyState";
import { BudgetsToolbar } from "./budgets/BudgetsToolbar";
import { buildBudgetRuleOptions, createBudgetRuleResolver, getBudgetDisplayName } from "./budgets/budgetRuleOptions";
import type { BudgetRuleSet } from "./budgets/budgetRules";
import { BUDGET_HISTORY_MONTHS, buildBudgetsOverview, previewBudgetRules, suggestBudgetAmount } from "./budgets/budgetUtils";
import { PlanningPageHeader } from "./planning/PlanningPageHeader";
import { mergePlanningUpdate } from "./planning/planningTimelineUtils";
import { formatMonthLabel, getCurrentMonthKey } from "./statement/statementPageShared";

export function BudgetsPage() {
    const planning = useFinancePlanning();
    const categories = useFinanceCategories();
    const groups = useFinanceTransactionGroups();
    const tags = useFinanceTags();
    const beneficiaries = useFinanceBeneficiaries();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const { updatePlanningState } = useFinanceActions();
    const { openModal } = useModal();
    const navigate = useNavigate();
    const location = useLocation();
    const { budgetId } = useParams<{ budgetId?: string }>();
    const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
    const transactions = useFinanceTransactions(monthPeriod(monthKey, BUDGET_HISTORY_MONTHS - 1));
    const budgets = planning.budgets;
    const today = getLocalTodayDate();

    const overview = useMemo(() => buildBudgetsOverview({ budgets, categories, transactions, monthKey, today }), [budgets, categories, monthKey, today, transactions]);
    const ruleOptions = useMemo(() => buildBudgetRuleOptions({ categories, groups, tags, beneficiaries, wallets, creditCards }), [beneficiaries, categories, creditCards, groups, tags, wallets]);
    const { labelOf, visualOf } = useMemo(() => createBudgetRuleResolver(ruleOptions), [ruleOptions]);
    const budgetNameById = useMemo(() => new Map(budgets.map((budget) => [budget.id, getBudgetDisplayName(budget, labelOf)])), [budgets, labelOf]);

    const saveBudgets = (nextBudgets: PlanningBudget[]) => updatePlanningState(mergePlanningUpdate(planning, { budgets: nextBudgets }));

    const handleSubmitBudget = (editingBudget: PlanningBudget | undefined, draft: BudgetFormDraft) => {
        const nextBudget: PlanningBudget = {
            id: editingBudget?.id ?? `planning-budget-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            createdAt: editingBudget?.createdAt ?? new Date().toISOString(),
            ...draft,
        };

        return saveBudgets(editingBudget ? budgets.map((budget) => (budget.id === editingBudget.id ? nextBudget : budget)) : [...budgets, nextBudget]);
    };

    const openBudgetForm = (editingBudget?: PlanningBudget) => {
        const otherBudgets = budgets.filter((budget) => budget.id !== editingBudget?.id);

        openModal(
            <BudgetFormModal
                initialBudget={editingBudget}
                ruleOptions={ruleOptions}
                labelOf={labelOf}
                monthLabel={formatMonthLabel(monthKey)}
                budgetNameById={budgetNameById}
                previewRules={(rules: BudgetRuleSet) => previewBudgetRules(rules, otherBudgets, { categories, transactions, monthKey, today })}
                suggestAmount={(rules: BudgetRuleSet) => suggestBudgetAmount(rules, { categories, transactions, monthKey })}
                onSubmit={(draft) => handleSubmitBudget(editingBudget, draft)}
            />,
        );
    };

    const listPath = location.pathname.startsWith("/orcamentos") ? "/orcamentos" : "/budgets";
    const openBudget = (id: string) => navigate(`${listPath}/${id}`);
    const backToList = () => navigate(listPath);

    const confirmDeleteBudget = (budget: PlanningBudget) => {
        openModal(
            <ConfirmActionModal
                title="Excluir orçamento"
                description={`O orçamento "${budgetNameById.get(budget.id) ?? "sem nome"}" será removido. Suas transações não são alteradas.`}
                confirmLabel="Excluir"
                onConfirm={async () => {
                    await saveBudgets(budgets.filter((item) => item.id !== budget.id));
                    if (budgetId === budget.id) backToList();
                }}
            />,
        );
    };

    if (budgetId) {
        const progress = overview.progresses.find((item) => item.budget.id === budgetId);

        if (!progress) {
            return (
                <div className="flex min-h-full flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-white/55">Este orçamento não existe mais.</p>
                    <button type="button" onClick={backToList} className="rounded-xl border border-white/[0.1] px-3.5 py-2 text-sm text-white/80 hover:bg-white/[0.06]">
                        Voltar para orçamentos
                    </button>
                </div>
            );
        }

        const { iconName, color } = visualOf(progress.budget.include[0]);

        return (
            <BudgetDetailView
                progress={progress}
                name={budgetNameById.get(progress.budget.id) ?? "Orçamento"}
                iconName={iconName}
                color={color}
                monthKey={monthKey}
                onMonthChange={setMonthKey}
                budgetNameById={budgetNameById}
                onBack={backToList}
                onEdit={() => openBudgetForm(progress.budget)}
                onDelete={() => confirmDeleteBudget(progress.budget)}
            />
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-3">
            <PlanningPageHeader toolbar={<BudgetsToolbar monthKey={monthKey} onMonthChange={setMonthKey} onCreate={() => openBudgetForm()} />} />

            {budgets.length === 0 ? (
                <BudgetsEmptyState onCreate={() => openBudgetForm()} />
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {overview.progresses.map((progress, index) => {
                            const { iconName, color } = visualOf(progress.budget.include[0]);

                            return (
                                <BudgetCard
                                    key={progress.budget.id}
                                    index={index}
                                    progress={progress}
                                    name={budgetNameById.get(progress.budget.id) ?? "Orçamento"}
                                    iconName={iconName}
                                    color={color}
                                    onOpen={() => openBudget(progress.budget.id)}
                                />
                            );
                        })}
                    </section>
                </>
            )}
        </div>
    );
}
