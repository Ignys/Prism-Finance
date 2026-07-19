import type { ItemIconTone } from "./planningTimelineTypes";

const ACTIVE_ICON_CLASS_NAMES: Record<ItemIconTone, string> = {
    income: "bg-emerald-500/12 text-emerald-200",
    expense: "bg-orange-500/12 text-orange-200",
    wishlist: "bg-rose-500/12 text-rose-200",
    neutral: "bg-white/[0.06] text-white/70",
};

const ACTIVE_AMOUNT_CLASS_NAMES: Record<ItemIconTone, string> = {
    income: "text-emerald-200",
    expense: "text-orange-200",
    wishlist: "text-rose-200",
    neutral: "text-white/78",
};

export const PLANNING_ROW_BASE_CLASS_NAME = "flex w-full items-center justify-between gap-2 rounded-lg border p-1.5 pr-2.5 text-left transition-colors";

export function getPlanningRowStateClassName(active: boolean): string {
    return active
        ? "border-white/[0.13] bg-white/[0.06] text-white/88 shadow-[0_10px_30px_-24px_rgba(255,255,255,0.65)]"
        : "border-white/[0.04] bg-black/10 text-white/34";
}

export function getPlanningRowHoverClassName(active: boolean): string {
    return active ? "hover:border-white/[0.2] hover:bg-white/[0.09]" : "hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/62";
}

export function getPlanningRowIconClassName(iconTone: ItemIconTone, active: boolean): string {
    if (!active) {
        return "bg-white/[0.04] text-white/35";
    }

    return ACTIVE_ICON_CLASS_NAMES[iconTone];
}

export function getPlanningRowAmountClassName(iconTone: ItemIconTone, active: boolean, overrideClassName?: string): string {
    if (!active) {
        return "text-white/35";
    }

    return overrideClassName ?? ACTIVE_AMOUNT_CLASS_NAMES[iconTone];
}
