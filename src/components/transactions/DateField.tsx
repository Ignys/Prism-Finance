import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalDateInput, getLocalDateFromOffset, parseDateOnlyToLocalDate } from "../../lib/localDate";
import { AnchoredOverlay } from "./AnchoredOverlay";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { TransactionFieldIcon } from "./TransactionFieldIcon";

const DATE_MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});
const DATE_VALUE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
const DATE_WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const DEFAULT_SHORTCUTS: DateFieldShortcut[] = [
    { label: "Hoje", offsetInDays: 0 },
    { label: "Ontem", offsetInDays: -1 },
];

export interface DateFieldShortcut {
    label: string;
    offsetInDays: number;
}

interface DateFieldProps {
    value: string;
    onChange: (value: string) => void;
    onOffset?: (offsetInDays: number) => void;
    shortcuts?: DateFieldShortcut[];
    label?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    labelClassName?: string;
    inputClassName?: string;
    hideLabel?: boolean;
}

function capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DateField({
    value,
    onChange,
    onOffset,
    shortcuts = DEFAULT_SHORTCUTS,
    label = "Data",
    required = true,
    disabled = false,
    className = "",
    labelClassName = FIELD_LABEL_CLASS,
    inputClassName = FIELD_INPUT_CLASS,
    hideLabel = false,
}: DateFieldProps) {
    const todayValue = getLocalDateFromOffset(0);
    const yesterdayValue = getLocalDateFromOffset(-1);
    const selectedDate = useMemo(() => parseDateOnlyToLocalDate(value), [value]);
    const [isOpen, setIsOpen] = useState(false);
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const referenceDate = parseDateOnlyToLocalDate(value) ?? new Date();
        return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    const dateShortcuts = useMemo(
        () =>
            shortcuts.map((shortcut) => ({
                ...shortcut,
                value: getLocalDateFromOffset(shortcut.offsetInDays),
            })),
        [shortcuts],
    );

    const displayValue = useMemo(() => {
        if (!selectedDate) {
            return "Selecione uma data";
        }

        const formattedDate = capitalizeLabel(DATE_VALUE_FORMATTER.format(selectedDate));
        if (value === todayValue) {
            return `Hoje, ${formattedDate}`;
        }

        if (value === yesterdayValue) {
            return `Ontem, ${formattedDate}`;
        }

        return formattedDate;
    }, [selectedDate, todayValue, value, yesterdayValue]);

    useEffect(() => {
        if (!selectedDate) {
            return;
        }

        setVisibleMonth((currentMonth) => {
            if (currentMonth.getFullYear() === selectedDate.getFullYear() && currentMonth.getMonth() === selectedDate.getMonth()) {
                return currentMonth;
            }

            return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        });
    }, [selectedDate]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current || containerRef.current.contains(event.target as Node) || overlayRef.current?.contains(event.target as Node)) {
                return;
            }

            setIsOpen(false);
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscapeKey);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen]);

    useEffect(() => {
        if (disabled) {
            setIsOpen(false);
        }
    }, [disabled]);

    const monthLabel = capitalizeLabel(DATE_MONTH_LABEL_FORMATTER.format(visibleMonth));
    const calendarDays = useMemo(() => {
        const year = visibleMonth.getFullYear();
        const month = visibleMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const firstWeekdayIndex = (firstDayOfMonth.getDay() + 6) % 7;

        return Array.from({ length: 42 }, (_, index) => {
            const dayOffset = index - firstWeekdayIndex;
            const date = new Date(year, month, dayOffset + 1);
            const dateValue = formatLocalDateInput(date);

            return {
                id: dateValue,
                value: dateValue,
                dayNumber: date.getDate(),
                isCurrentMonth: date.getMonth() === month,
                isToday: dateValue === todayValue,
            };
        });
    }, [todayValue, visibleMonth]);

    const handleShortcutSelect = (shortcut: { offsetInDays: number; value: string }) => {
        if (onOffset) {
            onOffset(shortcut.offsetInDays);
        } else {
            onChange(shortcut.value);
        }
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative flex flex-col ${hideLabel ? "" : "gap-1.5"} ${className}`.trim()}>
            {!hideLabel && <span className={labelClassName}>{label}</span>}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-[50px] w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 text-left text-sm text-white transition-colors hover:border-white/[0.2] focus-visible:border-white/[0.26] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={hideLabel ? label : undefined}
                disabled={disabled}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <TransactionFieldIcon icon={CalendarDays} className="text-emerald-200/85" />
                    <span className="truncate">{displayValue}</span>
                </span>
                <ChevronDown size={15} className={`shrink-0 text-white/65 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnchoredOverlay anchorRef={triggerRef} overlayRef={overlayRef} isOpen={isOpen && !disabled} preferredMaxHeight={430} className="rounded-xl border border-white/[0.12] bg-[#141414] p-2 shadow-[0_20px_50px_-26px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <span className="text-sm font-medium text-white/90">{monthLabel}</span>

                        <button
                            type="button"
                            onClick={() => setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                            aria-label="Proximo mes"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {dateShortcuts.length > 0 && (
                        <div className={`mt-3 grid gap-2 ${dateShortcuts.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                            {dateShortcuts.map((shortcut) => {
                                const isActive = value === shortcut.value;
                                return (
                                    <button
                                        key={shortcut.label}
                                        type="button"
                                        onClick={() => handleShortcutSelect(shortcut)}
                                        className={`rounded-lg border py-0.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors ${
                                            isActive
                                                ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100"
                                                : "border-white/[0.15] bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                                        }`}
                                    >
                                        {shortcut.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-3 grid grid-cols-7 gap-1">
                        {DATE_WEEKDAY_LABELS.map((weekdayLabel) => (
                            <span key={weekdayLabel} className="text-center text-[10px] uppercase tracking-[0.08em] text-white/45">
                                {weekdayLabel}
                            </span>
                        ))}
                    </div>

                    <div className="mt-1 grid grid-cols-7 gap-1">
                        {calendarDays.map((day) => {
                            const isSelected = value === day.value;
                            return (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(day.value);
                                        setIsOpen(false);
                                    }}
                                    className={`inline-flex h-8 items-center justify-center rounded-lg border text-xs transition-colors ${
                                        isSelected
                                            ? "border-emerald-400/45 bg-emerald-500/22 text-emerald-100"
                                            : day.isCurrentMonth
                                              ? day.isToday
                                                  ? "border-emerald-300/0 bg-emerald-600/10 text-emerald-100 hover:border-emerald-300/50"
                                                  : "border-transparent text-white/82 hover:border-white/[0.15] hover:bg-white/[0.06]"
                                              : "border-transparent text-white/35 hover:bg-white/[0.03]"
                                    }`}
                                >
                                    {day.dayNumber}
                                </button>
                            );
                        })}
                    </div>

                    <label className="mt-1 flex flex-col gap-1">
                        <input
                            className={`${inputClassName} w-full p-2 text-sm`}
                            type="date"
                            required={required}
                            value={value}
                            onChange={(event) => onChange(event.target.value)}
                        />
                    </label>
            </AnchoredOverlay>
        </div>
    );
}
