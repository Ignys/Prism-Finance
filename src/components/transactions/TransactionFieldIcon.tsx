import type { LucideIcon } from "lucide-react";

interface TransactionFieldIconProps {
    icon: LucideIcon;
    className?: string;
}

export function TransactionFieldIcon({ icon: Icon, className = "" }: TransactionFieldIconProps) {
    return (
        <span
            aria-hidden="true"
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/65 ${className}`.trim()}
        >
            <Icon size={14} />
        </span>
    );
}
