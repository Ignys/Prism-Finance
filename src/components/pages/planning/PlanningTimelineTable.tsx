import { motion, useReducedMotion } from "framer-motion";
import { BALANCE_TONE_CLASS_NAMES, type MonthProjection, type PlanningPanel } from "./planningTimelineTypes";
import { getPlanningMonthEntranceDelay, PLANNING_ENTRANCE_EASE } from "./planningEntranceMotion";
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
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.article
            initial={
                shouldReduceMotion
                    ? false
                    : {
                          opacity: 0,
                          y: 18,
                          scale: 0.992,
                          filter: "blur(7px)",
                          clipPath: "inset(0 0 100% 0 round 8px)",
                      }
            }
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
                clipPath: "inset(0 0 0% 0 round 8px)",
            }}
            transition={{ duration: 0.68, ease: PLANNING_ENTRANCE_EASE }}
            className="relative isolate overflow-hidden"
        >
            <table className="relative z-10 w-full table-fixed border-collapse text-left">
                <thead>
                    <motion.tr
                        initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.42, ease: PLANNING_ENTRANCE_EASE }}
                        className="border-b border-white/[0.08] text-[10px] uppercase tracking-[0.1em] text-white/36"
                    >
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
                    </motion.tr>
                </thead>
                <tbody>
                    {months.map((month, index) => (
                        <PlanningTimelineTableRow
                            key={month.monthKey}
                            month={month}
                            index={index}
                            compareMode={compareMode}
                            selectedPanel={selectedPanel}
                            isSelected={selectedMonthKey === month.monthKey}
                            shouldReduceMotion={Boolean(shouldReduceMotion)}
                            onSelectPanel={onSelectPanel}
                        />
                    ))}
                </tbody>
            </table>
        </motion.article>
    );
}

function PlanningTimelineTableRow({
    month,
    index,
    compareMode,
    selectedPanel,
    isSelected,
    shouldReduceMotion,
    onSelectPanel,
}: {
    month: MonthProjection;
    index: number;
    compareMode: boolean;
    selectedPanel: PlanningPanel;
    isSelected: boolean;
    shouldReduceMotion: boolean;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}) {
    const { actionItems, footerBalanceTone, visibleAccumulated, visibleMonthBalance } = buildPlanningTimelineMonthSummary(month, compareMode);

    return (
        <motion.tr
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                delay: shouldReduceMotion ? 0 : getPlanningMonthEntranceDelay(index),
                duration: 0.46,
                ease: PLANNING_ENTRANCE_EASE,
            }}
            className="border-b border-white/[0.06] last:border-b-0"
        >
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
        </motion.tr>
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
