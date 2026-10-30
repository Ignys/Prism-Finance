import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PayCreditCardInvoiceModal } from "../components/modal/PayCreditCardInvoiceModal";
import { MiniTransactionBlock } from "../components/pages/home/SmTransactionBlock";
import {
    compareInvoicesByDueDate,
    getInvoiceOpenAmount,
    resolveCurrentInvoiceMonth,
    resolveInvoiceActionState,
    resolveInvoiceVisualStatus,
    selectInvoicePayments,
    STATEMENT_STATUS_TEXT_CLASS,
    STATEMENT_STATUS_LABELS,
} from "../components/pages/statement/statementPageShared";
import { formatMonthLabel, getCurrentMonthKey, getTransactionSearchSource, shiftMonth } from "../components/pages/transactions/transactionsPageShared";
import { useFinanceCreditCardInvoices, useFinanceCreditCards, useFinanceFavoriteCreditCard, useFinanceTransactions } from "../context/FinanceContext";
import { normalizeComparisonText } from "../context/finance/helpers";
import { monthPeriod } from "../context/finance/recurrence/period";
import { getMonthKeyFromDateValue } from "../context/financeTypes";
import { useModal } from "../context/ModalContext";
import { parseAppDate } from "../lib/localDate";
import { MobileProgressSummary } from "./MobileProgressSummary";
import { LABEL_CLASS } from "./MobileHeader";
import { MobileAccountCombobox } from "./MobileAccountCombobox";
import { groupByDay } from "./MobileTransactions";


export function MobileStatement() {
    const allCards = useFinanceCreditCards();
    const favoriteCardId = useFinanceFavoriteCreditCard();
    const { openModal } = useModal();
    const cards = allCards;
    const [cardIds, setCardIds] = useState<string[]>(() => {
        const initial = favoriteCardId && cards.some((card) => card.id === favoriteCardId) ? favoriteCardId : (cards.find((card) => card.isActive) ?? cards[0])?.id;
        return initial ? [initial] : [];
    });
    // Empty selection means every active card.
    const selectedCards = useMemo(() => (cardIds.length > 0 ? cards.filter((card) => cardIds.includes(card.id)) : cards), [cards, cardIds]);
    const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
    const card = selectedCards[0] ?? null;

    // Start on the invoice that matters now (closed/overdue/open), like desktop.
    const defaultInvoices = useFinanceCreditCardInvoices(monthPeriod(getCurrentMonthKey(), 2, 2));
    const [month, setMonth] = useState(() =>
        resolveCurrentInvoiceMonth(
            card,
            defaultInvoices.filter((invoice) => invoice.creditCardId === card?.id),
        ),
    );
    const [query, setQuery] = useState("");

    const period = monthPeriod(month, 2);
    const transactions = useFinanceTransactions(period);
    const invoices = useFinanceCreditCardInvoices(period);

    const monthInvoices = useMemo(
        () => invoices.filter((invoice) => selectedCards.some((item) => item.id === invoice.creditCardId) && getMonthKeyFromDateValue(invoice.dueDate) === month).sort(compareInvoicesByDueDate),
        [invoices, selectedCards, month],
    );

    const items = useMemo(() => {
        const invoiceIds = new Set(monthInvoices.map((invoice) => invoice.id));
        const purchases = transactions.filter(
            (item) => item.paymentMethod === "credit_card" && item.type === "spending" && item.status !== "cancelled" && Boolean(item.invoiceId) && invoiceIds.has(item.invoiceId ?? ""),
        );
        const search = query.trim() ? normalizeComparisonText(query) : "";
        return [...purchases, ...selectInvoicePayments(transactions, invoiceIds)]
            .filter((item) => !search || normalizeComparisonText(getTransactionSearchSource(item, cardById.get(item.creditCardId ?? "")?.name ?? "")).includes(search))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, monthInvoices, query, cardById]);

    // Status/due date only make sense for a single invoice.
    const invoice = monthInvoices.length === 1 ? monthInvoices[0] : null;
    const total = monthInvoices.reduce((sum, item) => sum + item.totalAmount, 0);
    const open = monthInvoices.reduce((sum, item) => sum + getInvoiceOpenAmount(item), 0);
    const status = invoice ? resolveInvoiceVisualStatus(invoice, cardById.get(invoice.creditCardId) ?? null) : null;
    const dueDate = invoice ? parseAppDate(invoice.dueDate) : null;
    const action = resolveInvoiceActionState(monthInvoices, cardById);
    const payableInvoice = action.payableInvoice;
    const payableCard = action.payableCreditCard;

    if (!card) {
        return <p className="py-16 text-center text-sm text-neutral-500">Cadastre um cartão de crédito em Cadastros para ver suas faturas.</p>;
    }

    return (
        <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
                <button type="button" aria-label="Mês anterior" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="rounded-full p-2 text-neutral-400 active:bg-white/[0.06]">
                    <ChevronLeft size={20} />
                </button>
                <p className="text-base font-medium capitalize text-white">{formatMonthLabel(month)}</p>
                <button type="button" aria-label="Próximo mês" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="rounded-full p-2 text-neutral-400 active:bg-white/[0.06]">
                    <ChevronRight size={20} />
                </button>
            </div>

            <MobileAccountCombobox label="Cartões" placeholder="Todos os cartões" emptyMessage="Nenhum cartão encontrado." accounts={cards} values={cardIds} onChange={setCardIds} />

            <MobileProgressSummary totalLabel="Total da fatura" doneLabel="Pago" pendingLabel="Em aberto" done={Math.max(total - open, 0)} pending={open} />

            {monthInvoices.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                        <p className={`flex items-center gap-2 text-sm font-medium ${status ? STATEMENT_STATUS_TEXT_CLASS[status] : "text-white"}`}>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
                            {status ? `Fatura ${STATEMENT_STATUS_LABELS[status].toLowerCase()}` : `${monthInvoices.length} faturas no mês`}
                        </p>
                        {dueDate && <p className={`mt-0.5 pl-4 ${LABEL_CLASS}`}>Vence {dueDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "")}</p>}
                    </div>
                    {payableInvoice && payableCard && (
                        <button
                            type="button"
                            onClick={() => openModal(<PayCreditCardInvoiceModal invoice={payableInvoice} creditCard={payableCard} />)}
                            className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 outline-none active:bg-emerald-500/25 focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                        >
                            {action.payButtonLabel}
                        </button>
                    )}
                </div>
            )}

            <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <span className="sr-only">Buscar na fatura</span>
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por descrição ou categoria"
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 pl-9 pr-3 text-base text-white outline-none placeholder:text-neutral-600 focus:border-white/25"
                />
            </label>

            {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">{query ? "Nada encontrado para essa busca." : "Nenhuma compra nesta fatura. Toque em + para adicionar."}</p>
            ) : (
                groupByDay(items).map((group) => (
                    <section key={group.label}>
                        <h2 className="mb-1 px-2 text-sm text-neutral-400 first-letter:uppercase">{group.label}</h2>
                        {group.items.map((item) => (
                            <MiniTransactionBlock key={item.id} transaction={item} />
                        ))}
                    </section>
                ))
            )}
        </div>
    );
}
