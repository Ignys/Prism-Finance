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

export function PlanningTimelineTable({ months, selectedMonthKey, selectedPanel, compareMode, onSelectPanel }: PlanningTimelineTableProps) {
    return (
        <article>
            <table className="w-full table-fixed border-collapse text-left">
                <thead>
                    <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.1em] text-white/36">
                        <th scope="col" className="w-28 px-2 pb-2 font-normal desktop:w-30">
                            DATA & <br />
                            Saldo Inicial
                        </th>
                        <th scope="col" className="w-25 px-2 pb-2 text-left font-normal desktop:w-26">
                            Receitas
                        </th>
                        <th scope="col" className="w-25 px-2 pb-2 text-left font-normal desktop:w-26">
                            Despesas
                        </th>
                        <th scope="col" className="w-26 px-2 pb-2 text-left font-normal desktop:w-26">
                            Projeções
                        </th>
                        <th scope="col" className="w-22 px-2 pb-2 text-right font-normal desktop:w-24">
                            Balanço mensal
                        </th>
                        <th scope="col" className="w-22 px-2 pb-2 text-right font-normal desktop:w-28 pr-3">
                            Saldo final
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {months.map((month) => (
                        <PlanningTimelineTableRow
                            key={month.monthKey}
                            month={month}
                            compareMode={compareMode}
                            selectedPanel={selectedPanel}
                            isSelected={selectedMonthKey === month.monthKey}
                            onSelectPanel={onSelectPanel}
                        />
                    ))}
                </tbody>
            </table>
        </article>
    );
}

function PlanningTimelineTableRow({
    month,
    compareMode,
    selectedPanel,
    isSelected,
    onSelectPanel,
}: {
    month: MonthProjection;
    compareMode: boolean;
    selectedPanel: PlanningPanel;
    isSelected: boolean;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}) {
    const { actionItems, footerBalanceTone, visibleAccumulated, visibleMonthBalance } = buildPlanningTimelineMonthSummary(month, compareMode);

    return (
        <tr className="border-b border-white/[0.06] last:border-b-0">
            <th scope="row" className="px-2 py-2.5 align-middle font-normal">
                <div className="flex flex-col">
                    <span className="text-sm font-semibold uppercase text-white desktop:text-base">{`${month.shortMonthLabel}/${month.year}`}</span>
                    <span className="text-xs text-white/55">{formatCurrency(month.openingMonthBalance)}</span>
                </div>
            </th>
            {actionItems.map((item) => (
                <PlanningTimelineTableButtonCell key={item.panel} item={item} active={isSelected && selectedPanel === item.panel} onSelect={() => onSelectPanel(month.monthKey, item.panel)} />
            ))}
            <td className={`px-2 py-2.5 text-right text-sm font-semibold desktop:text-lg ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>{formatCurrency(visibleMonthBalance)}</td>
            <td className={`px-2 py-2.5 text-right text-sm font-semibold desktop:pr-3 desktop:text-lg ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>
                {formatCurrency(visibleAccumulated)}
            </td>
        </tr>
    );
}

function PlanningTimelineTableButtonCell({ item, active, onSelect }: { item: PlanningTimelineActionItem; active: boolean; onSelect: () => void }) {
    return (
        <td className="px-1 py-2.5 text-right">
            <button
                type="button"
                onClick={onSelect}
                className={`flex w-full items-center justify-between rounded border p-1.5 transition-colors ${
                    active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                }`}
            >
                <div className="flex min-w-0 items-center justify-center gap-2">
                    <div className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded p-1 desktop:flex ${item.valueClassName} ${item.iconBackgroundClassName}`}>
                        {item.icon}
                    </div>
                    <span className={`block truncate text-xs font-medium desktop:text-sm ${item.valueClassName}`}>{item.valueLabel}</span>
                </div>
                <span className={`block shrink-0 text-[9px] uppercase tracking-[0.08em] desktop:text-[10px] ${active ? "text-cyan-100" : "text-white/42"}`}>{item.countLabel}</span>
            </button>
        </td>
    );
}
