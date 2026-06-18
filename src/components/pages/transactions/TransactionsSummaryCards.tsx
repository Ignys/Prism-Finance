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
            <SummaryCard title={copy.paid} count={summary.paid.count} amount={summary.paid.amount} borderColor="border-emerald-200/[0.10]" glowColor="bg-emerald-400/20" text="text-emerald-200" />
            <SummaryCard title={copy.pending} count={summary.pending.count} amount={summary.pending.amount} borderColor="border-amber-300/[0.10]" glowColor="bg-amber-400/20" text="text-yellow-200" />
            <SummaryCard title={copy.total} count={summary.total.count} amount={summary.total.amount} borderColor="border-neutral-300/[0.10]" glowColor="bg-neutral-300/10" text="text-white" />
        </section>
    );
}

function SummaryCard({ title, count, amount, borderColor, glowColor, text }: { title: string; count: number; amount: number; borderColor: string; glowColor: string; text?: string }) {
    return (
        <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-[#111111] p-2 px-3 text-left`}>
            <div className={`pointer-events-none absolute -bottom-30 -right-20 h-40 w-20 rounded-full ${glowColor} blur-3xl`} />
            <p className="flex justify-between text-[9px] uppercase tracking-[0.14em] text-white/60">
                {title}
                <span className={`rounded-full`}>{count}</span>
            </p>
            <p className={` text-lg font-medium tracking-wider ${text || `text-white`}`}>{currencyFormatter.format(amount)}</p>
        </div>
    );
}
