import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { BUDGET_STATUS_STYLES } from "./budgetStatusStyles";
import type { BudgetProgress } from "./budgetUtils";

interface BudgetCardProps {
    progress: BudgetProgress;
    name: string;
    iconName: string;
    color: string | null;
    index: number;
    onOpen: () => void;
}

/** Cartão enxuto da lista: gasto contra o teto, previsto e a barra. Os detalhes ficam na subpágina. */
export function BudgetCard({ progress, name, iconName, color, index, onOpen }: BudgetCardProps) {
    const { budget, spent, forecast, remaining, status, usedPercent } = progress;
    const statusStyle = BUDGET_STATUS_STYLES[status];
    const Icon = getCategoryIconComponent(iconName, "expense");
    const isAlert = status !== "ok";
    const accent = color ?? "#ffffff";

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}
            onClick={onOpen}
            aria-label={`Abrir orçamento ${name}`}
            className="group relative flex w-full flex-col gap-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-5 text-left transition-colors hover:border-white/[0.18] focus-visible:border-white/[0.32] focus-visible:outline-none"
        >
            <span
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full opacity-[0.10] blur-3xl transition-opacity group-hover:opacity-[0.16]"
                style={{ backgroundColor: accent }}
            />

            <span className="relative flex min-w-0 items-center gap-3">
                <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/80"
                    style={color ? { color, backgroundColor: `${color}1f` } : undefined}
                >
                    <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-medium text-white">{name}</span>
                <ChevronRight size={16} className="shrink-0 text-white/25 transition-colors group-hover:text-white/60" />
            </span>

            <span className="relative flex flex-col gap-3">
                <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                        <span className={`text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums ${remaining < 0 ? statusStyle.textClassName : "text-white"}`}>
                            {formatReportCurrency(Math.abs(remaining))}
                        </span>
                        <span className="ml-2 whitespace-nowrap text-sm text-white/45">{remaining < 0 ? "acima do teto" : "restam"}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-medium tabular-nums ${isAlert ? statusStyle.textClassName : "text-white/55"}`} title={statusStyle.label}>
                        {Math.round(usedPercent)}%
                    </span>
                </span>

                <BudgetProgressBar progress={progress} className="h-2.5" />

                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
                    <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${statusStyle.barClassName}`} />
                        Gasto <span className="tabular-nums text-white/80">{formatReportCurrency(spent)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${statusStyle.forecastBarClassName}`} />
                        Previsto <span className="tabular-nums text-white/80">{forecast > 0 ? formatReportCurrency(forecast) : "—"}</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                        Teto <span className="tabular-nums text-white/80">{formatReportCurrency(budget.amount)}</span>
                    </span>
                </span>
            </span>
        </motion.button>
    );
}
