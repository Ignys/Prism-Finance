import { ArrowDownRight, ArrowUpRight, Pencil } from "lucide-react";
import type { ReactElement } from "react";
import type { BalanceTone, MonthProjection, PlanningPanel } from "./planningTimelineTypes";
import { formatCurrency, getAmountClassName, getBalanceTone, getProjectionBgClassName, getProjectionNetClassName, roundToCents } from "./planningTimelineUtils";

export interface PlanningTimelineActionItem {
    panel: PlanningPanel;
    title: string;
    icon: ReactElement;
    iconBackgroundClassName: string;
    countLabel: string;
    valueLabel: string;
    valueClassName: string;
}

export interface PlanningTimelineMonthSummary {
    actionItems: PlanningTimelineActionItem[];
    footerBalanceTone: BalanceTone;
    visibleAccumulated: number;
    visibleMonthBalance: number;
}

export function buildPlanningTimelineMonthSummary(month: MonthProjection, compareMode: boolean): PlanningTimelineMonthSummary {
    const visibleMonthBalance = compareMode ? month.currentMonthBalance : month.originalMonthBalance;
    const visibleAccumulated = compareMode ? month.currentAccumulated : month.originalAccumulated;
    const visibleIncome = compareMode ? month.activeIncome : month.originalIncome;
    const visibleIncomeCount = compareMode ? month.activeIncomeCount : month.originalIncomeCount;
    const visibleExpenseCount = compareMode ? month.inheritedItems.filter((item) => !item.isDisabled).length : month.inheritedItems.length;
    const projectionItemCount = compareMode ? month.simulatedIncomeItems.length + month.simulatedExpenseItems.length + month.wishlistExpenseItems.length : 0;
    const projectionTotal = compareMode ? roundToCents(month.simulatedIncome - month.simulatedExpenses) : 0;
    const footerBalanceTone = getBalanceTone(visibleMonthBalance, compareMode ? month.currentIncome : month.originalIncome);

    return {
        actionItems: [
            {
                panel: "income",
                title: "Receitas",
                icon: <ArrowUpRight size={18} />,
                iconBackgroundClassName: "bg-emerald-400/10",
                countLabel: formatPlanningItemCount(visibleIncomeCount, month.originalIncomeCount),
                valueLabel: formatCurrency(visibleIncome),
                valueClassName: getAmountClassName("income", visibleIncome),
            },
            {
                panel: "inherited_expenses",
                title: "Despesas",
                icon: <ArrowDownRight size={18} />,
                iconBackgroundClassName: "bg-red-400/10",
                countLabel: formatPlanningItemCount(visibleExpenseCount, month.inheritedItems.length),
                valueLabel: formatCurrency(compareMode ? month.activeInheritedExpenses : month.inheritedExpenses),
                valueClassName: getAmountClassName("expense", month.inheritedExpenses),
            },
            {
                panel: "projections",
                title: "Projeções",
                icon: <Pencil size={15} />,
                iconBackgroundClassName: compareMode ? getProjectionBgClassName(projectionTotal) : "bg-white/10",
                countLabel: formatPlanningItemCount(projectionItemCount, projectionItemCount),
                valueLabel: compareMode ? formatCurrency(Math.abs(projectionTotal)) : "DESATIVADAS",
                valueClassName: compareMode ? getProjectionNetClassName(projectionTotal) : "text-white/42",
            },
        ],
        footerBalanceTone,
        visibleAccumulated,
        visibleMonthBalance,
    };
}

function formatPlanningItemCount(visibleItemCount: number, totalItemCount: number): string {
    return visibleItemCount === totalItemCount ? visibleItemCount.toString() : `${visibleItemCount}/${totalItemCount}`;
}
