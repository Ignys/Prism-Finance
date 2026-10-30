import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "../planning/PlanningReportsPanel";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import { formatMonthLabel } from "../statement/statementPageShared";
import type { BudgetHistoryPoint } from "./budgetUtils";

const GRID_LINES = 4;
const OVER_COLOR = "#f87171";
const CHART_HEIGHT_CLASS = "h-56";
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

interface BudgetHistoryChartProps {
    history: BudgetHistoryPoint[];
    cap: number;
    color: string | null;
}

function shortMonth(monthKey: string): string {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

/** Gasto mês a mês contra o teto atual, no mesmo desenho do "Mês a mês" dos relatórios. */
export function BudgetHistoryChart({ history, cap, color }: BudgetHistoryChartProps) {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const reduceMotion = useReducedMotion();
    const peak = Math.max(1, cap, ...history.map((point) => point.amount));
    const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => (peak / GRID_LINES) * index);
    const focused = history.find((point) => point.monthKey === activeKey) ?? history[history.length - 1];
    const pastMonths = history.slice(0, -1);
    const average = pastMonths.length > 0 ? pastMonths.reduce((sum, point) => sum + point.amount, 0) / pastMonths.length : null;
    const monthsOver = history.filter((point) => point.amount > cap).length;
    const fill = color ?? "#e5e5e5";
    const focusedDiff = focused ? cap - focused.amount : 0;

    return (
        <PlanningReportsPanel title="Últimos meses" aside={<span className="text-xs text-white/45">{monthsOver === 0 ? "Nenhum mês acima do teto" : `${monthsOver} ${monthsOver === 1 ? "mês" : "meses"} acima do teto`}</span>}>
            <dl className="mb-6 grid grid-cols-3 gap-4" aria-live="polite">
                <div className="min-w-0 border-l-2 pl-3" style={{ borderColor: fill }}>
                    <dt className="truncate text-xs capitalize text-white/45">{focused ? formatMonthLabel(focused.monthKey) : "—"}</dt>
                    <dd className="mt-1 truncate text-base text-white @md:text-lg" style={REPORT_MONO_STYLE}>
                        {focused ? formatReportCurrency(focused.amount) : "—"}
                    </dd>
                </div>
                <div className="min-w-0 border-l-2 border-white/30 pl-3">
                    <dt className="text-xs text-white/45">{focusedDiff >= 0 ? "Sobrou do teto" : "Passou do teto"}</dt>
                    <dd className={`mt-1 truncate text-base @md:text-lg ${focusedDiff >= 0 ? "text-emerald-200" : "text-rose-300"}`} style={REPORT_MONO_STYLE}>
                        {formatReportCurrency(Math.abs(focusedDiff))}
                    </dd>
                </div>
                <div className="min-w-0 border-l-2 border-white/15 pl-3">
                    <dt className="text-xs text-white/45">Média anterior</dt>
                    <dd className="mt-1 truncate text-base text-white/80 @md:text-lg" style={REPORT_MONO_STYLE}>
                        {average !== null ? formatReportCurrency(average) : "—"}
                    </dd>
                </div>
            </dl>

            <div className="flex flex-1 gap-3" onMouseLeave={() => setActiveKey(null)}>
                <ol className={`flex ${CHART_HEIGHT_CLASS} w-9 shrink-0 flex-col-reverse justify-between text-right text-[10px] text-white/30`} style={REPORT_MONO_STYLE} aria-hidden>
                    {ticks.map((tick) => (
                        <li key={tick} className="-my-1.5 leading-3">
                            {compactFormatter.format(tick)}
                        </li>
                    ))}
                </ol>
                <div className="relative min-w-0 flex-1">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 flex ${CHART_HEIGHT_CLASS} flex-col justify-between`} aria-hidden>
                        {ticks.map((tick) => (
                            <span key={tick} className="h-px w-full bg-white/[0.06]" />
                        ))}
                    </div>
                    <div className={`pointer-events-none absolute inset-x-0 top-0 ${CHART_HEIGHT_CLASS}`} aria-hidden>
                        <span className="absolute inset-x-0 z-10 border-t border-dashed border-white/45" style={{ bottom: `${(cap / peak) * 100}%` }}>
                            <span className="absolute -top-5 right-0 rounded bg-[#111111] px-1 text-[10px] text-white/55">teto {compactFormatter.format(cap)}</span>
                        </span>
                    </div>
                    <ol className="relative flex gap-1.5">
                        {history.map((point, index) => {
                            const isActive = point.monthKey === focused?.monthKey;
                            const isOver = point.amount > cap;
                            const dimmed = activeKey !== null && !isActive;

                            return (
                                <li key={point.monthKey} className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        aria-pressed={activeKey === point.monthKey}
                                        aria-label={`Ver ${formatMonthLabel(point.monthKey)}`}
                                        onMouseEnter={() => setActiveKey(point.monthKey)}
                                        onFocus={() => setActiveKey(point.monthKey)}
                                        onBlur={() => setActiveKey(null)}
                                        onClick={() => setActiveKey(activeKey === point.monthKey ? null : point.monthKey)}
                                        className={`flex w-full flex-col items-center rounded-md transition-opacity focus-visible:outline focus-visible:outline-white/40 ${dimmed ? "opacity-35" : ""}`}
                                    >
                                        <span className={`relative flex ${CHART_HEIGHT_CLASS} w-full items-end justify-center`}>
                                            <span
                                                className={`absolute inset-y-0 w-[58%] max-w-11 rounded-t-[10px] transition-colors ${isActive ? "bg-white/[0.05]" : "bg-white/[0.02]"}`}
                                                aria-hidden
                                            />
                                            <motion.span
                                                className="relative flex w-[58%] max-w-11 flex-col-reverse overflow-hidden rounded-t-[10px] transition-opacity"
                                                style={{ opacity: index === history.length - 1 || isActive ? 1 : 0.6, boxShadow: isActive ? `0 0 24px -6px ${fill}` : undefined }}
                                                initial={reduceMotion ? false : { height: 0 }}
                                                animate={{ height: `${Math.max(1.5, (point.amount / peak) * 100)}%` }}
                                                transition={{ duration: 0.7, delay: 0.05 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                                            >
                                                <span className="block flex-1" style={{ background: `linear-gradient(to top, ${fill}4d, ${fill})` }} />
                                                {isOver ? (
                                                    <span
                                                        className="block shrink-0 border-b-2 border-[#111111]"
                                                        style={{ height: `${((point.amount - cap) / point.amount) * 100}%`, background: `linear-gradient(to top, ${OVER_COLOR}99, ${OVER_COLOR})` }}
                                                        title={`${formatReportCurrency(point.amount - cap)} acima do teto`}
                                                    />
                                                ) : null}
                                            </motion.span>
                                            {isActive ? (
                                                <span
                                                    className="absolute z-20 -translate-y-1.5 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-black"
                                                    style={{ bottom: `${Math.max(1.5, (point.amount / peak) * 100)}%`, ...REPORT_MONO_STYLE }}
                                                >
                                                    {compactFormatter.format(point.amount)}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className={`mt-2 text-[11px] capitalize ${isActive ? "text-white" : "text-white/50"}`}>{shortMonth(point.monthKey)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
        </PlanningReportsPanel>
    );
}
