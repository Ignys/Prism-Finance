import { useEffect, useRef, useState } from "react";
import { ChevronDown, Circle, PencilLine, Square, SquareCheckBig, SquareMinus, X } from "lucide-react";

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

interface TransactionBulkActionsBarProps {
    selectedCount: number;
    onEdit: () => void;
    onClear: () => void;
}

const SELECT_BUTTON_CLASS =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/38 transition-colors disabled:cursor-not-allowed disabled:opacity-30 border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] disabled:hover:border-white/[0.08] disabled:hover:bg-transparent";

export function BulkHeaderCheckbox({ checked, indeterminate, disabled = false, onChange }: BulkHeaderCheckboxProps) {
    const Icon = checked ? SquareCheckBig : indeterminate ? SquareMinus : Square;

    return (
        <button type="button" disabled={disabled} onClick={onChange} aria-label="Selecionar transações visíveis" aria-pressed={checked} className="px-1">
            <Icon size={20} strokeWidth={2} className="text-white/60" />
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
            className={`${SELECT_BUTTON_CLASS} ${checked ? "text-emerald-100" : ""}`}
        >
            <Circle
                size={16}
                strokeWidth={1}
                className={checked ? "fill-emerald-400/[0.7] text-emerald-400/[0.7]" : "fill-neutral-900/[0.2] text-neutral-400/[0.7]"}
            />
        </button>
    );
}

export function TransactionBulkActionsBar({ selectedCount, onEdit, onClear }: TransactionBulkActionsBarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }

        function handleMouseDown(event: MouseEvent) {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMenuOpen]);

    if (selectedCount < 1) {
        return null;
    }

    const handleEdit = () => {
        setIsMenuOpen(false);
        onEdit();
    };

    const handleClear = () => {
        setIsMenuOpen(false);
        onClear();
    };

    return (
        <div ref={menuRef} className="relative flex flex-wrap items-center justify-end gap-2">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-100 transition-colors hover:border-emerald-300/35 hover:bg-emerald-500/15"
            >
                <span>
                    {selectedCount} {selectedCount === 1 ? "item selecionado" : "itens selecionados"}
                </span>
                <ChevronDown size={16} className={`transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMenuOpen ? (
                <div
                    role="menu"
                    aria-label="Ações da seleção"
                    className="absolute right-0 top-[calc(100%+6px)] z-[210] w-[210px] overflow-hidden rounded-xl border border-white/[0.12] bg-neutral-950 p-1.5 text-white shadow-[0_20px_48px_-20px_rgba(0,0,0,0.95)]"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleEdit}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                        <PencilLine size={16} className="text-white/60" />
                        <span className="min-w-0 flex-1 truncate">Editar selecionados</span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleClear}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                        <X size={16} className="text-white/60" />
                        <span className="min-w-0 flex-1 truncate">Cancelar seleção</span>
                    </button>
                </div>
            ) : null}
        </div>
    );
}
