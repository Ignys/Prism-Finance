import { useEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { AnchoredOverlay } from "./AnchoredOverlay";
import { TransactionFieldIcon } from "./TransactionFieldIcon";

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

interface DayOfMonthFieldProps {
    label: string;
    value: number;
    onChange: (day: number) => void;
    icon: LucideIcon;
    disabled?: boolean;
}

/** Seletor de dia do mês (1–31) no mesmo visual do calendário do DateField. */
export function DayOfMonthField({ label, value, onChange, icon, disabled = false }: DayOfMonthFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (containerRef.current?.contains(event.target as Node) || overlayRef.current?.contains(event.target as Node)) {
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

    return (
        <div ref={containerRef} className="relative flex flex-col">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-[50px] w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 text-left text-sm text-white transition-colors hover:border-white/[0.2] focus-visible:border-white/[0.26] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={label}
                disabled={disabled}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <TransactionFieldIcon icon={icon} className="text-emerald-200/85" />
                    <span className="truncate">
                        <span className="text-white/55">{label} </span>
                        <span className="tabular-nums">{value}</span>
                    </span>
                </span>
                <ChevronDown size={15} className={`shrink-0 text-white/65 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnchoredOverlay anchorRef={triggerRef} overlayRef={overlayRef} isOpen={isOpen && !disabled} overlayWidth={260} className="rounded-xl border border-white/[0.12] bg-[#141414] p-2 shadow-[0_20px_50px_-26px_rgba(0,0,0,0.95)]">
                <p className="px-1 pb-2 text-xs text-white/55">{label}</p>
                <div className="grid grid-cols-7 gap-1" role="listbox" aria-label={label}>
                    {DAYS.map((day) => {
                        const isSelected = day === value;
                        return (
                            <button
                                key={day}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(day);
                                    setIsOpen(false);
                                }}
                                className={`inline-flex h-8 items-center justify-center rounded-lg border text-xs tabular-nums transition-colors ${
                                    isSelected ? "border-emerald-400/45 bg-emerald-500/22 text-emerald-100" : "border-transparent text-white/82 hover:border-white/[0.15] hover:bg-white/[0.06]"
                                }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </AnchoredOverlay>
        </div>
    );
}
