import { Plus } from "lucide-react";
import { MonthPickerControl } from "../../common/MonthPickerControl";
import { formatMonthLabel, getCurrentMonthKey, shiftMonth } from "../statement/statementPageShared";

interface BudgetsToolbarProps {
    monthKey: string;
    onMonthChange: (monthKey: string) => void;
    /** Sem ele, o botão "Novo orçamento" não aparece (subpágina de um orçamento). */
    onCreate?: () => void;
}

export function BudgetsToolbar({ monthKey, onMonthChange, onCreate }: BudgetsToolbarProps) {
    return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="min-w-56 flex-1 sm:flex-none">
                <MonthPickerControl
                    selectedMonth={monthKey}
                    onMonthChange={onMonthChange}
                    formatMonthLabel={formatMonthLabel}
                    shiftMonth={shiftMonth}
                    shortcutMonth={getCurrentMonthKey()}
                    shortcutLabel="Ir para o mês atual"
                />
            </div>
            {onCreate ? (
                <button
                    type="button"
                    onClick={onCreate}
                    className="inline-flex h-[40px] items-center gap-2 rounded-xl bg-white px-3.5 text-sm font-semibold text-black transition-colors hover:bg-white/85"
                >
                    <Plus size={15} />
                    Novo orçamento
                </button>
            ) : null}
        </div>
    );
}
