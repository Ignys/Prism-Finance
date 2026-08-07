import { motion } from "framer-motion";
import { BarChart3, ListTree, type LucideIcon } from "lucide-react";
import type { CategoryReportView } from "./planningReportsCategoryTypes";

interface PlanningReportsCategoryTabsProps {
    activeView: CategoryReportView;
    layoutId: string;
    onChange: (view: CategoryReportView) => void;
}

const CATEGORY_VIEW_OPTIONS: Array<{ value: CategoryReportView; label: string; Icon: LucideIcon }> = [
    { value: "chart", label: "Gráfico", Icon: BarChart3 },
    { value: "details", label: "Detalhes", Icon: ListTree },
];

export function PlanningReportsCategoryTabs({ activeView, layoutId, onChange }: PlanningReportsCategoryTabsProps) {
    return (
        <div className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.035] p-0.5">
            {CATEGORY_VIEW_OPTIONS.map(({ value, label }) => {
                const isActive = activeView === value;

                return (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onChange(value)}
                        className="relative isolate inline-flex h-5 min-w-24 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors"
                    >
                        {isActive ? (
                            <motion.span
                                layoutId={layoutId}
                                className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[0_10px_24px_-16px_rgba(255,255,255,0.55)]"
                                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                            />
                        ) : null}
                        <motion.span
                            className="relative z-10 inline-flex items-center gap-1.5"
                            animate={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.52)" }}
                            whileHover={{ color: "rgba(255,255,255,0.8)" }}
                            transition={{ duration: 0.18 }}
                        >
                            {label}
                        </motion.span>
                    </button>
                );
            })}
        </div>
    );
}
