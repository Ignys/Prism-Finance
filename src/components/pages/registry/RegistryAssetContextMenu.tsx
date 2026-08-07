import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Archive, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import type { RegistryAssetAction, RegistryAssetActionId, RegistryAssetMenuState } from "./registryAssetTypes";

interface RegistryAssetContextMenuProps {
    state: RegistryAssetMenuState | null;
    actions: RegistryAssetAction[];
    onSelect: (action: RegistryAssetAction) => void;
    onClose: () => void;
}

const MENU_WIDTH = 250;
const MENU_PADDING = 12;
const MENU_ITEM_HEIGHT = 40;

const ACTION_ICONS: Record<RegistryAssetActionId, typeof Pencil> = {
    edit: Pencil,
    favorite: Star,
    archive: Archive,
    restore: RotateCcw,
    remove: Trash2,
};

function buildSections(actions: RegistryAssetAction[]): RegistryAssetAction[][] {
    const regular = actions.filter((action) => action.tone !== "danger");
    const destructive = actions.filter((action) => action.tone === "danger");
    return [regular, destructive].filter((section) => section.length > 0);
}

function resolvePosition(state: RegistryAssetMenuState, actions: RegistryAssetAction[]) {
    const dividerHeight = actions.some((action) => action.tone === "danger") && actions.some((action) => action.tone !== "danger") ? 13 : 0;
    const menuHeight = 16 + actions.length * MENU_ITEM_HEIGHT + dividerHeight;
    const left = Math.max(MENU_PADDING, Math.min(state.x, window.innerWidth - MENU_WIDTH - MENU_PADDING));
    const top = Math.max(MENU_PADDING, Math.min(state.y, window.innerHeight - menuHeight - MENU_PADDING));
    return { left, top };
}

export function RegistryAssetContextMenu({ state, actions, onSelect, onClose }: RegistryAssetContextMenuProps) {
    const menuRef = useRef<HTMLDivElement | null>(null);
    const sections = useMemo(() => buildSections(actions), [actions]);
    const position = useMemo(() => (state ? resolvePosition(state, actions) : null), [actions, state]);

    useEffect(() => {
        if (!state) {
            return undefined;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", onClose);
        window.addEventListener("scroll", onClose, true);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", onClose);
            window.removeEventListener("scroll", onClose, true);
        };
    }, [onClose, state]);

    if (!state || !position) {
        return null;
    }

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label="Ações do cadastro"
            className="fixed z-[220] w-[250px] overflow-hidden rounded-2xl border border-white/[0.11] bg-[#101113]/95 p-2 text-white shadow-2xl backdrop-blur-xl"
            style={position}
        >
            {sections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                    {sectionIndex > 0 ? <div className="my-1.5 h-px bg-white/[0.08]" aria-hidden="true" /> : null}
                    {section.map((action) => {
                        const Icon = ACTION_ICONS[action.id];
                        const danger = action.tone === "danger";

                        return (
                            <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                disabled={action.disabled}
                                onClick={() => {
                                    if (!action.disabled) {
                                        onSelect(action);
                                    }
                                }}
                                className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors disabled:cursor-default disabled:opacity-45 ${
                                    danger ? "text-red-300 hover:bg-red-500/10 hover:text-red-200" : "text-white/85 hover:bg-white/[0.06] hover:text-white"
                                }`}
                            >
                                <Icon size={16} className={action.id === "favorite" && action.disabled ? "fill-amber-200 text-amber-200" : ""} />
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
