import { BALANCE_TONE_CLASS_NAMES, type MonthProjection, type PlanningPanel } from "./planningTimelineTypes";
import { formatCurrency, getAmountClassName, getBalanceTone, getProjectionNetClassName, roundToCents } from "./planningTimelineUtils";
import { PlanningTimelineSection } from "./PlanningTimelineSection";

interface PlanningMonthCardProps {
    month: MonthProjection;
    compareMode: boolean;
    horizontalMode: boolean;
    isSelected: boolean;
    selectedPanel: PlanningPanel;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}

export function PlanningMonthCard({ month, compareMode, horizontalMode, isSelected, selectedPanel, onSelectPanel }: PlanningMonthCardProps) {
    const visibleMonthBalance = compareMode ? month.currentMonthBalance : month.originalMonthBalance;
    const visibleAccumulated = compareMode ? month.currentAccumulated : month.originalAccumulated;
    const visibleIncome = compareMode ? month.activeIncome : month.originalIncome;
    const visibleIncomeCount = compareMode ? month.activeIncomeCount : month.originalIncomeCount;
    const visibleExpenseCount = compareMode ? month.inheritedItems.filter((item) => !item.isDisabled).length : month.inheritedItems.length;
    const projectionItemCount = compareMode ? month.simulatedIncomeItems.length + month.simulatedExpenseItems.length + month.wishlistExpenseItems.length : 0;
    const projectionTotal = compareMode ? roundToCents(month.simulatedIncome - month.simulatedExpenses) : 0;
    const footerBalanceTone = getBalanceTone(visibleMonthBalance, compareMode ? month.currentIncome : month.originalIncome);

    if (horizontalMode) {
        return (
            <article className="flex justify-between rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
                <header className="flex flex-col items-start justify-center gap-1.5">
                    <div>
                        <p className="text-xl font-semibold text-white">
                            {month.shortMonthLabel}
                            <span className="text-xs mx-1.5 text-white/60 font-light">{month.year}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-4 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compareMode ? "bg-cyan-500/12 text-cyan-200" : "bg-white/[0.05] text-white/48"}`}>
                            {compareMode ? "Projeções" : "Original"}
                        </span>
                    </div>
                </header>

                <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                        <div className="flex flex-col justify-center items-end gap-0.5 w-50 px-1 pr-3 mr-2 transition-colors border-r border-neutral-700">
                            <p className="text-[11px] font-light uppercase tracking-wider text-white/42">SALDO INICIAL DO MÊS</p>
                            <span className="text-sm font-light text-white/42">{formatCurrency(month.openingMonthBalance)}</span>
                        </div>

                        <PlanningTimelineSection
                            horizontalMode
                            title="Receitas"
                            active={isSelected && selectedPanel === "income"}
                            onSelect={() => onSelectPanel(month.monthKey, "income")}
                            visibleItemCount={visibleIncomeCount}
                            totalItemCount={month.originalIncomeCount}
                            total={visibleIncome}
                            totalClassName={getAmountClassName("income", visibleIncome)}
                        />
                        <PlanningTimelineSection
                            horizontalMode
                            title="Despesas"
                            active={isSelected && selectedPanel === "inherited_expenses"}
                            onSelect={() => onSelectPanel(month.monthKey, "inherited_expenses")}
                            visibleItemCount={visibleExpenseCount}
                            totalItemCount={month.inheritedItems.length}
                            total={compareMode ? month.activeInheritedExpenses : month.inheritedExpenses}
                            totalClassName={getAmountClassName("expense", month.inheritedExpenses)}
                        />
                        <PlanningTimelineSection
                            horizontalMode
                            title="Projeções"
                            active={isSelected && selectedPanel === "projections"}
                            onSelect={() => onSelectPanel(month.monthKey, "projections")}
                            visibleItemCount={projectionItemCount}
                            totalItemCount={projectionItemCount}
                            total={projectionTotal}
                            totalClassName={getProjectionNetClassName(projectionTotal)}
                        />
                    </div>

                    <footer className="px-3 h-full">
                        <div className="flex items-center h-full">
                            <div className=" flex flex-col justify-end gap-1 border-x px-4 border-neutral-700 w-45">
                                <p className="text-[11px] font-light uppercase tracking-wider text-white/42">Balanço mensal</p>
                                <p className={` text-xl font-semibold ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>{formatCurrency(visibleMonthBalance)}</p>
                            </div>
                            <div className=" flex flex-col justify-end gap-1 px-4 w-45">
                                <p className="text-[11px] font-light uppercase tracking-wider text-white/42">Saldo final</p>
                                <p className={` text-xl font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(visibleAccumulated)}</p>
                            </div>
                        </div>
                    </footer>
                </div>
            </article>
        );
    }

    return (
        <article className="flex shrink-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 w-[300px]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className=" text-xl uppercase font-semibold text-white">
                        {month.shortMonthLabel}
                        <span className="text-xs mx-1.5 text-white/80 font-normal">{month.year}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {month.isCurrentMonth ? <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-cyan-200">Atual</span> : null}
                </div>
            </div>

            <div className="mt-4 space-y-1">
                <div>
                    <button type="button" className="w-full px-1 pb-1.5 mb-1.5 text-left transition-colors border-b border-white/[0.07]">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-light uppercase tracking-wider text-white/42">SALDO INICIAL DO MÊS</p>
                            <span className="text-sm font-light text-white/42">{formatCurrency(month.openingMonthBalance)}</span>
                        </div>
                    </button>
                </div>

                <PlanningTimelineSection
                    title="Receitas"
                    active={isSelected && selectedPanel === "income"}
                    onSelect={() => onSelectPanel(month.monthKey, "income")}
                    visibleItemCount={visibleIncomeCount}
                    totalItemCount={month.originalIncomeCount}
                    total={visibleIncome}
                    totalClassName={getAmountClassName("income", visibleIncome)}
                />
                <PlanningTimelineSection
                    title="Despesas"
                    active={isSelected && selectedPanel === "inherited_expenses"}
                    onSelect={() => onSelectPanel(month.monthKey, "inherited_expenses")}
                    visibleItemCount={visibleExpenseCount}
                    totalItemCount={month.inheritedItems.length}
                    total={compareMode ? month.activeInheritedExpenses : month.inheritedExpenses}
                    totalClassName={getAmountClassName("expense", month.inheritedExpenses)}
                />
                <PlanningTimelineSection
                    title="Projeções"
                    active={isSelected && selectedPanel === "projections"}
                    onSelect={() => onSelectPanel(month.monthKey, "projections")}
                    visibleItemCount={projectionItemCount}
                    totalItemCount={projectionItemCount}
                    total={projectionTotal}
                    totalClassName={getProjectionNetClassName(projectionTotal)}
                />
            </div>

            <footer className="mt-auto pt-4">
                <div className="space-y-3 border-t border-white/[0.07] pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanço mensal</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compareMode ? "bg-cyan-500/12 text-cyan-200" : "bg-white/[0.05] text-white/48"}`}>
                            {compareMode ? "Projeções" : "Original"}
                        </span>
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
