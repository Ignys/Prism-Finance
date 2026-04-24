import { StatementMonthSelector } from "../../common/StatementMonthSelector";

interface PlanningFiltersPanelProps {
    selectedMonth: string;
    onMonthChange: (value: string) => void;
}

export function PlanningFiltersPanel({ selectedMonth, onMonthChange }: PlanningFiltersPanelProps) {
    return (
        <section className="pt-1">
            <div className="relative flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-left">
                        <h1 className="text-2xl font-semibold text-white">Planejamentos</h1>
                    </div>

                    <StatementMonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} ariaLabel="Selecionar mes da projecao" />
                </div>
            </div>
        </section>
    );
}
