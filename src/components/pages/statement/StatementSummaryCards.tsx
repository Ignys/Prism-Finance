import type { StatementSummary } from "./statementPageShared";
import { formatCurrency } from "./statementPageShared";

interface StatementSummaryCardsProps {
    summary: StatementSummary;
}

interface SummaryCardProps {
    title: string;
    amount: number;
    countLabel?: string;
    borderColor: string;
    glowColor: string;
    text?: string;
}

export function StatementSummaryCards({ summary }: StatementSummaryCardsProps) {
    return (
        <section className="flex flex-col gap-1">
            <SummaryCard
                title="Valor da fatura"
                amount={summary.spentInMonth}
                countLabel={String(summary.transactionCountInMonth)}
                borderColor="border-red-300/[0.15]"
                glowColor="bg-red-400/30"
                text="text-red-300"
            />
            <SummaryCard title="Limite disponivel" amount={summary.availableLimitEstimate} borderColor="border-emerald-200/[0.15]" glowColor="bg-emerald-400/40" text="text-emerald-200" />
            <SummaryCard title="Limite total" amount={summary.limitTotalScope} borderColor="border-neutral-300/[0.2]" glowColor="bg-neutral-300/30" text="text-white" />
        </section>
    );
}

function SummaryCard({ title, amount, countLabel, borderColor, glowColor, text }: SummaryCardProps) {
    return (
        <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-[#111111] p-3.5 text-left w-full`}>
            <div className={`pointer-events-none absolute -bottom-20 -right-20 h-40 w-20 rounded-full ${glowColor} blur-3xl`} />
            <p className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-white/60 ">
                {title}
                {countLabel ? <span className="rounded-full">{countLabel}</span> : null}
            </p>
            <p className={`text-lg font-medium tracking-wider mt-1 ${text || "text-white"}`}>{formatCurrency(amount)}</p>
        </div>
    );
}
