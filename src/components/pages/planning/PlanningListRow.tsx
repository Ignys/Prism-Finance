import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import type { ItemIconTone } from "./planningTimelineTypes";
import { formatCurrency } from "./planningTimelineUtils";

interface PlanningListRowProps {
    active?: boolean;
    label: string;
    amount: number;
    iconName: string | null;
    iconTone: ItemIconTone;
    customIcon?: LucideIcon;
    valueClassName: string;
    onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

export function PlanningListRow({ active = true, label, amount, iconName, iconTone, customIcon, valueClassName, onContextMenu }: PlanningListRowProps) {
    const Icon = customIcon ?? getCategoryIconComponent(iconName, iconTone);
    const iconClassName =
        iconTone === "income"
            ? active
                ? "bg-emerald-500/12 text-emerald-200"
                : "bg-white/[0.04] text-white/35"
            : active
              ? "bg-red-500/12 text-red-200"
              : "bg-white/[0.04] text-white/35";

    return (
        <div
            onContextMenu={onContextMenu}
            className={`flex items-center justify-between gap-2 rounded-lg border p-1.5 pr-2.5 transition-colors ${
                active
                    ? "border-white/[0.13] bg-white/[0.06] shadow-[0_10px_30px_-24px_rgba(255,255,255,0.65)]"
                    : "border-white/[0.04] bg-black/10 opacity-65"
            } ${onContextMenu ? "cursor-context-menu hover:border-white/[0.2] hover:bg-white/[0.09]" : ""}`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
                    <Icon size={14} />
                </span>
                <p className={`truncate text-sm ${active ? "text-white/82" : "text-white/42"}`}>{label}</p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${active ? valueClassName : "text-white/35"}`}>{formatCurrency(amount)}</span>
            </div>
        </div>
    );
}
