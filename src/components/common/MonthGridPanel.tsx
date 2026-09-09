import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthGridPanelProps {
    selectedMonth: string;
    onMonthChange: (monthKey: string) => void;
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
export function MonthGridPanel({ selectedMonth, onMonthChange }: MonthGridPanelProps) {
    const [pickerYear, setPickerYear] = useState(() => parseYear(selectedMonth) ?? new Date().getFullYear());

    useEffect(() => {
        const year = parseYear(selectedMonth);
        if (year !== null) {
            setPickerYear(year);
        }
    }, [selectedMonth]);

    return (
        <div className="relative">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setPickerYear((current) => current - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02] text-white/75 transition-colors hover:border-white/[0.24] hover:bg-white/[0.06] hover:text-white"
                    aria-label="Ano anterior"
                    title="Ano anterior"
                >
                    <ChevronLeft size={15} />
                </button>
                <p className="text-sm font-semibold tracking-[0.12em] text-white/85">{pickerYear}</p>
                <button
                    type="button"
                    onClick={() => setPickerYear((current) => current + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02] text-white/75 transition-colors hover:border-white/[0.24] hover:bg-white/[0.06] hover:text-white"
                    aria-label="Próximo ano"
                    title="Próximo ano"
                >
                    <ChevronRight size={15} />
                </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
                {MONTHS.map((monthLabel, monthIndex) => {
                    const monthKey = `${pickerYear}-${padMonthPart(monthIndex + 1)}`;
                    const isSelected = monthKey === selectedMonth;

                    return (
                        <button
                            key={monthLabel}
                            type="button"
                            onClick={() => onMonthChange(monthKey)}
                            aria-pressed={isSelected}
                            className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                                isSelected
                                    ? "border-emerald-300/50 bg-emerald-500/20 text-amber-50"
                                    : "border-white/[0.1] bg-white/[0.02] text-white/75 hover:border-white/[0.25] hover:bg-white/[0.08] hover:text-white"
                            }`}
                        >
                            <span>{monthLabel}</span>
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => onMonthChange(getCurrentMonthKey())}
                className="mt-3 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.24] hover:bg-white/[0.08] hover:text-white"
            >
                Ir para o mês atual
            </button>
        </div>
    );
}
