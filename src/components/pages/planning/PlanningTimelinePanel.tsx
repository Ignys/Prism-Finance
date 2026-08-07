import { PlanningMonthCard } from "./PlanningMonthCard";
import { PlanningTimelineTable } from "./PlanningTimelineTable";
import type { MonthProjection, PlanningPanel } from "./planningTimelineTypes";

interface PlanningTimelinePanelProps {
    months: MonthProjection[];
    selectedMonthKey: string | null;
    selectedPanel: PlanningPanel;
    compareMode: boolean;
    horizontalMode: boolean;
    onSelectPanel: (monthKey: string, panel: PlanningPanel) => void;
}

export function PlanningTimelinePanel({ months, selectedMonthKey, selectedPanel, compareMode, horizontalMode, onSelectPanel }: PlanningTimelinePanelProps) {
   // LINHAS
    if (!horizontalMode) {
        return (
            <section className="flex min-w-0 pt-1 w-full flex-col text-left">
                <div className="elegant-scrollbar grow -mx-1 overflow-y-auto overflow-x-clip px-1 pb-1">
                    <PlanningTimelineTable
                        months={months}
                        selectedMonthKey={selectedMonthKey}
                        selectedPanel={selectedPanel}
                        compareMode={compareMode}
                        onSelectPanel={onSelectPanel}
                    />
                </div>
            </section>
        );
    }

    // COLUNAS
    return (
        <section className="flex min-w-0 w-full flex-col text-left">
            <div className="elegant-scrollbar grow -mx-1 flex gap-2 overflow-x-auto overflow-y-clip px-1 pb-1">
                {months.map((month, index) => (
                    <PlanningMonthCard
                        key={month.monthKey}
                        month={month}
                        index={index}
                        compareMode={compareMode}
                        isSelected={selectedMonthKey === month.monthKey}
                        selectedPanel={selectedPanel}
                        onSelectPanel={onSelectPanel}
                    />
                ))}
            </div>
        </section>
    );
}
