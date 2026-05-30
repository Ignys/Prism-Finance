import type { LucideIcon } from "lucide-react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import type { ItemIconTone } from "./planningTimelineTypes";
import { formatCurrency } from "./planningTimelineUtils";

interface PlanningToggleRowProps {
    active: boolean;
    amount: number;
    label: string;
    iconTone: ItemIconTone;
    iconName: string | null;
    onToggle: (itemId: string) => void;
    toggleId: string;
    customIcon?: LucideIcon;
}

export function PlanningToggleRow({ active, amount, label, iconTone, iconName, onToggle, toggleId, customIcon }: PlanningToggleRowProps) {
    const Icon = customIcon ?? getCategoryIconComponent(iconName, iconTone);
    const activeIconClassName = iconTone === "income" ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200";
    const activeAmountClassName = iconTone === "income" ? "text-emerald-200" : "text-red-200";
    const activeIndicatorClassName = iconTone === "income" ? "border-emerald-400/50 bg-emerald-400/70" : "border-red-400/50 bg-red-400/70";

    return (
        <button
            type="button"
            onClick={() => onToggle(toggleId)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-1.5 pr-2.5 text-left transition-colors ${
                active
                    ? "border-white/[0.06] bg-black/18 text-white/78 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    : "border-white/[0.04] bg-black/10 text-white/34 hover:border-white/[0.1] hover:text-white/60"
            }`}
            title={active ? "Ignorar" : "Ativar"}
        >
            <div className="flex items-center gap-2 truncate">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${active ? activeIconClassName : "bg-white/[0.04] text-white/35"}`}>
                    <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${active ? activeAmountClassName : "text-white/35"}`}>{formatCurrency(amount)}</span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${active ? activeIndicatorClassName : "border-white/20 bg-transparent"}`} />
            </div>
        </button>
    );
}
