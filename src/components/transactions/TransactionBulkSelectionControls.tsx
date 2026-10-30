import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, Check, CircleCheckBig, Minus, PencilLine, X, type LucideIcon } from "lucide-react";

interface BulkHeaderCheckboxProps {
    checked: boolean;
    indeterminate: boolean;
    disabled?: boolean;
    onChange: () => void;
}

interface BulkRowCheckboxProps {
    checked: boolean;
    disabled?: boolean;
    title?: string;
    onChange: () => void;
}

interface FloatingTransactionBulkFooterProps {
    selectedCount: number;
    selectedAmount: string;
    onEdit: () => void;
    onMarkAsPaid?: () => void;
    onPayToday?: () => void;
    onClear: () => void;
}

interface FooterActionButtonProps {
    icon: LucideIcon;
    label: string;
    tone?: "default" | "muted";
    onClick: () => void;
}

function CheckboxBox({ checked, indeterminate = false }: { checked: boolean; indeterminate?: boolean }) {
    const filled = checked || indeterminate;

    return (
        <span
            className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors ${
                filled ? "border-sky-300/80 bg-sky-400 text-neutral-950" : "border-white/25 bg-white/[0.03] text-transparent group-hover:border-white/45"
            }`}
        >
            {indeterminate && !checked ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
        </span>
    );
}

const CHECKBOX_BUTTON_CLASS = "group inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30";

export function BulkHeaderCheckbox({ checked, indeterminate, disabled = false, onChange }: BulkHeaderCheckboxProps) {
    return (
        <button type="button" disabled={disabled} onClick={onChange} aria-label="Selecionar transações visíveis" aria-pressed={checked} className={CHECKBOX_BUTTON_CLASS}>
            <CheckboxBox checked={checked} indeterminate={indeterminate} />
        </button>
    );
}

export function BulkRowCheckbox({ checked, disabled = false, title, onChange }: BulkRowCheckboxProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            title={title}
            onClick={(event) => {
                event.stopPropagation();
                onChange();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="Selecionar transação"
            aria-pressed={checked}
            className={CHECKBOX_BUTTON_CLASS}
        >
            <CheckboxBox checked={checked} />
        </button>
    );
}

export function FloatingTransactionBulkFooter({ selectedCount, selectedAmount, onEdit, onMarkAsPaid, onPayToday, onClear }: FloatingTransactionBulkFooterProps) {
    const shouldReduceMotion = useReducedMotion();

    if (selectedCount < 1) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[190] flex justify-center">
            <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                role="toolbar"
                aria-label="Ações das transações selecionadas"
                className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/[0.1] bg-neutral-900/85 p-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
                <div className="flex items-center gap-2.5 py-1 pl-1.5 pr-3">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-sky-400 px-1.5 text-sm font-semibold tabular-nums text-neutral-950">{selectedCount}</span>
                    <div className="leading-tight">
                        <p className="text-[11px] text-white/50">{selectedCount === 1 ? "selecionada" : "selecionadas"}</p>
                        <p className="text-sm font-semibold tabular-nums text-white">R$ {selectedAmount}</p>
                    </div>
                </div>
                <div className="hidden h-8 w-px bg-white/[0.1] sm:block" />
                <div className="flex flex-wrap gap-1">
                    <FooterActionButton icon={PencilLine} label="Editar" onClick={onEdit} />
                    {onMarkAsPaid ? <FooterActionButton icon={CircleCheckBig} label="Marcar como pagas" onClick={onMarkAsPaid} /> : null}
                    {onPayToday ? <FooterActionButton icon={CalendarCheck} label="Pagar hoje" onClick={onPayToday} /> : null}
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Limpar seleção"
                    title="Limpar seleção"
                    className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                    <X size={16} />
                </button>
            </motion.div>
        </div>
    );
}

function FooterActionButton({ icon: Icon, label, tone = "default", onClick }: FooterActionButtonProps) {
    const className = tone === "muted" ? "text-white/60 hover:bg-white/[0.06] hover:text-white" : "text-white/85 hover:bg-white/[0.08] hover:text-white";

    return (
        <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${className}`}>
            <Icon size={15} className="shrink-0 text-white/55" />
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );
}
