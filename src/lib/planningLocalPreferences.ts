import {
    DEFAULT_PLANNING_STATE,
    type PlanningState,
    type ReportPeriod,
} from "../context/finance/financeCore";

export const PLANNING_LOCAL_PREFERENCES_SECTION = "planning";

export type PlanningLocalPreferences = Pick<
    PlanningState,
    | "disabledInheritedExpenseIds"
    | "disabledIncomeIds"
    | "disabledSimulatedExpenseIds"
    | "disabledSimulatedIncomeIds"
    | "timelineSelectedWalletIds"
    | "timelineCompareMode"
    | "timelineHorizontalMode"
    | "timelineMonthCount"
    | "reportsSelectedWalletIds"
    | "reportsSelectedCreditCardIds"
    | "reportsPeriod"
>;

export type SyncedPlanningPayload = Pick<PlanningState, "simulatedExpenses" | "simulatedIncomes" | "wishlistSelections" | "revenueOverrides">;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
        return fallback;
    }

    return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function asTimelineMonthCount(value: unknown, fallback: PlanningState["timelineMonthCount"]): PlanningState["timelineMonthCount"] {
    return value === 3 || value === 6 || value === 9 || value === 12 ? value : fallback;
}

function isValidMonthKey(value: unknown): value is string {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeReportPeriod(value: unknown, fallback: ReportPeriod): ReportPeriod {
    if (!isRecord(value)) {
        return fallback;
    }

    const startMonth = isValidMonthKey(value.startMonth) ? value.startMonth : fallback.startMonth;
    const endMonth = isValidMonthKey(value.endMonth) ? value.endMonth : fallback.endMonth;
    return startMonth <= endMonth ? { startMonth, endMonth } : { startMonth: endMonth, endMonth: startMonth };
}

export function getDefaultPlanningLocalPreferences(): PlanningLocalPreferences {
    return extractPlanningLocalPreferences(DEFAULT_PLANNING_STATE);
}

export function normalizePlanningLocalPreferences(value: unknown): PlanningLocalPreferences {
    const fallback = getDefaultPlanningLocalPreferences();
    if (!isRecord(value)) {
        return fallback;
    }

    return {
        disabledInheritedExpenseIds: asStringArray(value.disabledInheritedExpenseIds, fallback.disabledInheritedExpenseIds),
        disabledIncomeIds: asStringArray(value.disabledIncomeIds, fallback.disabledIncomeIds),
        disabledSimulatedExpenseIds: asStringArray(value.disabledSimulatedExpenseIds, fallback.disabledSimulatedExpenseIds),
        disabledSimulatedIncomeIds: asStringArray(value.disabledSimulatedIncomeIds, fallback.disabledSimulatedIncomeIds),
        timelineSelectedWalletIds: asStringArray(value.timelineSelectedWalletIds, fallback.timelineSelectedWalletIds),
        timelineCompareMode: asBoolean(value.timelineCompareMode, fallback.timelineCompareMode),
        timelineHorizontalMode: asBoolean(value.timelineHorizontalMode, fallback.timelineHorizontalMode),
        timelineMonthCount: asTimelineMonthCount(value.timelineMonthCount, fallback.timelineMonthCount),
        reportsSelectedWalletIds: asStringArray(value.reportsSelectedWalletIds, fallback.reportsSelectedWalletIds),
        reportsSelectedCreditCardIds: asStringArray(value.reportsSelectedCreditCardIds, fallback.reportsSelectedCreditCardIds),
        reportsPeriod: normalizeReportPeriod(value.reportsPeriod, fallback.reportsPeriod),
    };
}

export function extractPlanningLocalPreferences(planning: PlanningState): PlanningLocalPreferences {
    return {
        disabledInheritedExpenseIds: planning.disabledInheritedExpenseIds ?? [],
        disabledIncomeIds: planning.disabledIncomeIds ?? [],
        disabledSimulatedExpenseIds: planning.disabledSimulatedExpenseIds ?? [],
        disabledSimulatedIncomeIds: planning.disabledSimulatedIncomeIds ?? [],
        timelineSelectedWalletIds: planning.timelineSelectedWalletIds ?? [],
        timelineCompareMode: planning.timelineCompareMode ?? DEFAULT_PLANNING_STATE.timelineCompareMode,
        timelineHorizontalMode: planning.timelineHorizontalMode ?? DEFAULT_PLANNING_STATE.timelineHorizontalMode,
        timelineMonthCount: planning.timelineMonthCount ?? DEFAULT_PLANNING_STATE.timelineMonthCount,
        reportsSelectedWalletIds: planning.reportsSelectedWalletIds ?? [],
        reportsSelectedCreditCardIds: planning.reportsSelectedCreditCardIds ?? [],
        reportsPeriod: planning.reportsPeriod ?? DEFAULT_PLANNING_STATE.reportsPeriod,
    };
}

export function mergePlanningLocalPreferences(planning: PlanningState, preferences: PlanningLocalPreferences): PlanningState {
    return {
        ...planning,
        ...normalizePlanningLocalPreferences(preferences),
    };
}

export function toSyncedPlanningPayload(planning: PlanningState): SyncedPlanningPayload {
    return {
        simulatedExpenses: planning.simulatedExpenses,
        simulatedIncomes: planning.simulatedIncomes,
        wishlistSelections: planning.wishlistSelections,
        revenueOverrides: planning.revenueOverrides,
    };
}

export function toSupabasePlanningState(planning: PlanningState): PlanningState {
    return {
        ...DEFAULT_PLANNING_STATE,
        ...toSyncedPlanningPayload(planning),
    };
}

export function arePlanningLocalPreferencesEqual(left: PlanningState, right: PlanningState): boolean {
    return JSON.stringify(extractPlanningLocalPreferences(left)) === JSON.stringify(extractPlanningLocalPreferences(right));
}

export function areSyncedPlanningFieldsEqual(left: PlanningState, right: PlanningState): boolean {
    return JSON.stringify(toSyncedPlanningPayload(left)) === JSON.stringify(toSyncedPlanningPayload(right));
}
