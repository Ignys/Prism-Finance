import { type ComponentProps, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useFinanceBeneficiaries, useFinanceCategories, useFinanceCreditCards, useFinancePlanning, useFinanceTags, useFinanceTransactionGroups, useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { monthPeriod } from "../../context/finance/recurrence/period";
import { getLocalTodayDate } from "../../lib/localDate";
import { buildBudgetsOverview } from "../pages/budgets/budgetUtils";
import { getCurrentMonthKey } from "../pages/statement/statementPageShared";
import { buildBudgetRuleOptions, createBudgetRuleResolver, getBudgetDisplayName } from "../pages/budgets/budgetRuleOptions";
import { NavSubitems } from "./NavSubitems";

type BudgetNavSubitemsProps = Omit<ComponentProps<typeof NavSubitems>, "items" | "activeId">;

export function BudgetNavSubitems(props: BudgetNavSubitemsProps) {
    const { budgets } = useFinancePlanning();
    const categories = useFinanceCategories();
    const groups = useFinanceTransactionGroups();
    const tags = useFinanceTags();
    const beneficiaries = useFinanceBeneficiaries();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const { pathname } = useLocation();
    const monthKey = getCurrentMonthKey();
    const today = getLocalTodayDate();
    const transactions = useFinanceTransactions(monthPeriod(monthKey, 0));
    const basePath = pathname.startsWith("/orcamentos") ? "/orcamentos" : "/budgets";

    const items = useMemo(() => {
        const { labelOf } = createBudgetRuleResolver(buildBudgetRuleOptions({ categories, groups, tags, beneficiaries, wallets, creditCards }));
        const { progresses } = buildBudgetsOverview({ budgets, categories, transactions, monthKey, today });
        return progresses.map(({ budget, usedPercent }) => ({
            id: budget.id,
            label: getBudgetDisplayName(budget, labelOf),
            path: `${basePath}/${budget.id}`,
            marker: <BudgetUsageRing percent={usedPercent} />,
        }));
    }, [basePath, beneficiaries, budgets, categories, creditCards, groups, monthKey, tags, today, transactions, wallets]);

    const activeId = items.find((item) => item.path === pathname)?.id ?? null;

    return <NavSubitems {...props} items={items} activeId={activeId} />;
}

const RING_RADIUS = 5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function BudgetUsageRing({ percent }: { percent: number }) {
    const filled = Math.min(Math.max(percent, 0), 100) / 100;

    return (
        <svg viewBox="0 0 14 14" className="size-4 -rotate-90">
            <title>{`${Math.round(percent)}% usado este mês`}</title>
            <circle cx="7" cy="7" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="2" />
            <circle cx="7" cy="7" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${filled * RING_LENGTH} ${RING_LENGTH}`} />
            {percent > 100 ? <circle cx="7" cy="7" r="2" fill="currentColor" /> : null}
        </svg>
    );
}
