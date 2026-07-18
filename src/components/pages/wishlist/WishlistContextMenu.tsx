import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import type { WishlistContextAction, WishlistContextActionId } from "./wishlistContextActions";

export interface WishlistContextMenuState {
    wishItemId: string;
    x: number;
    y: number;
}

interface WishlistContextMenuProps {
    state: WishlistContextMenuState | null;
    actions: WishlistContextAction[];
    onSelect: (action: WishlistContextAction) => void;
    onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_PADDING = 12;
const MENU_VERTICAL_PADDING = 16;
const MENU_ITEM_HEIGHT = 40;
const MENU_DIVIDER_HEIGHT = 13;

const ACTION_ICONS: Record<WishlistContextActionId, typeof Pencil> = {
    create_expense: ShoppingCart,
    edit: Pencil,
    open_link: ExternalLink,
    remove: Trash2,
};

function buildActionSections(actions: WishlistContextAction[]): WishlistContextAction[][] {
    const destructive = actions.filter((action) => action.tone === "danger");
    const primary = actions.filter((action) => action.tone !== "danger");

    return [primary, destructive].filter((section) => section.length > 0);
}

function resolveMenuPosition(state: WishlistContextMenuState, actions: WishlistContextAction[]): { left: number; top: number } {
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

export function WishlistContextMenu({ state, actions, onSelect, onClose }: WishlistContextMenuProps) {
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
            aria-label="Acoes do item da lista de desejos"
            className="fixed z-[220] w-[240px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101113]/95 p-2 text-white shadow-2xl backdrop-blur-xl"
            style={{ left: position.left, top: position.top }}
        >
            {sections.map((section, sectionIndex) => (
                <div key={`section-${sectionIndex}`}>
                    {sectionIndex > 0 ? <div className="my-1.5 h-px bg-white/[0.08]" aria-hidden="true" /> : null}
                    {section.map((action) => {
                        const Icon = ACTION_ICONS[action.id];
                        const danger = action.tone === "danger";

                        return (
                            <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    if (!action.disabled) {
                                        onSelect(action);
                                    }
                                }}
                                disabled={action.disabled}
                                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
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
