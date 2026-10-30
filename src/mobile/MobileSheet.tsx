import { useEffect, useRef, useState, type ReactNode } from "react";

interface MobileSheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

const CLOSE_MS = 180;

// Native <dialog> gives focus trapping, Esc and the backdrop for free; we only add the slide in/out.
export function MobileSheet({ open, onClose, title, children }: MobileSheetProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            setClosing(false);
            dialog.showModal();
            return;
        }
        if (!open && dialog.open) {
            // Let the slide-down play before removing the dialog from the top layer.
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            setClosing(true);
            const timer = window.setTimeout(() => dialog.close(), reduceMotion ? 0 : CLOSE_MS);
            return () => window.clearTimeout(timer);
        }
    }, [open]);

    return (
        <dialog
            ref={ref}
            aria-label={title}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClose={() => open && onClose()}
            onClick={(event) => event.target === event.currentTarget && onClose()}
            className={`m-0 mt-auto w-full max-w-none rounded-t-3xl border-t border-white/[0.08] bg-[#141416] p-0 text-white backdrop:bg-black/60 motion-reduce:animate-none motion-reduce:backdrop:animate-none ${
                closing
                    ? "animate-[sheet-down_180ms_ease-in_forwards] backdrop:animate-[fade-out_180ms_ease-in_forwards]"
                    : "animate-[sheet-up_280ms_cubic-bezier(0.22,1,0.36,1)] backdrop:animate-[fade-in_200ms_ease-out]"
            }`}
        >
            <div className="px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
                <p className="mb-3 px-1 text-lg font-medium">{title}</p>
                <div className={closing ? "" : "[&>*]:animate-[sheet-item-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards] [&>*:nth-child(2)]:[animation-delay:35ms] [&>*:nth-child(3)]:[animation-delay:70ms] [&>*:nth-child(4)]:[animation-delay:105ms] [&>*:nth-child(5)]:[animation-delay:140ms] [&>*:nth-child(6)]:[animation-delay:175ms] [&>*:nth-child(7)]:[animation-delay:210ms] [&>*:nth-child(8)]:[animation-delay:245ms] motion-reduce:[&>*]:animate-none"}>{children}</div>
            </div>
        </dialog>
    );
}
