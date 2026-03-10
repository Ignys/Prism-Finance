import { currencyFormatter, type TransactionsSummary } from "./transactionsPageShared";

interface TransactionsSummaryCardsProps {
    summary: TransactionsSummary;
}

export function TransactionsSummaryCards({ summary }: TransactionsSummaryCardsProps) {
    return (
        <section className="flex flex-col gap-2 w-1/6 ">
            <div className="rounded-2xl border relative overflow-hidden border-white/[0.08] bg-[#111111] p-4 text-left">
                <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-neutral-700/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-neutral-500/10 blur-3xl" />
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Transações exibidas</p>
                <p className="mt-1 text-xl font-semibold text-white">{summary.count}</p>
            </div>
            <div className="rounded-2xl border relative overflow-hidden border-white/[0.08] bg-[#111111] p-4 text-left">
                <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-teal-700/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Entradas</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">{currencyFormatter.format(summary.income)}</p>
            </div>
            <div className="rounded-2xl border relative overflow-hidden border-white/[0.08] bg-[#111111] p-4 text-left">
                <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-rose-700/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Saídas</p>
                <p className="mt-1 text-xl font-semibold text-red-300">{currencyFormatter.format(summary.spending)}</p>
            </div>
            <div className="rounded-2xl border relative overflow-hidden border-white/[0.08] bg-[#111111] p-4 text-left">
                <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-yellow-700/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">Pendentes</p>
                <p className="mt-1 text-xl font-semibold text-amber-200">{currencyFormatter.format(summary.pending)}</p>
                {summary.transfer > 0 && <p className="mt-0.5 text-xs text-white/45">Transferências: {currencyFormatter.format(summary.transfer)}</p>}
            </div>
        </section>
    );
}
