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

interface PlanningListRowProps {
    active?: boolean;
    label: string;
    amount: number;
    iconName: string | null;
    iconTone: ItemIconTone;
    customIcon?: LucideIcon;
    valueClassName: string;
    onClick?: () => void;
    onContextMenu?: (event: MouseEvent) => void;
}

export function PlanningListRow({ active = true, label, amount, iconName, iconTone, customIcon, valueClassName, onClick, onContextMenu }: PlanningListRowProps) {
    const categoryIconTone = iconTone === "income" || iconTone === "expense" ? iconTone : undefined;
    const Icon = customIcon ?? getCategoryIconComponent(iconName, categoryIconTone);
    const interactiveClassName = onClick ? `cursor-pointer ${getPlanningRowHoverClassName(active)}` : onContextMenu ? `cursor-context-menu ${getPlanningRowHoverClassName(active)}` : "";
    const rowClassName = [
        PLANNING_ROW_BASE_CLASS_NAME,
        getPlanningRowStateClassName(active),
        interactiveClassName,
    ]
        .filter(Boolean)
        .join(" ");
    const iconClassName = getPlanningRowIconClassName(iconTone, active);
    const amountClassName = getPlanningRowAmountClassName(iconTone, active, valueClassName);

    return (
        <button type="button" onClick={onClick} onContextMenu={onContextMenu} className={rowClassName} title={onClick ? (active ? "Ignorar" : "Ativar") : undefined}>
            <div className="flex min-w-0 items-center gap-2">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
                    <Icon size={13} />
                </span>
                <p className={`truncate text-xs ${active ? "font-medium" : ""}`}>{label}</p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${amountClassName}`}>{formatCurrency(amount)}</span>
            </div>
        </button>
    );
}
