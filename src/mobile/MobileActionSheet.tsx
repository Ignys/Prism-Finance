import { MobileSheet } from "./MobileSheet";

interface SheetAction {
    id: string;
    label: string;
    tone?: string;
    disabled?: boolean;
}

interface MobileActionSheetProps<T extends SheetAction> {
    title: string;
    actions: T[];
    onSelect: (action: T) => void;
    onClose: () => void;
}

// Touch replacement for the desktop right-click menus: opens whenever there are actions to show.
export function MobileActionSheet<T extends SheetAction>({ title, actions, onSelect, onClose }: MobileActionSheetProps<T>) {
    return (
        <MobileSheet open={actions.length > 0} onClose={onClose} title={title}>
            {actions.map((action) => (
                <button
                    key={action.id}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => onSelect(action)}
                    className={`flex w-full rounded-2xl px-3 py-3 text-left text-sm outline-none active:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-40 ${
                        action.tone === "danger" ? "text-rose-300" : "text-white"
                    }`}
                >
                    {action.label}
                </button>
            ))}
        </MobileSheet>
    );
}
