import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Circle, CreditCard as CreditCardIcon, ListChecks, Pencil, Plus, Repeat2, Search, Trash2 } from "lucide-react";
import { type Beneficiary, type CreditCard, type CreditCardInvoice, type Transaction, useFinanceBeneficiaries, useFinanceTransactionGroups } from "../../../context/FinanceContext";
import { normalizeComparisonText } from "../../../context/finance/helpers";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { WalletAvatar } from "../../common/WalletAvatar";
import { formatTransactionDate } from "../../transactions/transactionView";
import {
    compareInvoicesByDueDate,
    formatCurrency,
    formatMonthLabel,
    getInvoiceOpenAmount,
    resolveInvoiceVisualStatus,
    type StatementInvoiceVisualStatus,
    STATEMENT_STATUS_BADGE_CLASS,
    STATEMENT_STATUS_LABELS,
} from "./statementPageShared";

interface StatementContentPanelProps {
    selectedMonth: string;
    allCardsSelected: boolean;
    invoices: CreditCardInvoice[];
    transactions: Transaction[];
    cardById: Map<string, CreditCard>;
    invoiceById: Map<string, CreditCardInvoice>;
    onPayInvoice: (invoice: CreditCardInvoice, creditCard: CreditCard) => void;
    onInvoiceStateAdjustment: (invoices: CreditCardInvoice[], action: "close" | "reopen") => void;
    onCreateCardSpending: () => void;
    onReviewInvoiceAssignments: () => void;
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
    invoiceRepairIssuesCount: number;
}

type StatementSortField = "status" | "date" | "description" | "category" | "beneficiary" | "value";
type StatementSortDirection = "asc" | "desc";
type StatementSortMode = `${StatementSortField}-${StatementSortDirection}`;
type ConsolidatedHeaderStatus = StatementInvoiceVisualStatus | "mixed" | "none";
type StatementTransactionVisualStatus = StatementInvoiceVisualStatus | "skipped";

interface SortableHeaderProps {
    label: string;
    field: StatementSortField;
    sortMode: StatementSortMode;
    align?: "left" | "right";
    onSortModeChange: (sortMode: StatementSortMode) => void;
}

interface StatementTransactionSnapshot {
    transaction: Transaction;
    transactionStatus: StatementTransactionVisualStatus | null;
    categoryLabel: string;
}

interface InvoiceSnapshot {
    invoice: CreditCardInvoice;
    creditCard: CreditCard | null;
    openAmount: number;
    visualStatus: StatementInvoiceVisualStatus;
}

type FinanceTransactionGroup = ReturnType<typeof useFinanceTransactionGroups>[number];

type TransactionSeriesIndicator = { kind: "installment"; label: string } | { kind: "recurring" } | null;

function resolveTransactionSeriesIndicator(transaction: Transaction, group: FinanceTransactionGroup | undefined): TransactionSeriesIndicator {
    const installmentNumber = transaction.installmentNumber;
    const installmentCount = group?.installmentCount;

    if (Number.isInteger(installmentNumber) && Number.isInteger(installmentCount) && Number(installmentNumber) > 0 && Number(installmentCount) >= 2) {
        return {
            kind: "installment",
            label: `(${Number(installmentNumber)}/${Number(installmentCount)})`,
        };
    }

    if (group?.transactionMode === "recurring") {
        return { kind: "recurring" };
    }

    return null;
}

const STATEMENT_STATUS_SORT_ORDER: Record<StatementInvoiceVisualStatus, number> = {
    overdue: 0,
    closed: 1,
    open: 2,
    future: 3,
    paid: 4,
};

const TRANSACTION_STATUS_SORT_ORDER: Record<StatementTransactionVisualStatus, number> = {
    ...STATEMENT_STATUS_SORT_ORDER,
    skipped: 4,
};

const TRANSACTION_STATUS_BADGE_CLASS: Record<StatementTransactionVisualStatus, string> = {
    ...STATEMENT_STATUS_BADGE_CLASS,
    skipped: "border-slate-400/25 bg-slate-500/10 text-slate-200",
};

