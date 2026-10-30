import { Plus } from "lucide-react";
import { LABEL_CLASS } from "./MobileHeader";

interface MobileListToolbarProps {
    countLabel: string;
    toggleLabel: string;
    createLabel: string;
    onToggle: () => void;
    onCreate: () => void;
}

export function MobileListToolbar({ countLabel, toggleLabel, createLabel, onToggle, onCreate }: MobileListToolbarProps) {
    return (
        <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
                <p className={LABEL_CLASS}>{countLabel}</p>
                <button type="button" onClick={onToggle} className="mt-0.5 text-xs text-neutral-400 underline-offset-4 outline-none active:text-white focus-visible:underline">
                    {toggleLabel}
                </button>
            </div>
            <button
                type="button"
                onClick={onCreate}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 outline-none active:bg-emerald-500/25 focus-visible:ring-2 focus-visible:ring-emerald-300/60"
            >
                <Plus size={15} />
                {createLabel}
            </button>
        </div>
    );
}
