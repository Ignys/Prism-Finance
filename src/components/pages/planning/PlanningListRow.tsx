import { Trash2 } from "lucide-react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import type { ItemIconTone } from "./planningTimelineTypes";
import { formatCurrency } from "./planningTimelineUtils";

interface PlanningListRowProps {
    label: string;
    amount: number;
    iconName: string | null;
    iconTone: ItemIconTone;
    valueClassName: string;
    onDelete?: () => void;
    deleteLabel?: string;
}

export function PlanningListRow({ label, amount, iconName, iconTone, valueClassName, onDelete, deleteLabel }: PlanningListRowProps) {
    const Icon = getCategoryIconComponent(iconName, iconTone);

    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/18 p-1.5 pr-2.5">
            <div className="flex min-w-0 items-center gap-2">
                <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        iconTone === "income" ? "bg-emerald-500/10 text-emerald-200" : "bg-orange-500/10 text-orange-200"
                    }`}
                >
                    <Icon size={14} />
                </span>
                <p className="truncate text-sm text-white/82">{label}</p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${valueClassName}`}>{formatCurrency(amount)}</span>
                {onDelete ? (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-red-200"
                        aria-label={deleteLabel}
                        title="Remover"
                    >
                        <Trash2 size={14} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
