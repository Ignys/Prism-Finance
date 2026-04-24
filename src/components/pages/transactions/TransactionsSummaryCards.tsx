import { currencyFormatter, type TransactionsSummary, type TransactionsTabKey } from "./transactionsPageShared";

interface TransactionsSummaryCardsProps {
    activeTab: TransactionsTabKey;
    summary: TransactionsSummary;
}

const SUMMARY_COPY: Record<TransactionsTabKey, { paid: string; pending: string; total: string }> = {
    income: {
        paid: "Recebidas",
        pending: "Pendentes",
        total: "Total",
    },
    spending: {
        paid: "Pagas",
        pending: "Pendentes",
        total: "Total",
    },
    transfer: {
        paid: "Efetuadas",
        pending: "Pendentes",
        total: "Total",
    },
};

export function TransactionsSummaryCards({ activeTab, summary }: TransactionsSummaryCardsProps) {
    const copy = SUMMARY_COPY[activeTab];
    return (
        <section className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <SummaryCard title={copy.paid} count={summary.paid.count} amount={summary.paid.amount}  glowColor="bg-emerald-400/20" text="text-emerald-200" />
            <SummaryCard title={copy.pending} count={summary.pending.count} amount={summary.pending.amount} glowColor="bg-amber-400/20" text="text-yellow-200" />
            <SummaryCard title={copy.total} count={summary.total.count} amount={summary.total.amount}  glowColor="bg-neutral-300/10" text="text-white" />
        </section>
    );
}

function SummaryCard({ title, count, amount, glowColor, text }: { title: string; count: number; amount: number; glowColor: string; text?: string }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left">
            <div className={`pointer-events-none absolute -bottom-30 -right-20 h-40 w-40 rounded-full ${glowColor} blur-3xl`} />
            <p className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-white/38">
                {title}
                <span className={`rounded-full`}>{count}</span>
            </p>
            <p className={`mt-1 text-xl font-semibold ${text || `text-white`}`}>{currencyFormatter.format(amount)}</p>
        </div>
    );
}
