import { CircleCheckBig, Pencil, SquareArrowOutUpRight, SquareSlash, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { PlanningProjectionContextAction, PlanningProjectionContextActionId } from "./planningProjectionContextActions";

export interface PlanningProjectionContextMenuState {
    itemId: string;
    x: number;
    y: number;
}

interface PlanningProjectionContextMenuProps {
    state: PlanningProjectionContextMenuState | null;
    actions: PlanningProjectionContextAction[];
    onSelect: (action: PlanningProjectionContextAction) => void;
    onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_PADDING = 12;
const MENU_VERTICAL_PADDING = 16;
const MENU_ITEM_HEIGHT = 40;
const MENU_DIVIDER_HEIGHT = 13;

const ACTION_ICONS: Record<PlanningProjectionContextActionId, typeof Pencil> = {
    toggle: CircleCheckBig,
    edit: Pencil,
    remove: Trash2,
};

function buildActionSections(actions: PlanningProjectionContextAction[]): PlanningProjectionContextAction[][] {
    const destructive = actions.filter((action) => action.tone === "danger");
    const primary = actions.filter((action) => action.tone !== "danger");

    return [primary, destructive].filter((section) => section.length > 0);
}

function resolveActionIcon(action: PlanningProjectionContextAction): typeof Pencil {
    if (action.id === "toggle" && action.label === "Desativar") {
        return SquareSlash;
    }

    if (action.id === "edit" && (action.itemType === "wishlist" || action.label.startsWith("Abrir "))) {
        return SquareArrowOutUpRight;
    }

    return ACTION_ICONS[action.id];
}

function resolveMenuPosition(state: PlanningProjectionContextMenuState, actions: PlanningProjectionContextAction[]): { left: number; top: number } {
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

export function PlanningProjectionContextMenu({ state, actions, onSelect, onClose }: PlanningProjectionContextMenuProps) {
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
            aria-label="Acoes da projecao"
            className="fixed z-[220] w-[240px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101113]/95 p-2 text-white shadow-2xl backdrop-blur-xl"
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
