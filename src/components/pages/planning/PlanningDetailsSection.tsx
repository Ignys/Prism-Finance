import type { ReactNode } from "react";
import type { ItemIconTone } from "./planningTimelineTypes";

interface PlanningDetailsSectionProps {
    children: ReactNode;
    title: string;
    tone: ItemIconTone;
}

const SECTION_TITLE_CLASS_NAMES: Record<ItemIconTone, string> = {
    income: "text-emerald-100/90",
    expense: "text-orange-300/90",
    wishlist: "text-rose-400/90",
    neutral: "text-white/58",
};

const SECTION_LINE_CLASS_NAMES: Record<ItemIconTone, string> = {
    income: "bg-emerald-100/90",
    expense: "bg-orange-300/90",
    wishlist: "bg-rose-400/90",
    neutral: "bg-white/[0.12]",
};

export function PlanningDetailsSection({ children, title, tone }: PlanningDetailsSectionProps) {
    return (
        <section>
            <div className="mb-3 mt-1 flex w-full items-center px-1.5">
                <p className={`text-[11px] uppercase tracking-[0.14em] ${SECTION_TITLE_CLASS_NAMES[tone]}`}>{title}</p>
                <div className={`mx-1.5 h-px grow ${SECTION_LINE_CLASS_NAMES[tone]}`} />
            </div>
            <div className="space-y-1">{children}</div>
        </section>
    );
}
