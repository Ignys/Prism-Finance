import { formatCurrencyBRL } from "../components/transactions/transactionView";
import { LABEL_CLASS, Money } from "./MobileHeader";

interface MobileProgressSummaryProps {
    totalLabel: string;
    doneLabel: string;
    pendingLabel: string;
    done: number;
    pending: number;
}

// Total with a done/pending bar: how much of it is already settled.
export function MobileProgressSummary({ totalLabel, doneLabel, pendingLabel, done, pending }: MobileProgressSummaryProps) {
    const total = done + pending;
    const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <section className="px-1">
            <div className="flex items-baseline justify-between gap-3">
                <p className={LABEL_CLASS}>{totalLabel}</p>
                {total > 0 && <p className="text-xs tabular-nums text-neutral-500">{donePercent}% concluído</p>}
            </div>
            <Money value={total} className="mt-1 block text-2xl leading-none tracking-[-0.03em] text-white" />

            <div
                className="mt-4 flex h-1.5 gap-[3px]"
                role="img"
                aria-label={`${doneLabel} R$ ${formatCurrencyBRL(done)}, ${pendingLabel} R$ ${formatCurrencyBRL(pending)}`}
            >
                {total > 0 ? (
                    <>
                        {done > 0 && <span className="rounded-full bg-emerald-300" style={{ flexGrow: done }} />}
                        {pending > 0 && <span className="rounded-full bg-amber-200" style={{ flexGrow: pending }} />}
                    </>
                ) : (
                    <span className="flex-1 rounded-full bg-white/[0.06]" />
                )}
            </div>

            <div className="mt-3 text-sm">
                <div className="flex items-center justify-between gap-3 py-1">
                    <span className={`flex items-center gap-2 ${LABEL_CLASS}`}>
                        <span className="h-2 w-2 rounded-full bg-emerald-300" /> {doneLabel}
                    </span>
                    <Money value={done} className="text-neutral-100" />
                </div>
                <div className="flex items-center justify-between gap-3 py-1">
                    <span className={`flex items-center gap-2 ${LABEL_CLASS}`}>
                        <span className="h-2 w-2 rounded-full bg-amber-200" /> {pendingLabel}
                    </span>
                    <Money value={pending} className="text-amber-200" />
                </div>
            </div>
        </section>
    );
}
