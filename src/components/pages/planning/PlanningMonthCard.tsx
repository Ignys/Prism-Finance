import { BALANCE_TONE_CLASS_NAMES, type MonthProjection, type PlanningPanel } from "./planningTimelineTypes";
import { buildPlanningTimelineMonthSummary } from "./planningTimelineMonthSummary";
import { formatCurrency } from "./planningTimelineUtils";
import { PlanningTimelineSection } from "./PlanningTimelineSection";

interface PlanningMonthCardProps {
    month: MonthProjection;
    compareMode: boolean;
    isSelected: boolean;
    selectedPanel: PlanningPanel;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}

export function PlanningMonthCard({ month, compareMode, isSelected, selectedPanel, onSelectPanel }: PlanningMonthCardProps) {
    const { actionItems, footerBalanceTone, visibleAccumulated, visibleMonthBalance } = buildPlanningTimelineMonthSummary(month, compareMode);

    return (
        <article className="flex w-[300px] shrink-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-semibold uppercase text-white md:text-xl">
                        {month.shortMonthLabel}
                        <span className="mx-1.5 text-xs font-normal text-white/80">{month.year}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {month.isCurrentMonth ? <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-cyan-200">Atual</span> : null}
                </div>
            </div>

            <div className="mt-4 space-y-1">
                <div>
                    <button type="button" className="mb-1.5 w-full border-b border-white/[0.07] px-1 pb-1.5 text-left transition-colors">
                        <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-light uppercase tracking-wider text-white/42">Saldo inicial do mês</p>
                            <span className="shrink-0 text-sm font-light text-white/42">{formatCurrency(month.openingMonthBalance)}</span>
                        </div>
                    </button>
                </div>

                {actionItems.map((item) => (
                    <PlanningTimelineSection
                        key={item.panel}
                        title={item.title}
                        active={isSelected && selectedPanel === item.panel}
                        onSelect={() => onSelectPanel(month.monthKey, item.panel)}
                        countLabel={item.countLabel}
                        icon={item.icon}
                        iconBackgroundClassName={item.iconBackgroundClassName}
                        totalLabel={item.valueLabel}
                        totalClassName={item.valueClassName}
                    />
                ))}
            </div>

            <footer className="mt-auto pt-4">
                <div className="space-y-3 border-t border-white/[0.07] pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanço mensal</p>
                    </div>
                    <p className={`mt-1 text-2xl font-semibold ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>{formatCurrency(visibleMonthBalance)}</p>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo final</p>
                        <p className={`mt-1 text-xl font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(visibleAccumulated)}</p>
                    </div>
                </div>
            </footer>
        </article>
    );
}
