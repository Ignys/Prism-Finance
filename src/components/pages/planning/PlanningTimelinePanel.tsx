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
    if (!horizontalMode) {
        return (
            <section className="flex min-w-0 pt-1 w-full flex-col text-left">
                <div className="elegant-scrollbar grow -mx-1 overflow-auto px-1 pb-1">
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

    return (
        <section className="flex min-w-0 w-full flex-col text-left">
            <div className="elegant-scrollbar grow -mx-1 flex gap-2 overflow-auto px-1 pb-1">
                {months.map((month) => (
                    <PlanningMonthCard
                        key={month.monthKey}
                        month={month}
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
