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
            className={`${active ? "border-neutral-100/[0.2] bg-neutral-600/30 text-white/70" : "border-white/[0.1] bg-white/[0.03] text-white/30"} rounded-lg border px-2.5 py-1 text-xs transition-colors hover:cursor-pointer`}
        >
            {label}
        </button>
    );
}
