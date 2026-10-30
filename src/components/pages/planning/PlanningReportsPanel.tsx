import type { ReactNode } from "react";

export const REPORT_MONO_STYLE = { fontFamily: '"Azeret Mono", monospace' } as const;

interface PlanningReportsPanelProps {
    title: string;
    aside?: ReactNode;
    className?: string;
    children: ReactNode;
}

// Mesmo cartão das outras páginas (Home, Faturas) para o relatório não parecer um app à parte.
export function PlanningReportsPanel({ title, aside, className = "", children }: PlanningReportsPanelProps) {
    return (
        <section className={`@container flex h-full min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-[#111111] p-4 sm:p-5 ${className}`}>
            <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <h2 className="min-w-0 text-base font-medium text-white">{title}</h2>
                {aside}
            </header>
            <div className="flex flex-1 flex-col">{children}</div>
        </section>
    );
}
