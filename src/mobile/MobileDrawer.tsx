import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface MobileDrawerProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

// Side panel from the right. Not a native <dialog>: its top layer would cover the app modals
// and context menus opened from inside it, so it sits just below them (DisplayModal is z-90).
export function MobileDrawer({ open, onClose, title, children }: MobileDrawerProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.querySelector('[data-modal-overlay-root="true"]') && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="absolute inset-y-0 right-0 flex w-[min(92vw,26rem)] animate-[drawer-in_220ms_cubic-bezier(0.22,1,0.36,1)] flex-col border-l border-white/[0.08] bg-[#141416] text-white motion-reduce:animate-none"
            >
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
                    <p className="truncate text-base font-medium">{title}</p>
                    <button type="button" autoFocus onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-neutral-400 outline-none active:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-sky-400/60">
                        <X size={18} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
            </aside>
        </div>
    );
}
