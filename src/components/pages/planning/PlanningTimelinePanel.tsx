import { PlanningMonthCard } from "./PlanningMonthCard";
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
    return (
        <section className="flex min-w-0 w-full flex-col text-left">
            <div className={`elegant-scrollbar grow -mx-1 flex gap-2 overflow-auto px-1 pb-1 ${horizontalMode ? "flex-row" : "flex-col"}`}>
                {months.map((month) => (
                    <PlanningMonthCard
                        key={month.monthKey}
                        month={month}
                        compareMode={compareMode}
                        horizontalMode={!horizontalMode}
                        isSelected={selectedMonthKey === month.monthKey}
                        selectedPanel={selectedPanel}
                        onSelectPanel={onSelectPanel}
                    />
                ))}
            </div>
        </section>
    );
}
