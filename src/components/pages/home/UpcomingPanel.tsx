import { useMemo, useState } from "react";
import { type Transaction, useFinanceWallets } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { parseAppDate } from "../../../lib/localDate";
import { getTransactionCategoryDisplayLabel } from "../../../lib/transactionCategory";
import { WalletAvatar } from "../../common/WalletAvatar";
import { EditTransaction } from "../../modal/EditTransaction";
import { formatCurrencyBRL, getTransactionTypeMeta, resolveTransactionWallet } from "../../transactions/transactionView";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;

function dueLabel(offset: number, isIncome: boolean) {
    const verb = isIncome ? "Recebe" : "Vence";
    if (offset === 0) return `${verb} hoje`;
    if (offset === 1) return `${verb} amanhã`;
    return `Em ${offset} dias`;
}

function UpcomingTransactionRow({ transaction, date, offset }: { transaction: Transaction; date: Date; offset: number }) {
    const { openModal } = useModal();
    const wallet = resolveTransactionWallet(useFinanceWallets(), transaction.inWallet);
    const typeMeta = getTransactionTypeMeta(transaction.type);
    const isIncome = transaction.type === "income";
    const urgent = !isIncome && offset <= 1;

    return (
        <button
            type="button"
            onClick={() => openModal(<EditTransaction transaction={transaction} />)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2 pr-3 text-left outline-none transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            <span
                className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl border ${
                    urgent ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : isIncome ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/[0.08] bg-black/30 text-neutral-200"
                }`}
            >
                <span className="text-lg font-semibold leading-none tabular-nums">{date.getDate()}</span>
                <span className="mt-0.5 text-[10px] leading-none opacity-70">{date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
            </span>

            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{transaction.description || "Sem descrição"}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
                    <WalletAvatar wallet={wallet} className="h-4 w-4 shrink-0 rounded" iconSize={10} />
                    <span className="truncate">{wallet.name}</span>
                    <span className="h-3 w-px shrink-0 bg-white/10" />
                    <span className="truncate">{getTransactionCategoryDisplayLabel(transaction.category)}</span>
                </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-sm font-semibold tabular-nums ${typeMeta.amountColorClass}`}>
                    {isIncome ? "+" : "−"} R$ {formatCurrencyBRL(transaction.value)}
                </span>
                <span className={`text-[11px] ${urgent ? "text-amber-300" : "text-neutral-500"}`}>{dueLabel(offset, isIncome)}</span>
            </span>
        </button>
    );
}

export function UpcomingPanel({ transactions }: { transactions: Transaction[] }) {
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const days = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const buckets = Array.from({ length: WINDOW_DAYS + 1 }, (_, offset) => ({
            offset,
            date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset),
            items: [] as Transaction[],
            out: 0,
        }));
        // Card purchases are settled through the invoice, so only wallet items are listed.
        for (const transaction of transactions) {
            if (transaction.status !== "pending" || transaction.paymentMethod === "credit_card" || transaction.type === "transfer") continue;
            const date = parseAppDate(transaction.date);
            if (!date) continue;
            const offset = Math.round((date.getTime() - today.getTime()) / DAY_MS);
            const bucket = buckets[offset];
            if (!bucket) continue;
            bucket.items.push(transaction);
            if (transaction.type === "spending") bucket.out += transaction.value;
        }
        return buckets;
    }, [transactions]);

    const maxOut = Math.max(...days.map((day) => day.out), 1);
    const visible = (selectedDay === null ? days : days.filter((day) => day.offset === selectedDay)).flatMap((day) => day.items.map((item) => ({ item, day })));
    const totalOut = days.reduce((sum, day) => sum + day.out, 0);

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="text-lg font-medium text-white">Esta semana</p>
                {totalOut > 0 && <p className="text-sm tabular-nums text-neutral-400">R$ {formatCurrencyBRL(totalOut)} a pagar</p>}
            </div>

            <div className="grid grid-cols-8 gap-1">
                {days.map((day) => {
                    const selected = selectedDay === day.offset;
                    return (
                        <button
                            key={day.offset}
                            type="button"
                            onClick={() => setSelectedDay(selected ? null : day.offset)}
                            aria-pressed={selected}
                            className={`flex flex-col items-center gap-1 rounded-xl py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${selected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                        >
                            <span className="text-[11px] capitalize text-neutral-500">{day.offset === 0 ? "hoje" : day.date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                            <span className={`text-sm tabular-nums ${day.offset === 0 ? "font-semibold text-white" : "text-neutral-300"}`}>{day.date.getDate()}</span>
                            <span className="flex h-8 w-1.5 items-end rounded-full bg-white/[0.04]">
                                <span
                                    className={`w-full rounded-full ${day.out > 0 ? "bg-amber-300" : day.items.length > 0 ? "bg-emerald-400" : ""}`}
                                    style={{ height: day.items.length ? `${Math.max((day.out / maxOut) * 100, 18)}%` : 0 }}
                                />
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 space-y-1.5">
                {visible.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-neutral-500">{selectedDay === null ? "Nenhuma conta ou recebimento previsto" : "Nada previsto neste dia"}</p>
                ) : (
                    visible.slice(0, 6).map(({ item, day }) => <UpcomingTransactionRow key={item.id} transaction={item} date={day.date} offset={day.offset} />)
                )}
            </div>
        </section>
    );
}
