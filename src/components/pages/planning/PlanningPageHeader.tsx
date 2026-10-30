import type { ReactNode } from "react";

interface PlanningPageHeaderProps {
    toolbar?: ReactNode;
}

export function PlanningPageHeader({ toolbar }: PlanningPageHeaderProps) {

    return (
        <header
            className="relative z-10 flex flex-wrap items-center justify-end gap-3 text-left"
        >
            {toolbar}
        </header>
    );
}
