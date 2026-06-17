import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReportPeriod } from "../../../context/FinanceContext";
import { PLANNING_CONTROL_TRIGGER_CLASS } from "./PlanningControlGroup";

interface PlanningReportPeriodSelectorProps {
    period: ReportPeriod;
    onPeriodChange: (period: ReportPeriod) => void;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

function padMonth(value: number): string {
    return String(value).padStart(2, "0");
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonth(referenceDate.getMonth() + 1)}`;
}

function parseMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    return monthIndex >= 0 && monthIndex <= 11 ? { year, monthIndex } : null;
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    const shifted = new Date(parsedMonth.year, parsedMonth.monthIndex + offset, 1);
    return `${shifted.getFullYear()}-${padMonth(shifted.getMonth() + 1)}`;
}

function formatMonth(monthKey: string): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    return monthFormatter.format(new Date(parsedMonth.year, parsedMonth.monthIndex, 1)).replace(".", "");
}

function formatPeriod(period: ReportPeriod): string {
    return period.startMonth === period.endMonth ? formatMonth(period.startMonth) : `${formatMonth(period.startMonth)} - ${formatMonth(period.endMonth)}`;
}

export function PlanningReportPeriodSelector({ period, onPeriodChange }: PlanningReportPeriodSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectionStart, setSelectionStart] = useState<string | null>(null);
    const [pickerYear, setPickerYear] = useState(() => parseMonthKey(period.endMonth)?.year ?? new Date().getFullYear());
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const currentMonth = getCurrentMonthKey();
    const periodLabel = useMemo(() => formatPeriod(period), [period]);
    const canMoveForward = shiftMonth(period.endMonth, 1) <= currentMonth;

    useEffect(() => {
        if (!isOpen) {
            setSelectionStart(null);
            setPickerYear(parseMonthKey(period.endMonth)?.year ?? new Date().getFullYear());
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!pickerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, period.endMonth]);

    const movePeriod = (offset: number) => {
        const nextPeriod = { startMonth: shiftMonth(period.startMonth, offset), endMonth: shiftMonth(period.endMonth, offset) };
        if (nextPeriod.endMonth <= currentMonth) {
            onPeriodChange(nextPeriod);
        }
    };

    const selectMonth = (monthKey: string) => {
        if (!selectionStart) {
            setSelectionStart(monthKey);
            return;
        }

        onPeriodChange(selectionStart <= monthKey ? { startMonth: selectionStart, endMonth: monthKey } : { startMonth: monthKey, endMonth: selectionStart });
        setIsOpen(false);
    };

    return (
        <div ref={pickerRef} className="relative inline-flex items-center gap-1">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className={`${PLANNING_CONTROL_TRIGGER_CLASS} min-w-[220px] gap-2`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label="Selecionar período dos relatórios"
            >
                <CalendarRange size={15} />
                <span className="truncate text-sm text-white/85">{periodLabel}</span>
            </button>

            {isOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[300px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0e0e0e]/95 p-3 shadow-[0_30px_70px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setPickerYear((current) => current - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02] text-white/75 hover:border-white/[0.24] hover:bg-white/[0.06]" aria-label="Ano anterior">
                            <ChevronLeft size={15} />
                        </button>
                        <div className="text-center">
                            <p className="text-sm font-semibold tracking-[0.12em] text-white/85">{pickerYear}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/42">{selectionStart ? "Selecione o mês final" : "Selecione o mês inicial"}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPickerYear((current) => current + 1)}
                            disabled={pickerYear >= new Date().getFullYear()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02] text-white/75 hover:border-white/[0.24] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Próximo ano"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {MONTHS.map((monthLabel, monthIndex) => {
                            const monthKey = `${pickerYear}-${padMonth(monthIndex + 1)}`;
                            const isFuture = monthKey > currentMonth;
                            const isBoundary = monthKey === period.startMonth || monthKey === period.endMonth;
                            const isInRange = monthKey >= period.startMonth && monthKey <= period.endMonth;
                            const isSelectionStart = monthKey === selectionStart;

                            return (
                                <button
                                    key={monthKey}
                                    type="button"
                                    onClick={() => selectMonth(monthKey)}
                                    disabled={isFuture}
                                    aria-pressed={isBoundary || isSelectionStart}
                                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                                        isSelectionStart
                                            ? "border-amber-300/60 bg-amber-500/20 text-amber-50"
                                            : isBoundary
                                              ? "border-sky-300/55 bg-sky-500/20 text-sky-50"
                                              : isInRange
                                                ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
                                                : "border-white/[0.1] bg-white/[0.02] text-white/75 hover:border-white/[0.25] hover:bg-white/[0.08]"
                                    }`}
                                >
                                    {monthLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
