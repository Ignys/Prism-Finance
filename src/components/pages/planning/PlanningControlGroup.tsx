import type { ReactNode } from "react";

export const PLANNING_CONTROL_TRIGGER_CLASS =
    "flex h-[40px] px-2 items-center gap-2 justify-between rounded-xl border border-white/[0.1] bg-black/35 text-left text-sm text-white transition-colors hover:border-white/[0.2]";

export const PLANNING_CONTROL_CENTER_TRIGGER_CLASS =
    "flex h-[40px] px-2 items-center gap-2 rounded-xl border border-white/[0.1] bg-black/35 text-center text-sm text-white transition-colors hover:border-white/[0.2]";

interface PlanningControlGroupProps {
    children: ReactNode;
    className?: string;
    footer?: ReactNode;
    label?: string;
}

export function PlanningControlGroup({ children, className = "" }: PlanningControlGroupProps) {
    return <div className={`${className}`}>{children}</div>;
}
