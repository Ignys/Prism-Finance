import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, CircleCheckBig, Clock, Copy, Eye, LayoutList, Link2, ListChecks, SquareArrowOutUpRight, SquareSlash, Trash2, TriangleAlert } from "lucide-react";
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

const MENU_WIDTH = 260;
const MENU_PADDING = 12;
const MENU_VERTICAL_PADDING = 16;
const MENU_ITEM_HEIGHT = 40;
const MENU_DIVIDER_HEIGHT = 13;

const ACTION_ICONS: Record<TransactionContextActionId, typeof Eye> = {
    open: SquareArrowOutUpRight,
    view_series: LayoutList,
    view_invoice: Link2,
    view_expenses: Link2,
    select: ListChecks,
    toggle_status: CircleCheckBig,
    pay_today: CheckCheck,
    post_card: CheckCheck,
    ignore: SquareSlash,
    duplicate: Copy,
    delete_single: Trash2,
    delete_this_and_next: Trash2,
    delete_all: TriangleAlert,
};

function resolveActionIcon(action: TransactionContextAction): typeof Eye {
    if (action.id === "toggle_status" && action.nextStatus === "pending") {
        return Clock;
    }

    return ACTION_ICONS[action.id];
}

function buildActionSections(actions: TransactionContextAction[]): TransactionContextAction[][] {
    const primary = actions.filter((action) => action.id === "open" || action.id === "view_series" || action.id === "view_invoice" || action.id === "view_expenses");
    const destructive = actions.filter((action) => action.tone === "danger");
    const secondary = actions.filter((action) => !primary.includes(action) && action.tone !== "danger");

    return [primary, secondary, destructive].filter((section) => section.length > 0);
}

function resolveMenuPosition(state: TransactionContextMenuState, actions: TransactionContextAction[]): { left: number; top: number } {
    if (typeof window === "undefined") {
        return { left: state.x, top: state.y };
    }

    const sections = buildActionSections(actions);
    const dividerCount = Math.max(0, sections.length - 1);
    const menuHeight = MENU_VERTICAL_PADDING + actions.length * MENU_ITEM_HEIGHT + dividerCount * MENU_DIVIDER_HEIGHT;
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
    const sections = useMemo(() => buildActionSections(actions), [actions]);
    const position = useMemo(() => (state ? resolveMenuPosition(state, actions) : null), [actions, state]);

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
            className="fixed z-[220] w-[260px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101113]/95 p-2 text-white shadow-2xl backdrop-blur-xl"
            style={{ left: position.left, top: position.top }}
        >
            {sections.map((section, sectionIndex) => (
                <div key={`section-${sectionIndex}`}>
                    {sectionIndex > 0 ? <div className="my-1.5 h-px bg-white/[0.08]" aria-hidden="true" /> : null}
                    {section.map((action) => {
                        const Icon = resolveActionIcon(action);
                        const danger = action.tone === "danger";

                        return (
                            <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                onClick={() => onSelect(action)}
                                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${
                                    danger ? "text-red-300 hover:bg-red-500/10 hover:text-red-200" : "text-white/86 hover:bg-white/[0.06] hover:text-white"
                                }`}
                            >
                                <Icon size={16} className={danger ? "text-red-300/90" : "text-white/90"} />
                                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>,
        document.body,
    );
}
