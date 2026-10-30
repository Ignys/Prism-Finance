import { Check } from "lucide-react";

interface TableColumnToggleButtonProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

export function TableColumnToggleButton({ label, active, onClick }: TableColumnToggleButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${
                active ? "bg-white/[0.09] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-white/35 hover:bg-white/[0.04] hover:text-white/65"
            } inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors`}
        >
            <Check size={12} strokeWidth={2.5} className={active ? "opacity-70" : "opacity-0"} aria-hidden />
            {label}
        </button>
    );
}
