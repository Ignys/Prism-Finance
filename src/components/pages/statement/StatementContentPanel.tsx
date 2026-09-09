import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Circle, CreditCard as CreditCardIcon, Repeat2, Search } from "lucide-react";
import { type Beneficiary, type CreditCard, type CreditCardInvoice, type Transaction, useFinanceBeneficiaries, useFinanceSession, useFinanceTransactionGroups } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { normalizeComparisonText } from "../../../context/finance/helpers";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { useLocalPreferenceSection } from "../../../lib/localPreferences";
import { getTransactionCategoryDisplayLabel } from "../../../lib/transactionCategory";
import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
import { TableColumnToggleButton } from "../../common/TableColumnToggleButton";
import { WalletAvatar } from "../../common/WalletAvatar";
import { BulkTransactionEditModal } from "../../modal/BulkTransactionEditModal";
import { BulkHeaderCheckbox, BulkRowCheckbox, FloatingTransactionBulkFooter } from "../../transactions/TransactionBulkSelectionControls";
import { TransactionContextMenu, type TransactionContextMenuState } from "../../transactions/TransactionContextMenu";
import { buildTransactionContextActions, type TransactionContextAction } from "../../transactions/transactionContextActions";
import { formatCurrencyBRL, formatTransactionDate } from "../../transactions/transactionView";
import { isTransactionEligibleForBulkEdit, useTransactionBulkSelection } from "../../transactions/useTransactionBulkSelection";
import {
    compareInvoicesByDueDate,
    formatCurrency,
    formatMonthLabel,
    getInvoiceOpenAmount,
    resolveInvoiceVisualStatus,
    type StatementInvoiceVisualStatus,
    STATEMENT_STATUS_BADGE_CLASS,
    STATEMENT_STATUS_LABELS,
    STATEMENT_STATUS_SORT_ORDER,
} from "./statementPageShared";

interface StatementContentPanelProps {
    selectedMonth: string;
    invoices: CreditCardInvoice[];
    transactions: Transaction[];
    cardById: Map<string, CreditCard>;
    invoiceById: Map<string, CreditCardInvoice>;
    onAction: (transaction: Transaction, action: TransactionContextAction) => void;
    summaryAside?: ReactNode;
}

type StatementSortField = "status" | "date" | "description" | "category" | "beneficiary" | "value";
type StatementSortDirection = "asc" | "desc";
type StatementSortMode = `${StatementSortField}-${StatementSortDirection}`;
type ConsolidatedHeaderStatus = StatementInvoiceVisualStatus | "mixed" | "none" | "forecast";
type StatementTransactionVisualStatus = StatementInvoiceVisualStatus | "skipped" | "forecast";

interface StatementTableViewPreferences {
    sortMode: StatementSortMode;
    searchQuery: string;
    showStatus: boolean;
    showDate: boolean;
    showDescription: boolean;
    showCategory: boolean;
    showTags: boolean;
    showBeneficiary: boolean;
    showValue: boolean;
}

