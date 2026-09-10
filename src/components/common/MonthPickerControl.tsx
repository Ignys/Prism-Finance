import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnchoredOverlay } from "../transactions/AnchoredOverlay";
import { MonthGridPanel } from "./MonthGridPanel";

interface MonthPickerControlProps {
    selectedMonth: string;
    onMonthChange: (monthKey: string) => void;
    formatMonthLabel: (monthKey: string) => string;
    shiftMonth: (monthKey: string, delta: number) => string;
    // Atalho do rodape do popover: por padrao vai para o mes atual.
    shortcutMonth?: string;
    shortcutLabel?: string;
}

/**
 * Controle de navegacao de mes (setas + botao central que abre o MonthGridPanel).
 * Usado nos overviews de fatura e transacoes para manter a mesma UI/UX.
 */
export function MonthPickerControl({ selectedMonth, onMonthChange, formatMonthLabel, shiftMonth, shortcutMonth, shortcutLabel }: MonthPickerControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !overlayRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick, true);
        document.addEventListener("keydown", handleEscapeKey);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick, true);
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen]);

    return (
        <div className="flex items-center justify-between">
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}
                className="rounded-lg p-1 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Mes anterior"
            >
                <ChevronLeft size={16} />
            </button>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label="Selecionar mes"
                className="rounded-lg px-2 py-0.5 text-[13px] font-medium capitalize text-white transition-colors hover:bg-white/[0.06]"
            >
                {formatMonthLabel(selectedMonth)}
            </button>
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}
                className="rounded-lg p-1 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Proximo mes"
            >
                <ChevronRight size={16} />
            </button>

            <AnchoredOverlay
                anchorRef={triggerRef}
                overlayRef={overlayRef}
                isOpen={isOpen}
                overlayWidth={288}
                align="center"
                className="rounded-2xl border border-white/[0.12] bg-[#0e0e0e]/95 p-3 shadow-[0_30px_70px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
                <MonthGridPanel
                    selectedMonth={selectedMonth}
                    shortcutMonth={shortcutMonth}
                    shortcutLabel={shortcutLabel}
                    onMonthChange={(monthKey) => {
                        onMonthChange(monthKey);
                        setIsOpen(false);
                    }}
                />
            </AnchoredOverlay>
        </div>
    );
}
