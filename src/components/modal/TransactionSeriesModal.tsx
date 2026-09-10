import { useMemo } from "react";
import { X } from "lucide-react";
import { useFinanceCreditCards, useFinanceStoredTransactions, useFinanceTransactionGroups, useFinanceWallets, type Transaction } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ModalStructure } from "./ModalStructure";
import { STATUS_LABELS } from "../pages/transactions/transactionsPageShared";
import { formatCurrencyBRL, formatTransactionDate } from "../transactions/transactionView";
import { buildTransactionSeriesView, SERIES_PROJECTION_WINDOW, type TransactionSeriesRow, type TransactionSeriesView } from "../transactions/transactionSeriesView";
import type { RecurrenceRule } from "../../context/finance/recurrence/types";

const MODE_LABELS = { single: "Transação única", installment: "Parcelamento", recurring: "Recorrência" } as const;

const STATUS_CLASSES: Record<string, string> = {
    pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    paid: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    skipped: "border-slate-400/25 bg-slate-500/10 text-slate-200",
    cancelled: "border-red-400/25 bg-red-500/10 text-red-200",
};

function money(value: number): string {
    return `R$ ${formatCurrencyBRL(value)}`;
}

function describeRule(rule: RecurrenceRule | null): string {
    if (!rule) {
        return "Sem regra de recorrência";
    }

    const cadence = rule.interval === 1 ? "Todo mês" : `A cada ${rule.interval} meses`;
    if (rule.end.type === "count") {
        return `${cadence} · ${rule.end.count} ocorrências`;
    }
    if (rule.end.type === "until") {
        return `${cadence} · até ${formatTransactionDate(rule.end.date, "dd/MM/yyyy")}`;
    }
    return `${cadence} · sem data de término`;
}

function SummaryTile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
    return (
        <div className={`rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 ${tone}`}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</p>
            <p className="mt-1 truncate font-semibold text-white">{value}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</span>
            <span className="truncate text-sm text-white/80">{value}</span>
        </div>
    );
}

export function TransactionSeriesModal({ transaction }: { transaction: Transaction }) {
    const { closeModal } = useModal();
    const groups = useFinanceTransactionGroups();
    const storedTransactions = useFinanceStoredTransactions();
    const creditCards = useFinanceCreditCards();
    const wallets = useFinanceWallets();

    const view = useMemo(
        () => buildTransactionSeriesView({ groupId: transaction.groupId, groups, storedTransactions, creditCards }),
        [creditCards, groups, storedTransactions, transaction.groupId],
    );

    const resolveAccount = (row: TransactionSeriesRow): string => {
        if (row.creditCardId) {
            return creditCards.find((card) => card.id === row.creditCardId)?.name ?? "Cartão removido";
        }

        const source = wallets.find((wallet) => wallet.id === row.sourceWalletId)?.name;
        const destination = wallets.find((wallet) => wallet.id === row.destinationWalletId)?.name;
        return [source, destination].filter(Boolean).join(" → ") || "—";
    };

    return (
        <ModalStructure height="auto" width="880px">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171717] text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Série</p>
                        <h2 className="mt-1 truncate text-lg font-semibold text-white">{view?.group.title || transaction.description || transaction.category.label}</h2>
                        <p className="mt-1 text-sm text-white/55">{view ? MODE_LABELS[view.mode] : "Série não encontrada"}</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                        aria-label="Fechar série"
                    >
                        <X size={15} />
                    </button>
                </header>
                {view ? (
                    <SeriesBody view={view} resolveAccount={resolveAccount} currentTransactionId={transaction.id} />
                ) : (
                    <p className="px-5 py-6 text-sm text-white/60">Não foi possível localizar o grupo desta transação.</p>
                )}
            </div>
        </ModalStructure>
    );
}

function SeriesBody({ view, resolveAccount, currentTransactionId }: { view: TransactionSeriesView; resolveAccount: (row: TransactionSeriesRow) => string; currentTransactionId: string }) {
    const { group, totals, rows } = view;

    return (
        <div className="min-h-0 overflow-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoRow label="Categoria" value={[group.categoryName, group.subcategoryName].filter(Boolean).join(" / ") || "—"} />
                <InfoRow label="Beneficiário" value={group.beneficiaryName || "—"} />
                <InfoRow label="Início" value={rows[0] ? formatTransactionDate(rows[0].date, "dd/MM/yyyy") : "—"} />
                <InfoRow
                    label={view.mode === "recurring" ? "Regra" : "Total do grupo"}
                    value={view.mode === "recurring" ? describeRule(group.recurrenceRule) : money(group.totalAmount)}
                />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile label={view.mode === "installment" ? "Parcelas" : "Ocorrências"} value={`${totals.count}${view.hasMore ? "+" : ""}`} />
                <SummaryTile label="Já pago" value={money(totals.paidAmount)} tone="border-emerald-400/20 bg-emerald-500/10" />
                <SummaryTile label="A pagar" value={money(totals.pendingAmount)} tone="border-amber-400/20 bg-amber-500/10" />
                <SummaryTile label="Previstas / Ignoradas" value={`${totals.projectedCount} / ${totals.skippedCount}`} />
            </div>

            {view.segments.length > 1 ? (
                <p className="mt-3 text-xs text-white/45">Série dividida em {view.segments.length} trechos por edições do tipo “essa e as próximas”.</p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
                <div className="max-h-[46vh] overflow-auto">
                    <table className="min-w-full divide-y divide-white/[0.06] text-sm">
                        <thead className="sticky top-0 bg-[#1b1b1b] text-[10px] uppercase tracking-[0.12em] text-white/45">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">#</th>
                                <th className="px-3 py-2 text-left font-medium">Data</th>
                                <th className="px-3 py-2 text-right font-medium">Valor</th>
                                <th className="px-3 py-2 text-left font-medium">Status</th>
                                <th className="px-3 py-2 text-left font-medium">Origem</th>
                                <th className="px-3 py-2 text-left font-medium">Conta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05] bg-black/10">
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={row.id === currentTransactionId ? "bg-white/[0.06] text-white" : "text-white/85"}
                                    title={`id: ${row.id}\ngrupo: ${row.groupId}\nfatura: ${row.invoiceId ?? "—"}\npago em: ${row.paidAt ?? "—"}`}
                                >
                                    <td className="whitespace-nowrap px-3 py-2 text-white/60">
                                        {row.number ?? "—"}
                                        {view.mode === "installment" && group.installmentCount ? `/${group.installmentCount}` : ""}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">{formatTransactionDate(row.date, "dd/MM/yyyy")}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(row.amount)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${STATUS_CLASSES[row.status]}`}>{STATUS_LABELS[row.status]}</span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-white/60">{row.projected ? "Prevista" : row.commitment === "forecast" ? "Registrada (prévia)" : "Registrada"}</td>
                                    <td className="max-w-[180px] truncate px-3 py-2 text-white/70">{resolveAccount(row)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-white/45">
                {view.hasMore
                    ? `Série sem término definido: exibindo o histórico e as próximas ${SERIES_PROJECTION_WINDOW} ocorrências previstas${view.windowEndDate ? ` (até ${formatTransactionDate(view.windowEndDate, "dd/MM/yyyy")})` : ""}.`
                    : "Exibindo a série completa. Ocorrências previstas ainda não existem no banco — são projetadas pela regra."}
            </p>
        </div>
    );
}