const STATEMENT_TABLE_VIEW_PREFERENCES_SECTION = "statement.table-view";
const DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES: StatementTableViewPreferences = {
    sortMode: "date-desc",
    searchQuery: "",
    showStatus: true,
    showDate: true,
    showDescription: true,
    showCategory: true,
    showTags: true,
    showBeneficiary: true,
    showValue: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatementSortMode(value: unknown): StatementSortMode {
    return typeof value === "string" && /^(status|date|description|category|beneficiary|value)-(asc|desc)$/.test(value)
        ? (value as StatementSortMode)
        : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.sortMode;
}

function normalizeStatementTableViewPreferences(value: unknown): StatementTableViewPreferences {
    if (!isRecord(value)) {
        return DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES;
    }

    return {
        sortMode: normalizeStatementSortMode(value.sortMode),
        searchQuery: typeof value.searchQuery === "string" ? value.searchQuery : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.searchQuery,
        showStatus: typeof value.showStatus === "boolean" ? value.showStatus : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showStatus,
        showDate: typeof value.showDate === "boolean" ? value.showDate : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showDate,
        showDescription: typeof value.showDescription === "boolean" ? value.showDescription : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showDescription,
        showCategory: typeof value.showCategory === "boolean" ? value.showCategory : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showCategory,
        showTags: typeof value.showTags === "boolean" ? value.showTags : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showTags,
        showBeneficiary: typeof value.showBeneficiary === "boolean" ? value.showBeneficiary : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showBeneficiary,
        showValue: typeof value.showValue === "boolean" ? value.showValue : DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES.showValue,
    };
}

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

const TRANSACTION_STATUS_SORT_ORDER: Record<StatementTransactionVisualStatus, number> = {
    ...STATEMENT_STATUS_SORT_ORDER,
    forecast: 5,
    skipped: 4,
};

const TRANSACTION_STATUS_BADGE_CLASS: Record<StatementTransactionVisualStatus, string> = {
    ...STATEMENT_STATUS_BADGE_CLASS,
    forecast: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    skipped: "border-slate-400/25 bg-slate-500/10 text-slate-200",
};

const TRANSACTION_STATUS_LABELS: Record<StatementTransactionVisualStatus, string> = {
    ...STATEMENT_STATUS_LABELS,
    forecast: "PREVISTA",
    skipped: "IGNORADA",
};

const HEADER_STATUS_BADGE_CLASS: Record<ConsolidatedHeaderStatus, string> = {
    ...STATEMENT_STATUS_BADGE_CLASS,
    forecast: TRANSACTION_STATUS_BADGE_CLASS.forecast,
    mixed: "border-violet-300/30 bg-violet-500/10 text-violet-200",
    none: "border-white/[0.2] bg-white/[0.05] text-white/70",
};

const HEADER_STATUS_LABELS: Record<ConsolidatedHeaderStatus, string> = {
    ...STATEMENT_STATUS_LABELS,
    forecast: "Previsão",
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
        <th
            aria-sort={ariaSort}
            className={`overflow-hidden whitespace-nowrap border-b border-white/[0.08] px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-white/45 ${align === "right" ? "text-right" : "text-left"}`}
        >
            <button
                type="button"
                onClick={handleClick}
                className={`inline-flex w-full min-w-0 items-center gap-1.5 transition-colors hover:text-white/80 ${align === "right" ? "justify-end" : "justify-start"}`}
            >
                <span className="truncate uppercase">{label}</span>
                <Icon size={12} className={active ? "text-white/80" : "text-white/35"} />
            </button>
        </th>
    );
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
    invoices,
    transactions,
    cardById,
    invoiceById,
    onAction,
    summaryAside,
}: StatementContentPanelProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const transactionGroups = useFinanceTransactionGroups();
    const { user } = useFinanceSession();
    const { openModal } = useModal();
    const sortedInvoices = [...invoices].sort(compareInvoicesByDueDate);
    const [viewPreferences, setViewPreferences] = useLocalPreferenceSection(
        user?.uid,
        STATEMENT_TABLE_VIEW_PREFERENCES_SECTION,
        DEFAULT_STATEMENT_TABLE_VIEW_PREFERENCES,
        normalizeStatementTableViewPreferences,
    );
    const [contextMenu, setContextMenu] = useState<TransactionContextMenuState | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const { sortMode, searchQuery, showStatus, showDate, showDescription, showCategory, showTags, showBeneficiary, showValue } = viewPreferences;

    const setSortMode = (nextSortMode: StatementSortMode) => {
        setViewPreferences((current) => ({
            ...current,
            sortMode: nextSortMode,
        }));
    };

    const setSearchQuery = (nextSearchQuery: string) => {
        setViewPreferences((current) => ({
            ...current,
            searchQuery: nextSearchQuery,
        }));
    };

    const toggleViewPreference = (key: keyof Omit<StatementTableViewPreferences, "sortMode" | "searchQuery">) => {
        setViewPreferences((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

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
                    transactionStatus:
                        transaction.status === "skipped"
                            ? "skipped"
                            : transaction.commitment === "forecast"
                              ? "forecast"
                              : invoice
                                ? resolveInvoiceVisualStatus(invoice, cardById.get(invoice.creditCardId) ?? null)
                                : null,
                    categoryLabel: getTransactionCategoryDisplayLabel(transaction.category),
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
    const displayedTransactions = useMemo(() => sortedTransactionSnapshots.map((snapshot) => snapshot.transaction), [sortedTransactionSnapshots]);
    const bulkSelection = useTransactionBulkSelection(displayedTransactions);

    const contextTransaction = useMemo(
        () => sortedTransactionSnapshots.find((snapshot) => snapshot.transaction.id === contextMenu?.transactionId)?.transaction ?? null,
        [contextMenu?.transactionId, sortedTransactionSnapshots],
    );
    const contextActions = useMemo(
        () =>
            contextTransaction
                ? buildTransactionContextActions({
                      transaction: contextTransaction,
                      group: transactionGroupsById.get(contextTransaction.groupId),
                      isSelected: bulkSelection.selectedIdSet.has(contextTransaction.id),
                  })
                : [],
        [bulkSelection.selectedIdSet, contextTransaction, transactionGroupsById],
    );

    useEffect(() => {
        if (contextMenu && !contextTransaction) {
            setContextMenu(null);
        }
    }, [contextMenu, contextTransaction]);

    useEffect(() => {
        if (selectionMode && bulkSelection.selectedCount < 1) {
            setSelectionMode(false);
        }
    }, [bulkSelection.selectedCount, selectionMode]);

    const handleRowContextMenu = (event: MouseEvent<HTMLTableRowElement>, transaction: Transaction) => {
        event.preventDefault();
        setContextMenu({
            transactionId: transaction.id,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const handleSelectAction = (action: TransactionContextAction) => {
        if (!contextTransaction) {
            return;
        }

        setContextMenu(null);
        if (action.id === "select") {
            setSelectionMode(true);
            bulkSelection.toggleTransaction(contextTransaction.id);
            return;
        }

        onAction(contextTransaction, action);
    };

    const selectedTransactions = useMemo(() => displayedTransactions.filter((transaction) => bulkSelection.selectedIdSet.has(transaction.id)), [bulkSelection.selectedIdSet, displayedTransactions]);
    const selectedTransactionsTotal = useMemo(() => selectedTransactions.reduce((sum, transaction) => sum + transaction.value, 0), [selectedTransactions]);

    const handleClearBulkSelection = () => {
        bulkSelection.clearSelection();
        setSelectionMode(false);
    };

    const handleOpenBulkEdit = () => {
        if (selectedTransactions.length < 1) {
            return;
        }

        openModal(<BulkTransactionEditModal transactions={selectedTransactions} context="invoice" onApplied={handleClearBulkSelection} />);
    };

    const handleRowClick = (transaction: Transaction) => {
        if (!selectionMode || !isTransactionEligibleForBulkEdit(transaction)) {
            return;
        }

        bulkSelection.toggleTransaction(transaction.id);
    };

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

    const headerTitle = `Fatura de ${invoiceMonthLabel}`;
    const forecastTotal = invoices.reduce((sum, invoice) => sum + (invoice.forecastAmount ?? 0), 0);

    const headerStatus = useMemo<ConsolidatedHeaderStatus>(() => {
        if (invoiceSnapshots.length < 1) {
            return "none";
        }
        if (invoiceSnapshots.every(({ invoice }) => invoice.totalAmount === 0) && invoiceSnapshots.some(({ invoice }) => (invoice.forecastAmount ?? 0) > 0)) return "forecast";

        return invoiceSnapshots[0].visualStatus;
    }, [invoiceSnapshots]);

    const canCreateCardSpending = cardById.size > 0;
    return (
        <div className="flex flex-col gap-3">
            <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                {forecastTotal > 0 && (
                    <p className="mb-3 text-xs text-sky-200">{formatCurrency(forecastTotal)} em cobranças previstas. Elas passam a consumir limite quando você confirma o lançamento.</p>
                )}
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">{headerTitle}</h1>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${HEADER_STATUS_BADGE_CLASS[headerStatus]}`}>
                            {HEADER_STATUS_LABELS[headerStatus]}
                        </span>
                    </div>
                </header>
            </section>

            <div className="relative w-full min-w-0">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
                />
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 xl:flex-row">
                <section className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#111111] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="flex flex-wrap items-center gap-3 ">
                            <p className="text-sm uppercase text-white/60">FATURA DE {invoiceMonthLabel}</p>
                            <span className="rounded-full border border-white/[0.05] bg-[#111111] px-2 py-0.5 text-xs text-white/40">
                                {sortedTransactionSnapshots.length} {sortedTransactionSnapshots.length === 1 ? "item encontrado" : "itens encontrados"}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="hidden flex-wrap items-center gap-1 sm:flex">
                                <TableColumnToggleButton label="STATUS" active={showStatus} onClick={() => toggleViewPreference("showStatus")} />
                                <TableColumnToggleButton label="DATA" active={showDate} onClick={() => toggleViewPreference("showDate")} />
                                <TableColumnToggleButton label="DESCRICAO" active={showDescription} onClick={() => toggleViewPreference("showDescription")} />
                                <TableColumnToggleButton label="CATEGORIA" active={showCategory} onClick={() => toggleViewPreference("showCategory")} />
                                <TableColumnToggleButton label="TAGS" active={showTags} onClick={() => toggleViewPreference("showTags")} />
                                <TableColumnToggleButton label="BENEFICIARIO" active={showBeneficiary} onClick={() => toggleViewPreference("showBeneficiary")} />
                                <TableColumnToggleButton label="VALOR" active={showValue} onClick={() => toggleViewPreference("showValue")} />
                            </div>
                        </div>
                    </div>

                    {sortedTransactionSnapshots.length < 1 ? (
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center text-sm text-white/55">
                            <p>Nenhuma compra encontrada para {invoiceMonthLabel}.</p>
                            {!canCreateCardSpending && <p className="mt-3 text-xs text-white/40">Cadastre um cartão para lançar gastos em fatura.</p>}
                        </div>
                    ) : (
                        <div className="elegant-scrollbar min-w-0 overflow-x-auto rounded-2xl pb-4">
                            <table className="w-full max-w-full table-fixed border-separate border-spacing-0 text-sm text-white/85">
                                <colgroup>
                                    {selectionMode && <col className="w-[4%]" />}
                                    {showStatus && <col className="w-[17%]" />}
                                    {showDate && <col className="w-[10%]" />}
                                    {showDescription && <col />}
                                    {showCategory && <col className="w-[14%]" />}
                                    {showTags && <col className="w-[10%]" />}
                                    {showBeneficiary && <col className="w-[13%]" />}
                                    {showValue && <col className="w-[12%]" />}
                                </colgroup>
                                <thead>
                                    <tr>
                                        {selectionMode && (
                                            <th className="border-b border-white/[0.08] px-3 py-2 text-left">
                                                <BulkHeaderCheckbox
                                                    checked={bulkSelection.allVisibleSelected}
                                                    indeterminate={bulkSelection.someVisibleSelected && !bulkSelection.allVisibleSelected}
                                                    disabled={bulkSelection.eligibleCount < 1}
                                                    onChange={bulkSelection.toggleAllVisible}
                                                />
                                            </th>
                                        )}
                                        {showStatus && <SortableHeader label="Status" field="status" sortMode={sortMode} onSortModeChange={setSortMode} />}
                                        {showDate && <SortableHeader label="Data" field="date" sortMode={sortMode} onSortModeChange={setSortMode} />}
                                        {showDescription && <SortableHeader label="Descrição" field="description" sortMode={sortMode} onSortModeChange={setSortMode} />}
                                        {showCategory && <SortableHeader label="Categoria" field="category" sortMode={sortMode} onSortModeChange={setSortMode} />}
                                        {showTags && (
                                            <th className="overflow-hidden whitespace-nowrap border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">
                                                Tags
                                            </th>
                                        )}
                                        {showBeneficiary && <SortableHeader label="Beneficiário" field="beneficiary" sortMode={sortMode} onSortModeChange={setSortMode} />}
                                        {showValue && <SortableHeader label="Valor" field="value" sortMode={sortMode} align="right" onSortModeChange={setSortMode} />}
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
                                        const visibleTags = transaction.tags.slice(0, 2);
                                        const hiddenTagsCount = Math.max(transaction.tags.length - visibleTags.length, 0);
                                        const canBulkEdit = isTransactionEligibleForBulkEdit(transaction);
                                        const isSelected = bulkSelection.selectedIdSet.has(transaction.id);

                                        return (
                                            <tr
                                                key={transaction.id}
                                                onClick={() => handleRowClick(transaction)}
                                                onContextMenu={(event) => handleRowContextMenu(event, transaction)}
                                                className={`${selectionMode && canBulkEdit ? "cursor-pointer" : "cursor-context-menu"} transition-colors odd:bg-white/[0.01] hover:bg-white/[0.04] ${
                                                    isSelected
                                                        ? "bg-emerald-500/[0.07] shadow-[inset_3px_0_0_rgba(110,231,183,0.65)]"
                                                        : contextMenu?.transactionId === transaction.id
                                                          ? "bg-white/[0.06]"
                                                          : ""
                                                }`}
                                            >
                                                {selectionMode && (
                                                    <td className="border-b border-white/[0.04] px-3 py-2.5">
                                                        <BulkRowCheckbox
                                                            checked={isSelected}
                                                            disabled={!canBulkEdit}
                                                            title={canBulkEdit ? "Selecionar transacao" : "Pagamentos de fatura nao podem ser editados em massa"}
                                                            onChange={() => bulkSelection.toggleTransaction(transaction.id)}
                                                        />
                                                    </td>
                                                )}
                                                {showStatus && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
                                                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
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
                                                                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${TRANSACTION_STATUS_BADGE_CLASS[transactionStatus]}`}
                                                                >
                                                                    {TRANSACTION_STATUS_LABELS[transactionStatus]}
                                                                </span>
                                                            ) : (
                                                                "--"
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {showDate && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                        {formatTransactionDate(transaction.date, "dd/MM/yyyy")}
                                                    </td>
                                                )}
                                                {showDescription && (
                                                    <td className="truncate border-b border-white/[0.04] px-3 py-2.5 text-[14px] font-medium text-white">
                                                        <div className="flex min-w-0 max-w-full items-center gap-1.5">
                                                            <span className="truncate">{transaction.description || "Sem descricao"}</span>
                                                            {seriesIndicator?.kind === "installment" && <span className="shrink-0 text-xs text-white/55">{seriesIndicator.label}</span>}
                                                            {seriesIndicator?.kind === "recurring" && (
                                                                <span className="inline-flex shrink-0 text-white/55" role="img" title="Transacao recorrente" aria-label="Transacao recorrente">
                                                                    <Repeat2 size={13} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {showCategory && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                        <div className="flex min-w-0 max-w-full items-center gap-2">
                                                            <span
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.1]"
                                                                style={{ color: categoryColor, backgroundColor: categoryBackground }}
                                                            >
                                                                <CategoryIcon size={16} />
                                                            </span>
                                                            <span className="truncate">{categoryLabel}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {showTags && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                        {visibleTags.length < 1 ? (
                                                            <span className="text-white/35">Sem tags</span>
                                                        ) : (
                                                            <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-hidden">
                                                                {visibleTags.map((tag) => (
                                                                    <span
                                                                        key={tag.id}
                                                                        className="min-w-0 max-w-[96px] truncate rounded-full border border-white/12 px-2 py-0.5 text-[11px]/4 font-medium uppercase text-white/75"
                                                                        style={{ backgroundColor: `${tag.color ?? "#64748B"}26` }}
                                                                    >
                                                                        {tag.name}
                                                                    </span>
                                                                ))}
                                                                {hiddenTagsCount > 0 && (
                                                                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/55">
                                                                        +{hiddenTagsCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {showBeneficiary && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5">
                                                        <div className="flex min-w-0 max-w-full items-center gap-2 text-white/70">
                                                            <BeneficiaryAvatar
                                                                beneficiary={{
                                                                    name: beneficiary?.name ?? transaction.beneficiary,
                                                                    avatarImage: beneficiary?.avatarImage ?? null,
                                                                    avatarColor: beneficiary?.avatarColor ?? "#374151",
                                                                }}
                                                            />
                                                            <span className="truncate">{beneficiary?.name ?? transaction.beneficiary}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {showValue && (
                                                    <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-right font-semibold text-red-400">
                                                        {formatCurrency(transaction.value)}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <FloatingTransactionBulkFooter
                                selectedCount={bulkSelection.selectedCount}
                                selectedAmount={formatCurrencyBRL(selectedTransactionsTotal)}
                                onEdit={handleOpenBulkEdit}
                                onClear={handleClearBulkSelection}
                            />
                            <TransactionContextMenu state={contextMenu} actions={contextActions} onSelect={handleSelectAction} onClose={() => setContextMenu(null)} />
                        </div>
                    )}
                </section>

                {summaryAside ? <div className="w-full lg:w-64 lg:shrink-0">{summaryAside}</div> : null}
            </div>
        </div>
    );
}
