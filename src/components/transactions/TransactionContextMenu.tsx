import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleCheckBig, Clock, Copy, Eye, ListChecks, RotateCcw, SquareArrowOutUpRight, SquareSlash, Trash2 } from "lucide-react";
import type { TransactionContextAction, TransactionContextActionId } from "./transactionContextActions";

export interface TransactionContextMenuState {
    transactionId: string;
    x: number;
    y: number;
}

interface TransactionContextMenuProps {
    state: TransactionContextMenuState | null;
    actions: TransactionContextAction[];
    onSelect: (action: TransactionContextAction) => void;
    onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_PADDING = 12;
const MENU_VERTICAL_PADDING = 12;
const MENU_ITEM_HEIGHT = 36;

const ACTION_ICONS: Record<TransactionContextActionId, typeof Eye> = {
    open: SquareArrowOutUpRight,
    select: ListChecks,
    toggle_status: CircleCheckBig,
    ignore: SquareSlash,
    duplicate: Copy,
    delete_single: Trash2,
    delete_this_and_next: RotateCcw,
    delete_all: Trash2,
};

function resolveActionIcon(action: TransactionContextAction): typeof Eye {
    if (action.id === "toggle_status" && action.nextStatus === "pending") {
        return Clock;
    }

    return ACTION_ICONS[action.id];
}

function resolveMenuPosition(state: TransactionContextMenuState, actionCount: number): { left: number; top: number } {
    if (typeof window === "undefined") {
        return { left: state.x, top: state.y };
    }

    const menuHeight = MENU_VERTICAL_PADDING + actionCount * MENU_ITEM_HEIGHT;
    const spaceBelow = window.innerHeight - state.y - MENU_PADDING;
    const shouldOpenUp = spaceBelow < menuHeight && state.y > menuHeight;
    const rawTop = shouldOpenUp ? state.y - menuHeight : state.y;

    return {
        left: Math.min(state.x, window.innerWidth - MENU_WIDTH - MENU_PADDING),
        top: Math.max(MENU_PADDING, Math.min(rawTop, window.innerHeight - menuHeight - MENU_PADDING)),
    };
}

export function TransactionContextMenu({ state, actions, onSelect, onClose }: TransactionContextMenuProps) {
    const menuRef = useRef<HTMLDivElement | null>(null);
    const position = useMemo(() => (state ? resolveMenuPosition(state, actions.length) : null), [actions.length, state]);

    useEffect(() => {
        if (!state) {
            return undefined;
        }

        function handleMouseDown(event: MouseEvent) {
            if (!menuRef.current?.contains(event.target as Node)) {
                onClose();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, state]);

    if (!state || !position) {
        return null;
    }

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label="Ações da transação"
            className="fixed z-[220] w-[240px] overflow-hidden rounded-xl border border-white/[0.12] bg-neutral-950 p-1.5 text-white shadow-[0_24px_60px_-22px_rgba(0,0,0,0.95)]"
            style={{ left: position.left, top: position.top }}
        >
            {actions.map((action) => {
                const Icon = resolveActionIcon(action);
                const danger = action.tone === "danger";

                return (
                    <button
                        key={action.id}
                        type="button"
                        role="menuitem"
                        onClick={() => onSelect(action)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                            danger ? "text-red-100 hover:bg-red-500/12 hover:text-red-50" : "text-white/85 hover:bg-white/[0.08] hover:text-white"
                        }`}
                    >
                        <Icon size={16} className={danger ? "text-red-200" : "text-white/60"} />
                        <span className="min-w-0 flex-1 truncate">{action.label}</span>
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}
