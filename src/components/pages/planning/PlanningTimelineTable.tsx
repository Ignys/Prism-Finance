import { BALANCE_TONE_CLASS_NAMES, type MonthProjection, type PlanningPanel } from "./planningTimelineTypes";
import type { PlanningTimelineActionItem } from "./planningTimelineMonthSummary";
import { buildPlanningTimelineMonthSummary } from "./planningTimelineMonthSummary";
import { formatCurrency } from "./planningTimelineUtils";

interface PlanningTimelineTableProps {
    months: MonthProjection[];
    selectedMonthKey: string | null;
    selectedPanel: PlanningPanel;
    compareMode: boolean;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}

// Mesmo tratamento das transações: "R$" menor e apagado, número em destaque.
function MoneyText({ label }: { label: string }) {
    const match = /^(-?)\s*R\$\s*(.+)$/.exec(label);
    if (!match) {
        return <>{label}</>;
    }

    return (
        <>
            <span className="mr-1 text-[0.75em] font-normal opacity-50">R$</span>
            {match[1]}
            {match[2]}
        </>
    );
}

const CELL_CLASS = "border-b border-white/[0.05] py-2.5";

export function PlanningTimelineTable({ months, selectedMonthKey, selectedPanel, compareMode, onSelectPanel }: PlanningTimelineTableProps) {
    const currentMonthIndex = months.findIndex((month) => month.isCurrentMonth);

    return (
        <article className="relative isolate overflow-hidden">
            <div className="elegant-scrollbar relative z-10 overflow-x-auto pb-1">
                <table className="finance-table w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-left tabular-nums">
                    <thead>
                        <tr className="text-white/50">
                            <th scope="col" className="w-28 px-3 text-left desktop:w-30">
                                Mês
                            </th>
                            <th scope="col" className="w-25 px-2 text-left desktop:w-26">
                                Receitas
                            </th>
                            <th scope="col" className="w-25 px-2 text-left desktop:w-26">
                                Despesas
                            </th>
                            <th scope="col" className="w-26 px-2 text-left desktop:w-26">
                                Projeções
                            </th>
                            <th scope="col" className="w-22 px-2 text-right desktop:w-24">
                                Balanço mensal
                            </th>
                            <th scope="col" className="w-22 px-2 pr-3 text-right desktop:w-28">
                                Saldo final
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((month, index) => (
                            <PlanningTimelineTableRow
                                key={month.monthKey}
                                month={month}
                                compareMode={compareMode}
                                selectedPanel={selectedPanel}
                                isSelected={selectedMonthKey === month.monthKey}
                                isPast={index < currentMonthIndex}
                                onSelectPanel={onSelectPanel}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </article>
    );
}

function PlanningTimelineTableRow({
    month,
    compareMode,
    selectedPanel,
    isSelected,
    isPast,
    onSelectPanel,
}: {
    month: MonthProjection;
    compareMode: boolean;
    selectedPanel: PlanningPanel;
    isSelected: boolean;
    isPast: boolean;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}) {
    const { actionItems, footerBalanceTone, visibleAccumulated, visibleMonthBalance } = buildPlanningTimelineMonthSummary(month, compareMode);

    return (
        <tr aria-selected={isSelected} className={isPast && !isSelected ? "opacity-55 transition-opacity hover:opacity-100" : undefined}>
            <th scope="row" className={`${CELL_CLASS} px-3 align-middle font-normal`}>
                <div className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold capitalize text-white desktop:text-base">
                        {month.shortMonthLabel}
                        <span className="font-normal text-white/40">/{month.year}</span>
                        {month.isCurrentMonth ? <span className="ml-1.5 rounded bg-sky-400/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-sky-200">Atual</span> : null}
                    </span>
                    <span className="mt-0.5 text-xs text-white/45" title="Saldo inicial">
                        <MoneyText label={formatCurrency(month.openingMonthBalance)} />
                    </span>
                </div>
            </th>
            {actionItems.map((item) => (
                <PlanningTimelineTableButtonCell key={item.panel} item={item} active={isSelected && selectedPanel === item.panel} onSelect={() => onSelectPanel(month.monthKey, item.panel)} />
            ))}
            <td className={`${CELL_CLASS} px-2 text-right text-sm font-semibold desktop:text-base ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}><MoneyText label={formatCurrency(visibleMonthBalance)} /></td>
            <td className={`${CELL_CLASS} px-2 pr-3 text-right text-sm font-semibold desktop:text-base ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>
                <MoneyText label={formatCurrency(visibleAccumulated)} />
            </td>
        </tr>
    );
}

function PlanningTimelineTableButtonCell({ item, active, onSelect }: { item: PlanningTimelineActionItem; active: boolean; onSelect: () => void }) {
    return (
        <td className={`${CELL_CLASS} px-1 text-right`}>
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                    active ? "border-sky-300/40 bg-sky-400/[0.12]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.05]"
                }`}
            >
                <div className="flex min-w-0 items-center justify-center gap-2">
                    <div className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md p-1 desktop:flex ${item.valueClassName} ${item.iconBackgroundClassName}`}>{item.icon}</div>
                    <span className={`block truncate text-xs font-medium desktop:text-sm ${item.valueClassName}`}><MoneyText label={item.valueLabel} /></span>
                </div>
                <span className={`block shrink-0 rounded px-1 text-[10px] desktop:text-[11px] ${active ? "bg-sky-400/20 text-sky-100" : "bg-white/[0.04] text-white/45"}`}>{item.countLabel}</span>
            </button>
        </td>
    );
}
