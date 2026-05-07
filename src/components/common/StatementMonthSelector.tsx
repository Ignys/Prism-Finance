import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface StatementMonthSelectorProps {
    selectedMonth: string;
    onMonthChange: (value: string) => void;
    ariaLabel?: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

function padMonthPart(value: number): string {
    return String(value).padStart(2, "0");
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonthPart(referenceDate.getMonth() + 1)}`;
}

function parseYearMonth(monthKey: string): { year: number; month: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return { year, month };
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseYearMonth(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    const shifted = new Date(parsedMonth.year, parsedMonth.month - 1 + offset, 1);
    return getCurrentMonthKey(shifted);
}

function formatMonthLabel(monthKey: string): string {
    const parsedMonth = parseYearMonth(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    const formatted = monthLabelFormatter.format(new Date(parsedMonth.year, parsedMonth.month - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function StatementMonthSelector({ selectedMonth, onMonthChange, ariaLabel = "Selecionar mes e ano" }: StatementMonthSelectorProps) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const [pickerYear, setPickerYear] = useState(() => parseYearMonth(selectedMonth)?.year ?? new Date().getFullYear());
    const selectedMonthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

    useEffect(() => {
        const parsedMonth = parseYearMonth(selectedMonth);
        if (parsedMonth) {
            setPickerYear(parsedMonth.year);
        }
    }, [selectedMonth]);

    useEffect(() => {
        if (!isPickerOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!pickerRef.current?.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsPickerOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isPickerOpen]);

    const selectMonth = (month: number) => {
        const monthKey = `${pickerYear}-${String(month).padStart(2, "0")}`;
        onMonthChange(monthKey);
        setIsPickerOpen(false);
    };

    const currentMonth = getCurrentMonthKey();

    return (
        <div ref={pickerRef} className=" relative inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-neutral-900 px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Mês anterior"
                title="Mês anterior"
            >
                <ChevronLeft size={16} />
            </button>
            <button
                type="button"
                onClick={() => setIsPickerOpen((current) => !current)}
                aria-expanded={isPickerOpen}
                aria-haspopup="dialog"
                aria-label={ariaLabel}
                className="inline-flex items-center justify-center gap-2 w-50 rounded-lg border border-white/0 bg-gradient-to-tl pl-1 py-1 pr-4.5 text-sm text-white outline-none transition-all hover:border-white/[0.24] hover:from-white/[0.12] hover:to-white/[0.04] focus-visible:border-white/[0.5]"
            >
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center">
                        <CalendarDays size={15} />
                    </span>
                    <span className="text-sm font-medium">{selectedMonthLabel}</span>
                </span>
            </button>
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Próximo mês"
                title="Próximo mês"
            >
                <ChevronRight size={16} />
            </button>

            {isPickerOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[288px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0e0e0e]/95 p-3 shadow-[0_30px_70px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                    <div className="pointer-events-none absolute -left-8 -top-10 h-20 w-20 rounded-full bg-amber-400/14 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-8 -right-10 h-24 w-24 rounded-full bg-sky-400/12 blur-2xl" />

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
                                const monthKey = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
                                const isSelected = monthKey === selectedMonth;

                                return (
                                    <button
                                        key={monthLabel}
                                        type="button"
                                        onClick={() => selectMonth(monthIndex + 1)}
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
                            onClick={() => {
                                onMonthChange(currentMonth);
                                setIsPickerOpen(false);
                            }}
                            className="mt-3 w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-white/[0.24] hover:bg-white/[0.08] hover:text-white"
                        >
                            Ir para o mês atual
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
