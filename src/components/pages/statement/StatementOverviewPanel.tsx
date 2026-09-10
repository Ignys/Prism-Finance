import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, CircleSlash, Lock, RotateCcw, Wallet } from "lucide-react";
import type { CreditCard, CreditCardInvoice } from "../../../context/FinanceContext";
import { MonthPickerControl } from "../../common/MonthPickerControl";
import { WalletAvatar } from "../../common/WalletAvatar";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import { type ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";
import {
    formatCurrency,
    formatMonthLabel,
    resolveInvoiceActionState,
    shiftMonth,
    STATEMENT_STATUS_BADGE_CLASS,
    STATEMENT_STATUS_LABELS,
    STATEMENT_STATUS_TEXT_CLASS,
    type StatementSummary,
} from "./statementPageShared";

// dueDate vem como YYYY-MM-DD; evita Date/timezone so para mostrar dia/mes.
function formatDayMonth(isoDate: string): string {
    const [, month, day] = isoDate.split("-");
    return month && day ? `${day}/${month}` : isoDate;
}

interface StatementOverviewPanelProps {
    creditCards: CreditCard[];
    selectedCardIds: string[];
    onCardIdsChange: (cardIds: string[]) => void;
    selectedMonth: string;
    currentInvoiceMonth: string;
    onMonthChange: (monthKey: string) => void;
    summary: StatementSummary;
    invoices: CreditCardInvoice[];
    cardById: Map<string, CreditCard>;
    onPayInvoice: (invoice: CreditCardInvoice, creditCard: CreditCard, settleWithoutWallet?: boolean) => void;
    onInvoiceStateAdjustment: (invoices: CreditCardInvoice[], action: "close" | "reopen") => void;
}

/**
 * Painel de controle/overview da fatura.
 * Substitui os 3 cards empilhados (StatementSummaryCards) por um unico card
 * onde o usuario escolhe o(s) cartao(oes) e o mes da fatura, ve dia de fechamento e
 * vencimento, limite total/disponivel e o valor da fatura do mes.
 */
export function StatementOverviewPanel({
    creditCards,
    selectedCardIds,
    onCardIdsChange,
    selectedMonth,
    currentInvoiceMonth,
    onMonthChange,
    summary,
    invoices,
    cardById,
    onPayInvoice,
    onInvoiceStateAdjustment,
}: StatementOverviewPanelProps) {
    // ponytail: seletor é multiselect na UI, mas fechamento/vencimento/fatura seguem escopados no primeiro cartão selecionado; agregação real entre vários cartões fica para quando for pedida.
    const selectedCard = creditCards.find((card) => card.id === selectedCardIds[0]) ?? null;
    const focusedInvoice = summary.focusedInvoice;
    const cardOptions = useMemo<CreditCardOption[]>(() => creditCards.map((card) => ({ id: card.id, label: card.name, searchText: card.name, card })), [creditCards]);

    const usagePercent = summary.limitTotalScope > 0 ? Math.min(100, Math.max(0, Math.round(((summary.limitTotalScope - summary.availableLimitEstimate) / summary.limitTotalScope) * 100))) : 0;

    const { payableInvoice, payableCreditCard, payButtonLabel, manualActionMode, manualActionInvoices, manualActionLabel } = useMemo(
        () => resolveInvoiceActionState(invoices, cardById),
        [invoices, cardById],
    );

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4"
        >
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-red-400/10 blur-3xl" />

            {/* Seletor de cartao */}
            <div className="relative">
                <MultiSelectCombobox
                    hideLabel
                    label="Cartão"
                    values={selectedCardIds}
                    placeholder="Todos os cartões"
                    emptyMessage="Nenhum cartao encontrado."
                    options={cardOptions}
                    onChange={onCardIdsChange}
                    renderOptionContent={(option) => <CardOptionContent option={option} />}
                    renderSelectedSummary={(selected) => <CardSelectedSummary options={selected} />}
                    triggerClassName="flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2.5 text-left text-sm text-white transition-colors hover:border-white/[0.2]"
                />
            </div>

            {/* Fechamento e vencimento */}
            {selectedCard && (
                <div className="relative mt-2 grid grid-rows-2 gap-1">
                    <div className="rounded-lg flex items-center justify-between bg-white/[0.03] px-2.5 py-1">
                        <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-white/45">
                            <Lock size={11} />
                            Fechamento
                        </p>
                        <p className="mt-0.5 text-xs uppercase font-medium text-white/70">Dia {selectedCard.closingDay}</p>
                    </div>
                    <div className="rounded-lg flex items-center justify-between bg-white/[0.03] px-2.5 py-1">
                        <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-white/45">
                            <Calendar size={11} />
                            Vencimento
                        </p>
                        <p className="mt-0.5 text-xs uppercase font-medium text-white/70">Dia {selectedCard.dueDay}</p>
                    </div>
                </div>
            )}

            {/* Navegacao de mes */}
            <div className="relative mt-3.5 border-y border-white/[0.06] py-2">
                <MonthPickerControl
                    selectedMonth={selectedMonth}
                    onMonthChange={onMonthChange}
                    formatMonthLabel={formatMonthLabel}
                    shiftMonth={shiftMonth}
                    shortcutMonth={currentInvoiceMonth}
                    shortcutLabel="Ir para a fatura atual"
                />
            </div>

            {/* CONTROLE DA FATURA: status, valor e acoes agrupados em um bloco unico */}
            <div className="relative mt-3.5">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.09em] font-medium text-white/45">Fatura do mês</p>
                        <p className={`mt-0.5 text-xl font-semibold tracking-wide ${focusedInvoice ? STATEMENT_STATUS_TEXT_CLASS[focusedInvoice.status] : "text-white"}`}>
                            {formatCurrency(summary.spentInMonth)}
                        </p>
                    </div>
                    <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            focusedInvoice ? STATEMENT_STATUS_BADGE_CLASS[focusedInvoice.status] : "border-white/[0.12] bg-white/[0.03] text-white/45"
                        }`}
                    >
                        {focusedInvoice ? STATEMENT_STATUS_LABELS[focusedInvoice.status] : "Sem gastos"}
                    </span>
                </div>

                {focusedInvoice && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-white/45">
                        <span>Vence em {formatDayMonth(focusedInvoice.dueDate)}</span>
                        {focusedInvoice.openAmount > 0 && <span className="text-white/60">Em aberto {formatCurrency(focusedInvoice.openAmount)}</span>}
                    </div>
                )}

                {(payableInvoice || manualActionMode) && (
                    <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                        {payableInvoice && payableCreditCard && (
                            <button
                                type="button"
                                onClick={() => onPayInvoice(payableInvoice, payableCreditCard)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/25"
                            >
                                <Wallet size={13} />
                                {payButtonLabel}
                            </button>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                            {payableInvoice && payableCreditCard && (
                                <button
                                    type="button"
                                    onClick={() => onPayInvoice(payableInvoice, payableCreditCard, true)}
                                    className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:border-white/[0.2] hover:text-white"
                                >
                                    <CircleSlash size={12} />
                                    Quitar sem carteira
                                </button>
                            )}
                            {manualActionMode && (
                                <button
                                    type="button"
                                    onClick={() => onInvoiceStateAdjustment(manualActionInvoices, manualActionMode)}
                                    className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-sky-200/80 transition-colors hover:border-sky-300/35 hover:bg-sky-500/10 hover:text-sky-100"
                                >
                                    {manualActionMode === "close" ? <Lock size={12} /> : <RotateCcw size={12} />}
                                    {manualActionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Limite utilizado */}
            <div className="relative mt-3.5 border-t border-white/[0.06] pt-3">
                <div className="flex items-center justify-between text-[12px] text-white/50">
                    <span>Limite</span>
                    <span>{usagePercent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${usagePercent}%` }} />
                </div>
            </div>

            {/* Disponivel / total */}
            <div className="relative mt-3 flex items-center justify-between gap-2">
                <div>
                    <p className="text-[11px] text-white/45">Disponível</p>
                    <p className="mt-0.5 text-sm font-medium text-emerald-200">{formatCurrency(summary.availableLimitEstimate)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[11px] text-white/45">Total</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{formatCurrency(summary.limitTotalScope)}</p>
                </div>
            </div>
        </motion.article>
    );
}
interface CreditCardOption extends ComboboxOptionBase {
    card: CreditCard;
}

function CardOptionContent({ option }: { option: CreditCardOption }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={option.card} className="h-7 w-7 shrink-0 rounded-lg border border-white/[0.12]" iconSize={14} />
            <span className="truncate text-sm text-white">{option.label}</span>
        </span>
    );
}

// Espelha o trigger do seletor de cartão do modal de transação (avatar + nome), mas somando "+N" quando há mais de um selecionado.
function CardSelectedSummary({ options }: { options: CreditCardOption[] }) {
    const [first, ...rest] = options;
    if (!first) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={first.card} className="h-7 w-7 shrink-0 rounded-lg border border-white/[0.12]" iconSize={14} />
            <span className="truncate text-sm text-white">
                {first.label}
                {rest.length > 0 ? ` +${rest.length}` : ""}
            </span>
        </span>
    );
}
