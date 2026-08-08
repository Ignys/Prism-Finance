import type { PlanningSimulatedExpense } from "../../../context/FinanceContext";

export type BalanceTone = "positive" | "tight" | "negative";
export type ItemIconTone = "expense" | "income" | "wishlist" | "neutral";
export type SimulatedIncomeSource = "simulated_income" | "legacy_override";
export type PlanningPanel = "income" | "inherited_expenses" | "projections";
export type PlanningTab = "timeline" | "reports";

export interface IncomeItem {
    id: string;
    source: "transaction" | "transfer";
    transactionId: string;
    label: string;
    amount: number;
    iconName: string | null;
    isDisabled: boolean;
}

export interface SimulatedIncomeItem {
    id: string;
    label: string;
    amount: number;
    iconName: string | null;
    source: SimulatedIncomeSource;
    isDisabled: boolean;
    overrideMonthKey?: string;
}

export interface InheritedExpenseItem {
    id: string;
    source: "transaction" | "transfer" | "invoice";
    transactionId?: string;
    invoiceId?: string;
    label: string;
    amount: number;
    iconName: string | null;
    isDisabled: boolean;
}

export interface MonthReality {
    originalIncome: number;
    activeIncome: number;
    originalIncomeCount: number;
    activeIncomeCount: number;
    incomeItems: IncomeItem[];
    walletSpendings: number;
    invoiceSpendings: number;
    inheritedExpenses: number;
    activeInheritedExpenses: number;
    disabledInheritedExpenses: number;
    inheritedItems: InheritedExpenseItem[];
}

export interface WishlistProjectionItem {
    id: string;
    wishItemId: string;
    monthKey: string;
    label: string;
    amount: number;
    createdAt: string;
}

export interface SimulatedExpenseItem extends PlanningSimulatedExpense {
    isDisabled: boolean;
}

export interface MonthProjection extends MonthReality {
    monthKey: string;
    monthLabel: string;
    shortMonthLabel: string;
    year: string;
    isCurrentMonth: boolean;
    openingMonthBalance: number;
    simulatedIncome: number;
    simulatedIncomeItems: SimulatedIncomeItem[];
    currentIncome: number;
    simulatedExpenses: number;
    simulatedExpenseItems: SimulatedExpenseItem[];
    wishlistExpenseItems: WishlistProjectionItem[];
    originalMonthBalance: number;
    currentMonthBalance: number;
    originalAccumulated: number;
    currentAccumulated: number;
}

export interface TimelineProjection {
    openingBalance: number;
    months: MonthProjection[];
}

export const TIMELINE_MONTH_OPTIONS = [3, 6, 9, 12] as const;
export const DEFAULT_TIMELINE_MONTHS = 9;

export const BALANCE_TONE_CLASS_NAMES: Record<BalanceTone, string> = {
    negative: "text-red-300",
    tight: "text-amber-300",
    positive: "text-emerald-300",
};
