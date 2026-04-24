import { useMemo } from "react";
import { ArrowDown, ArrowUp, Circle, Check, Pencil, Repeat2, Trash2 } from "lucide-react";
import { type Beneficiary, type Transaction, type Wallet, useFinanceBeneficiaries, useFinanceTransactionGroups } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { WalletAvatar } from "../../common/WalletAvatar";
import { formatCurrencyBRL, formatTransactionDate, getTransactionTypeMeta, resolveTransactionWallet } from "../../transactions/transactionView";
import {
    buildSortMode,
    getSortDirection,
    getSortField,
    SORT_DEFAULT_DIRECTION,
    STATUS_BADGE_CLASS,
    STATUS_LABELS,
    type SortField,
    type SortMode,
    type TransactionsTabKey,
} from "./transactionsPageShared";

interface TransactionsListPanelProps {
    activeTab: TransactionsTabKey;
    incomeTransactions: Transaction[];
    spendingTransactions: Transaction[];
    transferTransactions: Transaction[];
    wallets: Wallet[];
    sortMode: SortMode;
    onTabChange: (tab: TransactionsTabKey) => void;
    onSortModeChange: (sortMode: SortMode) => void;
    onEdit: (transaction: Transaction) => void;
    onConfirmPayment: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
}

interface TabConfig {
    key: TransactionsTabKey;
    label: string;
    transactions: Transaction[];
    emptyMessage: string;
}

interface TransactionsTableProps {
    tabs: TabConfig[];
    activeTab: TransactionsTabKey;
    wallets: Wallet[];
    beneficiariesById: Map<string, Beneficiary>;
    transactionGroupsById: Map<string, FinanceTransactionGroup>;
    sortMode: SortMode;
    onTabChange: (tab: TransactionsTabKey) => void;
    onSortModeChange: (sortMode: SortMode) => void;
    onEdit: (transaction: Transaction) => void;
    onConfirmPayment: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
}

