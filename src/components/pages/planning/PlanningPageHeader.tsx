import type { LucideIcon } from "lucide-react";
import { BarChart3, TrendingUp } from "lucide-react";
import type { PlanningReportsToolbarProps } from "./PlanningReportsToolbar";
import { PlanningReportsToolbar } from "./PlanningReportsToolbar";
import type { PlanningTimelineToolbarProps } from "./PlanningTimelineToolbar";
import { PlanningTimelineToolbar } from "./PlanningTimelineToolbar";
import type { PlanningTab } from "./planningTimelineTypes";

interface PlanningPageHeaderProps {
    activePlanningTab: PlanningTab;
    onTabChange: (tab: PlanningTab) => void;
    reportsToolbarProps: PlanningReportsToolbarProps;
    timelineToolbarProps: PlanningTimelineToolbarProps;
}

interface PlanningTabConfig {
    id: PlanningTab;
    label: string;
    icon: LucideIcon;
    iconClassName: string;
}

interface PlanningHeaderTabButtonProps {
    tab: PlanningTabConfig;
    isActive: boolean;
    onTabChange: (tab: PlanningTab) => void;
}

export const PLANNING_TAB_CONFIGS: PlanningTabConfig[] = [
    {
        id: "timeline",
        label: "Planejamento Mensal",
        icon: TrendingUp,
        iconClassName: "bg-emerald-800/50 text-emerald-200",
    },
    {
        id: "reports",
        label: "Relatórios",
        icon: BarChart3,
        iconClassName: "bg-sky-800/50 text-sky-200",
    },
];

export const DEFAULT_PLANNING_TAB: PlanningTab = PLANNING_TAB_CONFIGS[0]?.id ?? "timeline";

function PlanningHeaderTabButton({ tab, isActive, onTabChange }: PlanningHeaderTabButtonProps) {
    const Icon = tab.icon;

    return (
        <button
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`group inline-flex items-center gap-2 rounded-xl border pl-2 pr-3 py-2 text-left transition-all duration-200 text-sm ${
                isActive
                    ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50"
                    : "border-white/[0.09] bg-white/[0.02] text-white/80 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white"
            }`}
        >
            <span className={`${tab.iconClassName} inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors`}>
                <Icon size={18} strokeWidth={2.2} />
            </span>
            {tab.label}
        </button>
    );
}

export function PlanningPageHeader({ activePlanningTab, onTabChange, reportsToolbarProps, timelineToolbarProps }: PlanningPageHeaderProps) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-3 text-left">
            <div className="inline-flex gap-2">
                {PLANNING_TAB_CONFIGS.map((tab) => (
                    <PlanningHeaderTabButton key={tab.id} tab={tab} isActive={activePlanningTab === tab.id} onTabChange={onTabChange} />
                ))}
            </div>

            {activePlanningTab === "reports" ? <PlanningReportsToolbar {...reportsToolbarProps} /> : <PlanningTimelineToolbar {...timelineToolbarProps} />}
        </header>
    );
}
