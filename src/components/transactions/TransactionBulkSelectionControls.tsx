import { CalendarCheck, Circle, CircleCheckBig, PencilLine, Square, SquareCheckBig, SquareMinus, X, type LucideIcon } from "lucide-react";

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

const SELECT_BUTTON_CLASS =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/38 transition-colors disabled:cursor-not-allowed disabled:opacity-30 border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] disabled:hover:border-white/[0.08] disabled:hover:bg-transparent";

export function BulkHeaderCheckbox({ checked, indeterminate, disabled = false, onChange }: BulkHeaderCheckboxProps) {
    const Icon = checked ? SquareCheckBig : indeterminate ? SquareMinus : Square;

    return (
        <button type="button" disabled={disabled} onClick={onChange} aria-label="Selecionar transacoes visiveis" aria-pressed={checked} className="px-1">
            <Icon size={16} strokeWidth={2} className="text-white/60" />
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
            aria-label="Selecionar transacao"
            aria-pressed={checked}
            className={`${SELECT_BUTTON_CLASS} ${checked ? "text-sky-100" : ""}`}
        >
            <Circle size={16} strokeWidth={1} className={checked ? "fill-sky-300/[0.7] text-sky-400/[0.7]" : "fill-neutral-900/[0.2] text-neutral-400/[0.7]"} />
        </button>
    );
}

export function FloatingTransactionBulkFooter({ selectedCount, selectedAmount, onEdit, onMarkAsPaid, onPayToday, onClear }: FloatingTransactionBulkFooterProps) {
    if (selectedCount < 1) {
        return null;
    }

    return (
        <div className="fixed inset-x-3 bottom-4 z-[190] flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex max-w-5xl flex-col rounded-2xl border border-white/[0.12] bg-neutral-950/90 px-4 py-1 text-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                    <FooterActionButton icon={PencilLine} label="Editar" onClick={onEdit} />
                    {onMarkAsPaid ? <FooterActionButton icon={CircleCheckBig} label="Marcar como pagas" onClick={onMarkAsPaid} /> : null}
                    {onPayToday ? <FooterActionButton icon={CalendarCheck} label="Pagar hoje" onClick={onPayToday} /> : null}
                </div>
                <div className="hidden md:block border-l border-white/[0.12] h-12 mx-3" />
                <div className="flex flex-wrap items-center mr-5">
                    <div className="rounded-xl py-2">
                        <p className="text-[11px] uppercase tracking-[0.08em] text-sky-200">
                            {selectedCount} {selectedCount === 1 ? "transação" : "transações"}
                        </p>
                        <p className="text-base font-medium  text-white">R$ {selectedAmount}</p>
                    </div>
                </div>
                <div className="flex items-center w-8 h-8 justify-center rounded-full bg-neutral-700/50 p-1 cursor-pointer hover:bg-red-400/30" onClick={onClear}>
                    <X size={16} />
                </div>
            </div>
        </div>
    );
}

function FooterActionButton({ icon: Icon, label, tone = "default", onClick }: FooterActionButtonProps) {
    const className =
        tone === "muted"
            ? "border-white/[0.1] bg-white/[0.03] text-white/68 hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
            : "border-white/[0.12] bg-white/[0.06] text-white/82 hover:border-emerald-300/30 hover:bg-emerald-500/10 hover:text-emerald-50";

    return (
        <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${className}`}>
            <Icon size={16} className="shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );
}
