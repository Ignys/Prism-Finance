import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MonthGridPanel } from "./MonthGridPanel";

interface StatementMonthSelectorProps {
    selectedMonth: string;
    onMonthChange: (value: string) => void;
    ariaLabel?: string;
}

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
    const selectedMonthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

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

                    <MonthGridPanel
                        selectedMonth={selectedMonth}
                        onMonthChange={(monthKey) => {
                            onMonthChange(monthKey);
                            setIsPickerOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
