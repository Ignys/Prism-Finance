import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { WalletAvatar } from "../../common/WalletAvatar";
import type { ItemIconTone } from "./planningTimelineTypes";
import { formatCurrency } from "./planningTimelineUtils";

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
    const activeIconClassName = iconTone === "income" ? "bg-emerald-500/12 text-emerald-200" : "bg-red-500/12 text-red-200";
    const activeAmountClassName = iconTone === "income" ? "text-emerald-200" : "text-red-200";

    return (
        <button
            type="button"
            onClick={() => onToggle(toggleId)}
            onContextMenu={onContextMenu}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-1.5 pr-2.5 text-left transition-colors ${
                active
                    ? "border-white/[0.13] bg-white/[0.06] text-white/88 shadow-[0_10px_30px_-24px_rgba(255,255,255,0.65)] hover:border-white/[0.2] hover:bg-white/[0.09]"
                    : "border-white/[0.04] bg-black/10 text-white/34 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/62"
            }`}
            title={active ? "Ignorar" : "Ativar"}
        >
            <div className="flex items-center gap-2 truncate">
                {Icon ? (
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${active ? activeIconClassName : "bg-white/[0.04] text-white/35"}`}>
                        <Icon size={13} />
                    </span>
                ) : (
                    <WalletAvatar
                        wallet={{ icon: iconName ?? undefined, color: iconColor ?? undefined, name: iconAlt }}
                        className={`h-7 w-7 rounded-md border ${active ? "border-white/[0.12]" : "border-white/[0.05] opacity-55"}`}
                        iconSize={13}
                    />
                )}
                <span className={`min-w-0 flex-1 truncate text-xs ${active ? "font-medium" : ""}`}>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${active ? activeAmountClassName : "text-white/35"}`}>{formatCurrency(amount)}</span>
            </div>
        </button>
    );
}
