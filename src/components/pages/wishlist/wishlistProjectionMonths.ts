import type { PlanningState } from "../../../context/FinanceContext";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
});

export interface WishlistProjectionMonth {
    monthKey: string;
    label: string;
}

function capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatProjectionMonthLabel(monthKey: string): string {
    const [yearPart, monthPart] = monthKey.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return monthKey;
    }

    return capitalizeLabel(MONTH_LABEL_FORMATTER.format(new Date(year, month - 1, 1)).replace(".", ""));
}

export function buildWishlistProjectionMonthByItemId(planning: PlanningState, currentMonthKey: string): Map<string, WishlistProjectionMonth> {
    const projectedMonthByItemId = new Map<string, WishlistProjectionMonth>();

    planning.wishlistSelections.forEach((selection) => {
        if (selection.monthKey < currentMonthKey) {
            return;
        }

        const existingProjection = projectedMonthByItemId.get(selection.wishItemId);
        if (existingProjection && existingProjection.monthKey <= selection.monthKey) {
            return;
        }

        projectedMonthByItemId.set(selection.wishItemId, {
            monthKey: selection.monthKey,
            label: formatProjectionMonthLabel(selection.monthKey),
        });
    });

    return projectedMonthByItemId;
}