const TRANSACTION_STATUS_LABELS: Record<StatementTransactionVisualStatus, string> = {
    ...STATEMENT_STATUS_LABELS,
    skipped: "Pulada",
};

const HEADER_STATUS_BADGE_CLASS: Record<ConsolidatedHeaderStatus, string> = {
    ...STATEMENT_STATUS_BADGE_CLASS,
    mixed: "border-violet-300/30 bg-violet-500/10 text-violet-200",
    none: "border-white/[0.2] bg-white/[0.05] text-white/70",
};

const HEADER_STATUS_LABELS: Record<ConsolidatedHeaderStatus, string> = {
    ...STATEMENT_STATUS_LABELS,
    mixed: "Mistas",
    none: "Sem fatura",
};

const SORT_DEFAULT_DIRECTION: Record<StatementSortField, StatementSortDirection> = {
    status: "asc",
    date: "desc",
    description: "asc",
    category: "asc",
    beneficiary: "asc",
    value: "desc",
};

function getSortField(sortMode: StatementSortMode): StatementSortField {
    return sortMode.split("-")[0] as StatementSortField;
}

function getSortDirection(sortMode: StatementSortMode): StatementSortDirection {
    return sortMode.split("-")[1] as StatementSortDirection;
}

function buildSortMode(field: StatementSortField, direction: StatementSortDirection): StatementSortMode {
    return `${field}-${direction}`;
}

function getAriaSort(field: StatementSortField, sortMode: StatementSortMode): "ascending" | "descending" | "none" {
    if (getSortField(sortMode) !== field) {
        return "none";
    }

    return getSortDirection(sortMode) === "asc" ? "ascending" : "descending";
}

function SortableHeader({ label, field, sortMode, align = "left", onSortModeChange }: SortableHeaderProps) {
    const active = getSortField(sortMode) === field;
    const direction = getSortDirection(sortMode);
    const ariaSort = getAriaSort(field, sortMode);

    const handleClick = () => {
        if (!active) {
            onSortModeChange(buildSortMode(field, SORT_DEFAULT_DIRECTION[field]));
            return;
        }

        onSortModeChange(buildSortMode(field, direction === "asc" ? "desc" : "asc"));
    };

    const Icon = !active ? Circle : direction === "asc" ? ArrowUp : ArrowDown;

    return (
        <th aria-sort={ariaSort} className={`border-b border-white/[0.08] px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-white/45 ${align === "right" ? "text-right" : "text-left"}`}>
            <button
                type="button"
                onClick={handleClick}
                className={`inline-flex w-full items-center gap-1.5 transition-colors hover:text-white/80 ${align === "right" ? "justify-end" : "justify-start"}`}
            >
                <span className="uppercase">{label}</span>
                <Icon size={12} className={active ? "text-white/80" : "text-white/35"} />
            </button>
        </th>
    );
}

function getCategoryDisplayLabel(transaction: Transaction): string {
    const categoryLabel = transaction.category.label;
    if (!transaction.category.parentLabel) {
        return categoryLabel;
    }

    const parts = categoryLabel.split("/");
    const subcategoryLabel = parts[parts.length - 1]?.trim();
    return subcategoryLabel || categoryLabel;
}

function compareByDateDesc(a: StatementTransactionSnapshot, b: StatementTransactionSnapshot): number {
    if (a.transaction.date === b.transaction.date) {
        return b.transaction.meta.criado_em.localeCompare(a.transaction.meta.criado_em);
    }

    return b.transaction.date.localeCompare(a.transaction.date);
}

function compareByDateAsc(a: StatementTransactionSnapshot, b: StatementTransactionSnapshot): number {
    if (a.transaction.date === b.transaction.date) {
        return a.transaction.meta.criado_em.localeCompare(b.transaction.meta.criado_em);
    }

    return a.transaction.date.localeCompare(b.transaction.date);
}

function compareByText(aValue: string, bValue: string): number {
    return aValue.localeCompare(bValue, "pt-BR", { sensitivity: "base" });
}

