import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import type { ItemIconTone } from "./planningTimelineTypes";
import { formatCurrency } from "./planningTimelineUtils";
import {
    getPlanningRowAmountClassName,
    getPlanningRowHoverClassName,
    getPlanningRowIconClassName,
    getPlanningRowStateClassName,
    PLANNING_ROW_BASE_CLASS_NAME,
} from "./planningRowStyles";

interface PlanningToggleRowProps {
    active: boolean;
    amount: number;
    label: string;
    iconTone: ItemIconTone;
    iconName: string | null;
    onToggle: (itemId: string) => void;
    toggleId: string;
    customIcon?: LucideIcon;
    onContextMenu?: (event: MouseEvent) => void;
}

export function PlanningToggleRow({ active, amount, label, iconTone, iconName, onToggle, toggleId, customIcon, onContextMenu }: PlanningToggleRowProps) {
    const categoryIconTone = iconTone === "income" || iconTone === "expense" ? iconTone : undefined;
    const Icon = customIcon ?? getCategoryIconComponent(iconName, categoryIconTone);
    const rowClassName = `${PLANNING_ROW_BASE_CLASS_NAME} ${getPlanningRowStateClassName(active)} ${getPlanningRowHoverClassName(active)}`;
    const iconClassName = getPlanningRowIconClassName(iconTone, active);
    const amountClassName = getPlanningRowAmountClassName(iconTone, active);

    return (
        <button
            type="button"
            onClick={() => onToggle(toggleId)}
            onContextMenu={onContextMenu}
            className={rowClassName}
            title={active ? "Ignorar" : "Ativar"}
        >
            <div className="flex items-center gap-2 truncate">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
                    <Icon size={13} />
                </span>
                <span className={`min-w-0 flex-1 truncate text-xs ${active ? "font-medium" : ""}`}>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${amountClassName}`}>{formatCurrency(amount)}</span>
            </div>
        </button>
    );
}
