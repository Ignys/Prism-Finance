import { formatCurrency } from "./planningTimelineUtils";

interface PlanningTimelineSectionProps {
    horizontalMode?: boolean;
    title: string;
    active: boolean;
    onSelect: () => void;
    visibleItemCount: number;
    totalItemCount: number;
    total: number;
    totalClassName?: string;
}

export function PlanningTimelineSection({ title, active, onSelect, visibleItemCount, totalItemCount, total, totalClassName = "text-white/78", horizontalMode = false }: PlanningTimelineSectionProps) {
    const renderedCount = visibleItemCount === totalItemCount ? visibleItemCount.toString() : `${visibleItemCount}/${totalItemCount}`;

    if (horizontalMode) {
        return (
            <div>
                <button
                    type="button"
                    onClick={onSelect}
                    className={`w-38 rounded border p-1.5 px-2.5 h-full text-left transition-colors ${
                        active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <p className={`text-[11px] uppercase tracking-wider ${active ? "text-cyan-100" : "text-white/42"}`}>{title}</p>
                        <span className="rounded-full bg-white/10 px-1 text-xs text-white/70">{renderedCount}</span>
                    </div>
                    <div className={`flex items-center justify-between text-sm ${active ? "border-cyan-300/35" : "border-white/[0.3]"}`}>
                        <span className={totalClassName}>{formatCurrency(total)}</span>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={onSelect}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                }`}
            >
                <p className={`text-xs uppercase tracking-wider ${active ? "text-cyan-100" : "text-white/42"}`}>{title}</p>
                <div className={`mt-1 flex items-center justify-between ${active ? "border-cyan-300/35" : "border-white/[0.3]"}`}>
                    <span className="rounded-full bg-white/10 p-0.5 px-1.5 text-xs text-white/70">{renderedCount}</span>
                    <span className={totalClassName}>{formatCurrency(total)}</span>
                </div>
            </button>
        </div>
    );
}
