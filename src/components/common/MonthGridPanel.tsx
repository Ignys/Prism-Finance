import { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthGridPanelProps {
    selectedMonth: string;
    onMonthChange: (monthKey: string) => void;
    // Atalho do rodape: por padrao vai para o mes atual; a pagina de faturas passa a fatura atual.
    shortcutMonth?: string;
    shortcutLabel?: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function padMonthPart(value: number): string {
    return String(value).padStart(2, "0");
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonthPart(referenceDate.getMonth() + 1)}`;
}

function parseYear(monthKey: string): number | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const month = Number(match[2]);
    if (month < 1 || month > 12) {
        return null;
    }

    return Number(match[1]);
}

/**
 * Conteudo do seletor de mes: navegacao de ano, grade com os 12 meses e atalho
 * para o mes atual. Usado dentro dos popovers de mes (filtros e overview).
 */
export function MonthGridPanel({ selectedMonth, onMonthChange, shortcutMonth, shortcutLabel = "Ir para o mês atual" }: MonthGridPanelProps) {
    const [pickerYear, setPickerYear] = useState(() => parseYear(selectedMonth) ?? new Date().getFullYear());

    useEffect(() => {
        const year = parseYear(selectedMonth);
        if (year !== null) {
            setPickerYear(year);
        }
    }, [selectedMonth]);

    const currentMonthKey = getCurrentMonthKey();
    const yearNavClass =
        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white";

    return (
        <div className="relative">
            <div className="flex items-center justify-between">
                <button type="button" onClick={() => setPickerYear((current) => current - 1)} className={yearNavClass} aria-label="Ano anterior" title="Ano anterior">
                    <ChevronLeft size={15} />
                </button>
                <p className="text-sm font-semibold tabular-nums tracking-[0.12em] text-white/90">
                    {pickerYear}
                </p>
                <button type="button" onClick={() => setPickerYear((current) => current + 1)} className={yearNavClass} aria-label="Próximo ano" title="Próximo ano">
                    <ChevronRight size={15} />
                </button>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1">
                {MONTHS.map((monthLabel, monthIndex) => {
                    const monthKey = `${pickerYear}-${padMonthPart(monthIndex + 1)}`;
                    const isSelected = monthKey === selectedMonth;
                    const isCurrent = monthKey === currentMonthKey;

                    return (
                        <button
                            key={monthLabel}
                            type="button"
                            onClick={() => onMonthChange(monthKey)}
                            aria-pressed={isSelected}
                            aria-current={isCurrent ? "date" : undefined}
                            className={`relative inline-flex h-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                                isSelected
                                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40"
                                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                            }`}
                        >
                            {monthLabel}
                            {isCurrent && (
                                <span
                                    className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? "bg-emerald-200" : "bg-emerald-400"}`}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => onMonthChange(shortcutMonth ?? currentMonthKey)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-t border-white/[0.06] px-2 pt-2 pb-1 text-[11px] font-medium text-emerald-300/80 transition-colors hover:text-emerald-200"
            >
                <CalendarCheck size={13} />
                {shortcutLabel}
            </button>
        </div>
    );
}