export function StatementContentPanel({
    selectedMonth,
    allCardsSelected,
    invoices,
    transactions,
    cardById,
    invoiceById,
    onPayInvoice,
    onInvoiceStateAdjustment,
    onCreateCardSpending,
    onReviewInvoiceAssignments,
    onEdit,
    onDelete,
    invoiceRepairIssuesCount,
}: StatementContentPanelProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const transactionGroups = useFinanceTransactionGroups();
    const sortedInvoices = [...invoices].sort(compareInvoicesByDueDate);
    const [sortMode, setSortMode] = useState<StatementSortMode>("date-desc");
    const [searchQuery, setSearchQuery] = useState("");

    const beneficiariesById = useMemo(() => {
        const map = new Map<string, Beneficiary>();
        beneficiaries.forEach((beneficiary) => {
            map.set(beneficiary.id, beneficiary);
        });
        return map;
    }, [beneficiaries]);

    const transactionGroupsById = useMemo(() => {
        const map = new Map<string, FinanceTransactionGroup>();
        transactionGroups.forEach((group) => {
            map.set(group.id, group);
        });
        return map;
    }, [transactionGroups]);

    const transactionSnapshots = useMemo<StatementTransactionSnapshot[]>(
        () =>
            transactions.map((transaction) => {
                const invoice = transaction.invoiceId ? invoiceById.get(transaction.invoiceId) : null;
                return {
                    transaction,
                    transactionStatus: transaction.status === "skipped" ? "skipped" : invoice ? resolveInvoiceVisualStatus(invoice, cardById.get(invoice.creditCardId) ?? null) : null,
                    categoryLabel: getCategoryDisplayLabel(transaction),
                };
            }),
        [cardById, invoiceById, transactions],
    );

    const filteredTransactionSnapshots = useMemo(() => {
        const normalizedSearch = searchQuery.trim() ? normalizeComparisonText(searchQuery) : "";
        if (!normalizedSearch) {
            return transactionSnapshots;
        }

        return transactionSnapshots.filter((snapshot) => {
            const cardName = snapshot.transaction.creditCardId ? (cardById.get(snapshot.transaction.creditCardId)?.name ?? "") : "";
            const searchSource = [snapshot.transaction.description || "", snapshot.transaction.beneficiary, snapshot.categoryLabel, cardName, ...snapshot.transaction.tags.map((tag) => tag.name)].join(
                " ",
            );

            return normalizeComparisonText(searchSource).includes(normalizedSearch);
        });
    }, [cardById, searchQuery, transactionSnapshots]);

    const sortedTransactionSnapshots = useMemo(() => {
        const field = getSortField(sortMode);
        const direction = getSortDirection(sortMode);

        const sorted = [...filteredTransactionSnapshots].sort((a, b) => {
            if (field === "status") {
                const aStatusValue = a.transactionStatus ? TRANSACTION_STATUS_SORT_ORDER[a.transactionStatus] : Number.MAX_SAFE_INTEGER;
                const bStatusValue = b.transactionStatus ? TRANSACTION_STATUS_SORT_ORDER[b.transactionStatus] : Number.MAX_SAFE_INTEGER;
                const statusComparison = aStatusValue - bStatusValue;
                if (statusComparison !== 0) {
                    return direction === "asc" ? statusComparison : -statusComparison;
                }
                return compareByDateDesc(a, b);
            }

            if (field === "date") {
                return direction === "asc" ? compareByDateAsc(a, b) : compareByDateDesc(a, b);
            }

            if (field === "description") {
                const descriptionComparison = compareByText(a.transaction.description || "Sem descricao", b.transaction.description || "Sem descricao");
                if (descriptionComparison !== 0) {
                    return direction === "asc" ? descriptionComparison : -descriptionComparison;
                }
                return compareByDateDesc(a, b);
            }

            if (field === "category") {
                const categoryComparison = compareByText(a.categoryLabel, b.categoryLabel);
                if (categoryComparison !== 0) {
                    return direction === "asc" ? categoryComparison : -categoryComparison;
                }
                return compareByDateDesc(a, b);
            }

            if (field === "beneficiary") {
                const beneficiaryComparison = compareByText(a.transaction.beneficiary.trim(), b.transaction.beneficiary.trim());
                if (beneficiaryComparison !== 0) {
                    return direction === "asc" ? beneficiaryComparison : -beneficiaryComparison;
                }
                return compareByDateDesc(a, b);
            }

            const valueComparison = a.transaction.value - b.transaction.value;
            if (valueComparison !== 0) {
                return direction === "asc" ? valueComparison : -valueComparison;
            }

            return compareByDateDesc(a, b);
        });

        return sorted;
    }, [filteredTransactionSnapshots, sortMode]);

    const invoiceSnapshots = useMemo<InvoiceSnapshot[]>(
        () =>
            sortedInvoices.map((invoice) => ({
                invoice,
                creditCard: cardById.get(invoice.creditCardId) ?? null,
                openAmount: getInvoiceOpenAmount(invoice),
                visualStatus: resolveInvoiceVisualStatus(invoice, cardById.get(invoice.creditCardId) ?? null),
            })),
        [cardById, sortedInvoices],
    );

    const invoiceMonthLabel = useMemo(() => {
        return formatMonthLabel(selectedMonth);
    }, [selectedMonth]);

    const headerTitle = `${allCardsSelected ? "Faturas" : "Fatura"} de ${invoiceMonthLabel}`;

    const headerStatus = useMemo<ConsolidatedHeaderStatus>(() => {
        if (invoiceSnapshots.length < 1) {
            return "none";
        }

        if (!allCardsSelected) {
            return invoiceSnapshots[0].visualStatus;
        }

        const uniqueStatuses = new Set(invoiceSnapshots.map((snapshot) => snapshot.visualStatus));
        if (uniqueStatuses.size === 1) {
            return invoiceSnapshots[0].visualStatus;
        }

        return "mixed";
    }, [allCardsSelected, invoiceSnapshots]);

    const payableSnapshot = useMemo(() => {
        const payable = invoiceSnapshots.filter((snapshot): snapshot is InvoiceSnapshot & { creditCard: CreditCard } => Boolean(snapshot.creditCard) && snapshot.openAmount > 0);
        if (payable.length < 1) {
            return null;
        }

        if (!allCardsSelected) {
            return payable[0];
        }

        return [...payable].sort((a, b) => {
            const priorityDifference = STATEMENT_STATUS_SORT_ORDER[a.visualStatus] - STATEMENT_STATUS_SORT_ORDER[b.visualStatus];
            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            if (a.invoice.dueDate === b.invoice.dueDate) {
                return a.invoice.id.localeCompare(b.invoice.id);
            }

            return a.invoice.dueDate.localeCompare(b.invoice.dueDate);
        })[0];
    }, [allCardsSelected, invoiceSnapshots]);

    const payButtonLabel = payableSnapshot?.visualStatus === "open" || payableSnapshot?.visualStatus === "future" ? "Pagar adiantado" : allCardsSelected ? "Pagar faturas" : "Pagar fatura";
    const closeableSnapshots = useMemo(
        () => invoiceSnapshots.filter((snapshot): snapshot is InvoiceSnapshot & { creditCard: CreditCard } => Boolean(snapshot.creditCard) && snapshot.visualStatus === "overdue" && snapshot.openAmount > 0),
        [invoiceSnapshots],
    );
    const reopenableSnapshots = useMemo(() => invoiceSnapshots.filter((snapshot) => snapshot.visualStatus === "paid"), [invoiceSnapshots]);
    const manualActionMode: "close" | "reopen" | null = closeableSnapshots.length > 0 ? "close" : reopenableSnapshots.length > 0 ? "reopen" : null;
    const manualActionInvoices = manualActionMode === "close" ? closeableSnapshots.map((snapshot) => snapshot.invoice) : manualActionMode === "reopen" ? reopenableSnapshots.map((snapshot) => snapshot.invoice) : [];
    const manualActionLabel =
        manualActionMode === "close" ? (allCardsSelected && manualActionInvoices.length > 1 ? "Fechar vencidas" : "Fechar vencida") : manualActionMode === "reopen" ? (allCardsSelected && manualActionInvoices.length > 1 ? "Reabrir pagas" : "Reabrir paga") : "";
    const canCreateCardSpending = cardById.size > 0;
    const hasInvoiceRepairIssues = invoiceRepairIssuesCount > 0;

    return (
        <div className="flex flex-col gap-3">
            <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="flex flex-col gap-3">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">{headerTitle}</h1>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${HEADER_STATUS_BADGE_CLASS[headerStatus]}`}>
                                {HEADER_STATUS_LABELS[headerStatus]}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {manualActionMode ? (
                                <button
                                    type="button"
                                    onClick={() => onInvoiceStateAdjustment(manualActionInvoices, manualActionMode)}
                                    className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-sky-100 transition-colors hover:border-sky-300/45 hover:bg-sky-500/20"
                                >
                                    {manualActionLabel}
                                </button>
                            ) : null}

                            {payableSnapshot ? (
                                <button
                                    type="button"
                                    onClick={() => onPayInvoice(payableSnapshot.invoice, payableSnapshot.creditCard)}
                                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/20"
                                >
                                    {payButtonLabel}
                                </button>
                            ) : null}

                            {!manualActionMode && !payableSnapshot ? (
                                <button
                                    type="button"
                                    className="opacity-0 items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/20"
                                >
                                    .
                                </button>
                            ) : null}
                        </div>
                    </header>
                </div>
            </section>

            <div className="flex items-center gap-2 justify-between">
                <div className="relative w-full">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Buscar por descricao, beneficiario, categoria, cartao ou tag"
                        className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
                    />
                </div>
                <div className="flex py-1.5 gap-2">
                    {hasInvoiceRepairIssues && (
                        <button
                            type="button"
                            onClick={onReviewInvoiceAssignments}
                            className="inline-flex truncate cursor-pointer items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-sky-100 transition-all hover:border-sky-300/45 hover:bg-sky-500/20"
                        >
                            <ListChecks size={14} />
                            Revisar faturas ({invoiceRepairIssuesCount})
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onCreateCardSpending}
                        disabled={!canCreateCardSpending}
                        className="inline-flex truncate cursor-pointer items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-all hover:border-emerald-300/45 hover:bg-emerald-500/20"
                    >
                        <Plus size={14} />
                        Adicionar gasto
                    </button>
                </div>
            </div>

            <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-3 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm uppercase tracking-[0.15em] text-white/45">Compras no cartao</p>
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-xs text-white/60">{sortedTransactionSnapshots.length} itens</span>
                </div>

                {sortedTransactionSnapshots.length < 1 ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center text-sm text-white/55">
                        <p>Nenhuma compra encontrada para {invoiceMonthLabel}.</p>
                        {!canCreateCardSpending && <p className="mt-3 text-xs text-white/40">Cadastre um cartao para lancar gastos em fatura.</p>}
                    </div>
                ) : (
                    <table className="w-full border-separate border-spacing-0 text-sm text-white/85">
                        <thead>
                            <tr>
                                <SortableHeader label="Status" field="status" sortMode={sortMode} onSortModeChange={setSortMode} />
                                <SortableHeader label="Data" field="date" sortMode={sortMode} onSortModeChange={setSortMode} />
                                <SortableHeader label="Descricao" field="description" sortMode={sortMode} onSortModeChange={setSortMode} />
                                <SortableHeader label="Categoria" field="category" sortMode={sortMode} onSortModeChange={setSortMode} />
                                <th className="border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">Tags</th>
                                <SortableHeader label="Beneficiario" field="beneficiary" sortMode={sortMode} onSortModeChange={setSortMode} />
                                <SortableHeader label="Valor" field="value" sortMode={sortMode} align="right" onSortModeChange={setSortMode} />
                                <th className="border-b border-white/[0.08] px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em] text-white/45">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTransactionSnapshots.map(({ transaction, transactionStatus, categoryLabel }) => {
                                const group = transactionGroupsById.get(transaction.groupId);
                                const seriesIndicator = resolveTransactionSeriesIndicator(transaction, group);
                                const creditCard = transaction.creditCardId ? cardById.get(transaction.creditCardId) : null;
                                const CategoryIcon = getCategoryIconComponent(transaction.category.icon, transaction.category.type);
                                const categoryColor = transaction.category.color ?? "#9CA3AF";
                                const categoryBackground = `${categoryColor}22`;
                                const beneficiary = transaction.beneficiaryId ? beneficiariesById.get(transaction.beneficiaryId) : null;
                                const beneficiaryAvatarImage = beneficiary?.avatarImage ?? null;
                                const beneficiaryAvatarColor = beneficiary?.avatarColor ?? "#4B5563";
                                const visibleTags = transaction.tags.slice(0, 2);
                                const hiddenTagsCount = Math.max(transaction.tags.length - visibleTags.length, 0);

                                return (
                                    <tr key={transaction.id} className="odd:bg-white/[0.01]">
                                        <td className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                            <span className="inline-flex h-8 w-8 items-center justify-center">
                                                {creditCard ? (
                                                    <WalletAvatar wallet={creditCard} className="h-8 w-8 rounded-md border border-white/[0.12]" iconSize={16} iconStrokeWidth={1.7} />
                                                ) : (
                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.03] text-white/45">
                                                        <CreditCardIcon size={14} />
                                                    </span>
                                                )}
                                            </span>
                                            {transactionStatus ? (
                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${TRANSACTION_STATUS_BADGE_CLASS[transactionStatus]}`}
                                                >
                                                    {TRANSACTION_STATUS_LABELS[transactionStatus]}
                                                </span>
                                            ) : (
                                                "--"
                                            )}
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-white/70">{formatTransactionDate(transaction.date, "dd/MM/yyyy")}</td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-[14px] font-medium text-white">
                                            <div className="inline-flex items-center gap-1.5">
                                                <span>{transaction.description || "Sem descricao"}</span>
                                                {seriesIndicator?.kind === "installment" && <span className="text-xs text-white/55">{seriesIndicator.label}</span>}
                                                {seriesIndicator?.kind === "recurring" && (
                                                    <span className="inline-flex text-white/55" role="img" title="Transacao recorrente" aria-label="Transacao recorrente">
                                                        <Repeat2 size={13} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1]"
                                                    style={{ color: categoryColor, backgroundColor: categoryBackground }}
                                                >
                                                    <CategoryIcon size={16} />
                                                </span>
                                                <span>{categoryLabel}</span>
                                            </div>
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                            {visibleTags.length < 1 ? (
                                                <span className="text-white/35">Sem tags</span>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {visibleTags.map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className="rounded-full border border-white/12 px-2 py-0.5 text-[11px]/4 font-medium uppercase text-white/75"
                                                            style={{ backgroundColor: `${tag.color ?? "#64748B"}26` }}
                                                        >
                                                            {tag.name}
                                                        </span>
                                                    ))}
                                                    {hiddenTagsCount > 0 && (
                                                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/55">
                                                            +{hiddenTagsCount}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5">
                                            <div className="flex items-center gap-2 text-white/70">
                                                <span className="inline-flex h-7 w-7 items-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.03]">
                                                    {beneficiaryAvatarImage ? (
                                                        <img src={beneficiaryAvatarImage} alt={beneficiary?.name ?? "Beneficiario"} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="block h-full w-full" style={{ backgroundColor: beneficiary ? beneficiaryAvatarColor : "#374151" }} aria-hidden="true" />
                                                    )}
                                                </span>
                                                <span>{beneficiary?.name ?? transaction.beneficiary}</span>
                                            </div>
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-right font-semibold text-red-400">{formatCurrency(transaction.value)}</td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(transaction)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                                                    aria-label="Editar transacao"
                                                    title="Editar transacao"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(transaction)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100"
                                                    aria-label="Excluir transacao"
                                                    title="Excluir transacao"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
