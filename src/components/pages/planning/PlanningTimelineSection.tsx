import type { ReactNode } from "react";
import { formatCurrency } from "./planningTimelineUtils";

interface PlanningTimelineSectionProps {
    title: string;
    active: boolean;
    onSelect: () => void;
    countLabel?: string;
    icon?: ReactNode;
    iconBackgroundClassName?: string;
    visibleItemCount?: number;
    totalItemCount?: number;
    total?: number;
    totalLabel?: string;
    totalClassName?: string;
}

export function PlanningTimelineSection({
    title,
    active,
    onSelect,
    countLabel,
    icon,
    iconBackgroundClassName = "bg-white/10",
    visibleItemCount = 0,
    totalItemCount = visibleItemCount,
    total = 0,
    totalLabel,
    totalClassName = "text-white/78",
}: PlanningTimelineSectionProps) {
    const renderedCount = countLabel ?? (visibleItemCount === totalItemCount ? visibleItemCount.toString() : `${visibleItemCount}/${totalItemCount}`);
    const renderedTotal = totalLabel ?? formatCurrency(total);

    return (
        <div>
            <button
                type="button"
                onClick={onSelect}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                }`}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {icon ? (
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBackgroundClassName} ${totalClassName}`}>
                                {icon}
                            </span>
                        ) : null}
                        <div className="min-w-0">
                            <p className={`truncate text-xs uppercase tracking-wider ${active ? "text-cyan-100" : "text-white/42"}`}>{title}</p>
                            <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? "bg-cyan-300/12 text-cyan-100" : "bg-white/10 text-white/60"}`}>
                                {renderedCount}
                            </span>
                        </div>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${totalClassName}`}>{renderedTotal}</span>
                </div>
            </button>
        </div>
    );
}
