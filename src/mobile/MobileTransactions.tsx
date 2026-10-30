import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MiniTransactionBlock } from "../components/pages/home/SmTransactionBlock";
import {
    compareTransactions,
    formatMonthLabel,
    getCurrentMonthKey,
    getTransactionMonthKey,
    getTransactionSearchSource,
    shiftMonth,
    type TransactionsTabKey,
} from "../components/pages/transactions/transactionsPageShared";
import { type Transaction, useFinanceTransactions, useFinanceWallets } from "../context/FinanceContext";
import { normalizeComparisonText } from "../context/finance/helpers";
import { MobileAccountCombobox } from "./MobileAccountCombobox";
import { MobileProgressSummary } from "./MobileProgressSummary";
import { usePage } from "../context/PageContext";
import { parseAppDate } from "../lib/localDate";

// Same order and tones as the desktop TransactionsOverviewPanel tabs.
const TABS: { key: TransactionsTabKey; label: string; active: string }[] = [
    { key: "income", label: "Receitas", active: "border-emerald-300/45 bg-emerald-500/18 text-emerald-100" },
    { key: "spending", label: "Despesas", active: "border-red-300/45 bg-red-500/18 text-red-100" },
    { key: "transfer", label: "Transferências", active: "border-neutral-300/45 bg-neutral-500/15 text-neutral-50" },
];

const PENDING_LABEL: Record<TransactionsTabKey, string> = { spending: "A pagar", income: "A receber", transfer: "Agendadas" };
const TOTAL_LABEL: Record<TransactionsTabKey, string> = { spending: "Despesas do mês", income: "Receitas do mês", transfer: "Transferências do mês" };
const DONE_LABEL: Record<TransactionsTabKey, string> = { spending: "Pago", income: "Recebido", transfer: "Transferido" };

function dayLabel(dateValue: string) {
    const date = parseAppDate(dateValue);
    if (!date) return "Sem data";
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
}

export function groupByDay(items: Transaction[]) {
    const groups: { label: string; items: Transaction[] }[] = [];
    for (const item of items) {
        const label = dayLabel(item.date);
        const last = groups[groups.length - 1];
        if (last?.label === label) last.items.push(item);
        else groups.push({ label, items: [item] });
    }
    return groups;
}

export function MobileTransactions() {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { currentPage } = usePage();
    const [tab, setTab] = useState<TransactionsTabKey>(currentPage === "income" ? "income" : currentPage === "transfer" ? "transfer" : "spending");
    const [month, setMonth] = useState(getCurrentMonthKey);
    const [query, setQuery] = useState("");
    const [walletIds, setWalletIds] = useState<string[]>([]);

    const { pending, done, pendingTotal, doneTotal } = useMemo(() => {
        const walletName = new Map(wallets.map((wallet) => [wallet.id, wallet.name]));
        const search = query.trim() ? normalizeComparisonText(query) : "";
        // Card purchases live on the Faturas page, like on desktop.
        const visible = transactions
            .filter((item) => item.type === tab && item.paymentMethod !== "credit_card" && item.status !== "cancelled" && item.status !== "skipped")
            .filter((item) => getTransactionMonthKey(item.date) === month)
            .filter((item) => walletIds.length === 0 || walletIds.includes(item.inWallet) || walletIds.includes(item.destinationWalletId ?? ""))
            .filter(
                (item) =>
                    !search ||
                    normalizeComparisonText(getTransactionSearchSource(item, walletName.get(item.inWallet) ?? "", walletName.get(item.destinationWalletId ?? "") ?? "")).includes(search),
            )
            .sort((a, b) => compareTransactions(a, b, "date-desc"));
        const pendingItems = visible.filter((item) => item.status === "pending").reverse();
        const doneItems = visible.filter((item) => item.status === "paid");
        const sum = (items: Transaction[]) => items.reduce((total, item) => total + item.value, 0);
        return { pending: pendingItems, done: doneItems, pendingTotal: sum(pendingItems), doneTotal: sum(doneItems) };
    }, [transactions, wallets, tab, month, query, walletIds]);

    return (
        <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
                <button type="button" aria-label="Mês anterior" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="rounded-full p-2 text-neutral-400 active:bg-white/[0.06]">
                    <ChevronLeft size={20} />
                </button>
                <button type="button" onClick={() => setMonth(getCurrentMonthKey())} className="text-base font-medium capitalize text-white">
                    {formatMonthLabel(month)}
                </button>
                <button type="button" aria-label="Próximo mês" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="rounded-full p-2 text-neutral-400 active:bg-white/[0.06]">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.04] p-1" role="tablist">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.key}
                        onClick={() => setTab(item.key)}
                        className={`rounded-xl border py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${tab === item.key ? item.active : "border-transparent text-neutral-400"}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <MobileAccountCombobox label="Carteiras" placeholder="Todas as carteiras" emptyMessage="Nenhuma carteira encontrada." accounts={wallets} values={walletIds} onChange={setWalletIds} />

            <MobileProgressSummary totalLabel={TOTAL_LABEL[tab]} doneLabel={DONE_LABEL[tab]} pendingLabel={PENDING_LABEL[tab]} done={doneTotal} pending={pendingTotal} />

            <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <span className="sr-only">Buscar transações</span>
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por descrição, carteira ou categoria"
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 pl-9 pr-3 text-base text-white outline-none placeholder:text-neutral-600 focus:border-white/25"
                />
            </label>

            {pending.length === 0 && done.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">{query ? "Nada encontrado para essa busca." : "Nenhuma transação neste mês. Toque em + para adicionar."}</p>
            ) : (
                <>
                    {pending.length > 0 && (
                        <section>
                            <h2 className="mb-2 px-2 text-sm font-medium text-amber-200">{PENDING_LABEL[tab]}</h2>
                            <div className="space-y-3 rounded-2xl border border-amber-200/10 bg-amber-200/[0.03] py-2">
                                {groupByDay(pending).map((group) => (
                                    <div key={group.label}>
                                        <p className="px-4 text-xs text-neutral-500 first-letter:uppercase">{group.label}</p>
                                        {group.items.map((item) => (
                                            <MiniTransactionBlock key={item.id} transaction={item} showSign={false} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    {pending.length > 0 && done.length > 0 && (
                        <h2 className="px-2 pt-2 text-sm font-medium text-white">{DONE_LABEL[tab]}</h2>
                    )}
                    {groupByDay(done).map((group) => (
                        <section key={group.label}>
                            <h2 className="mb-1 px-2 text-sm text-neutral-400 first-letter:uppercase">{group.label}</h2>
                            {group.items.map((item) => (
                                <MiniTransactionBlock key={item.id} transaction={item} showSign={false} />
                            ))}
                        </section>
                    ))}
                </>
            )}
        </div>
    );
}
