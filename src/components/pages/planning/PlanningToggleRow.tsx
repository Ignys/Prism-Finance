import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { WalletAvatar } from "../../common/WalletAvatar";
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
    iconColor?: string | null;
    iconAlt?: string;
    onToggle: (itemId: string) => void;
    toggleId: string;
    customIcon?: LucideIcon;
    onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function PlanningToggleRow({ active, amount, label, iconTone, iconName, iconColor, iconAlt = "Carteira", onToggle, toggleId, customIcon, onContextMenu }: PlanningToggleRowProps) {
    const Icon = customIcon;
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
                {Icon ? (
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
                        <Icon size={13} />
                    </span>
                ) : (
                    <WalletAvatar
                        wallet={{ icon: iconName ?? "", color: iconColor ?? "", name: iconAlt }}
                        className={`h-7 w-7 rounded-md border ${active ? "border-white/[0.12]" : "border-white/[0.05] opacity-55"}`}
                        iconSize={13}
                    />
                )}
                <span className={`min-w-0 flex-1 truncate text-xs ${active ? "font-medium" : ""}`}>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${amountClassName}`}>{formatCurrency(amount)}</span>
            </div>
        </button>
    );
}