interface SortableHeaderProps {
    label: string;
    field: SortField;
    sortMode: SortMode;
    align?: "left" | "right";
    onSortModeChange: (sortMode: SortMode) => void;
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

function getAriaSort(field: SortField, sortMode: SortMode): "ascending" | "descending" | "none" {
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

function TransactionsTable({
    tabs,
    activeTab,
    wallets,
    beneficiariesById,
    transactionGroupsById,
    sortMode,
    onTabChange,
    onSortModeChange,
    onEdit,
    onConfirmPayment,
    onDelete,
}: TransactionsTableProps) {
    const activeTabConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
    const transactions = activeTabConfig?.transactions ?? [];

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-3 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-end gap-2 overflow-x-auto pb-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onTabChange(tab.key)}
                            className={`rounded-full border px-5 py-2 text-xs font-base uppercase tracking-[0.08em] transition-colors ${
                                activeTab === tab.key
                                    ? "border-white/[0.24] bg-white/[0.08] text-white"
                                    : "border-white/[0.1] bg-white/[0.03] text-white/60 hover:border-white/[0.2] hover:text-white/85"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-xs text-white/60">{transactions.length} itens</span>
            </div>

            {transactions.length < 1 ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center text-sm text-white/55">{activeTabConfig.emptyMessage}</div>
            ) : (
                <div>
                    <table className="w-full border-separate border-spacing-0 text-sm text-white/85">
                        <thead>
                            <tr>
                                <SortableHeader label="Status" field="status" sortMode={sortMode} onSortModeChange={onSortModeChange} />
                                <SortableHeader label="Data" field="date" sortMode={sortMode} onSortModeChange={onSortModeChange} />
                                <th className="border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">Descrição</th>
                                <SortableHeader label="Categoria" field="category" sortMode={sortMode} onSortModeChange={onSortModeChange} />
                                <th className="border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">Tags</th>
                                <SortableHeader label="Beneficiário" field="beneficiary" sortMode={sortMode} onSortModeChange={onSortModeChange} />
                                <SortableHeader label="Valor" field="value" sortMode={sortMode} align="right" onSortModeChange={onSortModeChange} />
                                <th className="border-b border-white/[0.08] px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em] text-white/45">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((transaction) => {
                                const group = transactionGroupsById.get(transaction.groupId);
                                const seriesIndicator = resolveTransactionSeriesIndicator(transaction, group);
                                const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
                                const typeMeta = getTransactionTypeMeta(transaction.type);
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
                                        <td className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <WalletAvatar wallet={wallet} className="h-8 w-8 rounded-md border border-white/[0.1]" iconSize={16} iconStrokeWidth={1.8} />
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]/4 uppercase tracking-[0.08em] ${STATUS_BADGE_CLASS[transaction.status]}`}
                                            >
                                                {STATUS_LABELS[transaction.status]}
                                            </span>
                                            {seriesIndicator?.kind === "installment" && <span className="text-xs text-white/55">{seriesIndicator.label}</span>}
                                            {seriesIndicator?.kind === "recurring" && (
                                                <span className={`inline-flex`} role="img" title="Transacao recorrente" aria-label="Transacao recorrente">
                                                    <Repeat2 strokeWidth={2} size={15} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-white/70">{formatTransactionDate(transaction.date, "dd/MM/yyyy")}</td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5 text-[14px] font-medium text-white">
                                            <div className="inline-flex items-center gap-1.5">
                                                <span>{transaction.description || "Sem descricao"}</span>
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
                                                <span>{getCategoryDisplayLabel(transaction)}</span>
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
                                                            className="uppercase rounded-full border border-white/12 px-2 py-0.5 text-[11px]/4 font-medium text-white/75"
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
                                            <div className="flex items-center text-white/70 gap-2">
                                                <span className="inline-flex h-7 w-7 items-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.03]">
                                                    {beneficiaryAvatarImage ? (
                                                        <img src={beneficiaryAvatarImage} alt={beneficiary?.name ?? "Beneficiario"} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="block h-full w-full" style={{ backgroundColor: beneficiary ? beneficiaryAvatarColor : "#374151" }} aria-hidden="true" />
                                                    )}
                                                </span>
                                                <span>{beneficiary?.name ?? "Beneficiário"}</span>
                                            </div>
                                        </td>
                                        <td className={`border-b border-white/[0.04] px-3 py-2.5 text-right font-semibold ${typeMeta.amountColorClass}`}>R$ {formatCurrencyBRL(transaction.value)}</td>
                                        <td className="border-b border-white/[0.04] px-3 py-2.5">
                                            <div className="flex justify-end gap-1">
                                                {transaction.status === "pending" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onConfirmPayment(transaction)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/10 text-emerald-200 transition-colors hover:border-emerald-400/45 hover:text-emerald-100"
                                                        aria-label="Confirmar pagamento"
                                                        title="Confirmar pagamento"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}
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
                </div>
            )}
        </section>
    );
}

export function TransactionsListPanel({
    activeTab,
    incomeTransactions,
    spendingTransactions,
    transferTransactions,
    wallets,
    sortMode,
    onTabChange,
    onSortModeChange,
    onEdit,
    onConfirmPayment,
    onDelete,
}: TransactionsListPanelProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const transactionGroups = useFinanceTransactionGroups();

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

    const tabs = useMemo<TabConfig[]>(
        () => [
            {
                key: "income",
                label: "Receitas",
                transactions: incomeTransactions,
                emptyMessage: "Nenhuma receita neste mes para os filtros selecionados.",
            },
            {
                key: "spending",
                label: "Despesas",
                transactions: spendingTransactions,
                emptyMessage: "Nenhuma despesa neste mes para os filtros selecionados.",
            },
            {
                key: "transfer",
                label: "Transferências",
                transactions: transferTransactions,
                emptyMessage: "Nenhuma transferencia neste mes para os filtros selecionados.",
            },
        ],
        [incomeTransactions, spendingTransactions, transferTransactions],
    );

    return (
        <div className="flex flex-col gap-3">
            <TransactionsTable
                tabs={tabs}
                activeTab={activeTab}
                wallets={wallets}
                beneficiariesById={beneficiariesById}
                transactionGroupsById={transactionGroupsById}
                sortMode={sortMode}
                onTabChange={onTabChange}
                onSortModeChange={onSortModeChange}
                onEdit={onEdit}
                onConfirmPayment={onConfirmPayment}
                onDelete={onDelete}
            />
        </div>
    );
}
