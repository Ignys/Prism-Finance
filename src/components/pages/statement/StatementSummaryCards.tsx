import type { StatementSummary } from "./statementPageShared";
import { formatCurrency } from "./statementPageShared";

interface StatementSummaryCardsProps {
    summary: StatementSummary;
}

interface SummaryCardProps {
    title: string;
    value: string;
    subtitle?: string;
    glowColor?: string;
    valueClassName?: string;
}

function SummaryCard({ title, value, subtitle, glowColor = "bg-neutral-300/10", valueClassName = "text-white" }: SummaryCardProps) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left">
            <div className={`pointer-events-none absolute -bottom-24 -right-16 h-36 w-36 rounded-full ${glowColor} blur-3xl`} />
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/38">{title}</p>
            <p className={`mt-1 text-xl font-semibold ${valueClassName}`}>{value}</p>
            {subtitle && <p className="mt-1 text-xs text-white/55">{subtitle}</p>}
        </div>
    );
}

export function StatementSummaryCards({ summary }: StatementSummaryCardsProps) {
    return (
        <section className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <SummaryCard
                title="Valor da fatura"
                value={formatCurrency(summary.spentInMonth)}
                glowColor="bg-sky-400/20"
            />
            <SummaryCard
                title="Limite disponivel"
                value={formatCurrency(summary.availableLimitEstimate)}
                glowColor="bg-emerald-400/20"
                valueClassName="text-emerald-200"
            />
            <SummaryCard title="Limite total" value={formatCurrency(summary.limitTotalScope)} glowColor="bg-cyan-400/20" />
        </section>
    );
}
