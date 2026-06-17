import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Circle, CircleSlash, Check, Pencil, Repeat2, Trash2 } from "lucide-react";
import { type Beneficiary, type Transaction, type Wallet, useFinanceBeneficiaries, useFinanceTransactionGroups } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { getTransactionCategoryDisplay, getTransactionCategoryDisplayLabel } from "../../../lib/transactionCategory";
import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsListPanelProps {
    activeTab: TransactionsTabKey;
    incomeTransactions: Transaction[];
    spendingTransactions: Transaction[];
    transferTransactions: Transaction[];
    wallets: Wallet[];
    selectedMonth?: string;
    sortMode: SortMode;
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
    selectedMonth?: string;
    tabs: TabConfig[];
    activeTab: TransactionsTabKey;
    wallets: Wallet[];
    beneficiariesById: Map<string, Beneficiary>;
    transactionGroupsById: Map<string, FinanceTransactionGroup>;
    sortMode: SortMode;
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

function WalletTableCell({ wallet }: { wallet: Wallet }) {
    return (
        <div className="flex min-w-0 max-w-full items-center gap-2 whitespace-nowrap">
            <WalletAvatar wallet={wallet} className="h-8 w-8 rounded-md border border-white/[0.1]" iconSize={16} iconStrokeWidth={1.8} />
            <span className="truncate text-white/75">{wallet.name}</span>
        </div>
    );
}

function NoDestinationWalletCell() {
    return (
        <div className="flex min-w-0 max-w-full items-center gap-2 whitespace-nowrap text-white/55">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.03]">
                <CircleSlash size={15} />
            </span>
            <span className="truncate">Nenhuma carteira</span>
        </div>
    );
}

function TableControlButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <span
            onClick={onClick}
            className={`${active ? "bg-neutral-600/30 border-neutral-100/[0.2] text-white/70" : "bg-white/[0.03] text-white/30 border-white/[0.1]"} rounded-lg border px-2.5 py-1 text-xs select-none hover:cursor-pointer transition-colors`}
        >
            {label}
        </span>
    );
}

function TransactionsTable({
    tabs,
    activeTab,
    wallets,
    beneficiariesById,
    transactionGroupsById,
    sortMode,
    onSortModeChange,
    onEdit,
    onConfirmPayment,
    onDelete,
    selectedMonth,
}: TransactionsTableProps) {
    const activeTabConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
    const transactions = activeTabConfig?.transactions ?? [];

    const [showStatus, setShowStatus] = useState(true);
    const [showDate, setShowDate] = useState(true);
    const [showDescription, setShowDescription] = useState(true);
    const [showCategory, setShowCategory] = useState(true);
    const [showTags, setShowTags] = useState(true);
    const [showBeneficiary, setShowBeneficiary] = useState(true);
    const [showValue, setShowValue] = useState(true);
    const [showActions, setShowActions] = useState(true);

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] ">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3.5 flex-wrap">
                    <h2 className="text-sm uppercase text-white/60">
                        {activeTabConfig.label} de {format(new Date(selectedMonth || new Date()), "MMMM 'de' yyyy", { locale: ptBR })}
                    </h2>
                    <span className="rounded-full px-2 py-0.5 text-xs border border-white/[0.05] bg-[#111111] text-white/40">
                        {transactions.length} {transactions.length === 1 ? "item encontrado" : "itens encontrados"}
                    </span>
                </div>
                <div className="flex gap-2">
                    <div className="hidden sm:flex items-center gap-1 flex-wrap">
                        <TableControlButton label="STATUS" active={showStatus} onClick={() => setShowStatus(!showStatus)} />
                        <TableControlButton label="DATA" active={showDate} onClick={() => setShowDate(!showDate)} />
                        <TableControlButton label="DESCRIÇÃO" active={showDescription} onClick={() => setShowDescription(!showDescription)} />
                        <TableControlButton label="CATEGORIA" active={showCategory} onClick={() => setShowCategory(!showCategory)} />
                        <TableControlButton label="TAGS" active={showTags} onClick={() => setShowTags(!showTags)} />
                        <TableControlButton label="BENEFICIÁRIO" active={showBeneficiary} onClick={() => setShowBeneficiary(!showBeneficiary)} />
                        <TableControlButton label="VALOR" active={showValue} onClick={() => setShowValue(!showValue)} />
                        <TableControlButton label="AÇÕES" active={showActions} onClick={() => setShowActions(!showActions)} />
                    </div>
                </div>
            </div>

            {transactions.length < 1 ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center text-sm text-white/55">{activeTabConfig.emptyMessage}</div>
            ) : (
                <div className="elegant-scrollbar overflow-x-auto">
                    <table className="min-w-[1280px] w-full table-fixed border-separate border-spacing-0 text-sm text-white/85">
                        <colgroup>
                            {showStatus && <col className="w-[172px]" />}
                            {showDate && <col className="w-[116px]" />}
                            {showDescription && <col />}
                            {showCategory && <col className="w-[180px]" />}
                            {showTags && <col className="w-[130px]" />}
                            {showBeneficiary && <col className="w-[135px]" />}
                            {showValue && <col className="w-[120px] border-2 border-white" />}
                            {showActions && <col className="w-[130px]" />}
                        </colgroup>
                        <thead>
                            <tr>
                                {showStatus && <SortableHeader label="Status" field="status" sortMode={sortMode} onSortModeChange={onSortModeChange} />}
                                {showDate && <SortableHeader label="Data" field="date" sortMode={sortMode} onSortModeChange={onSortModeChange} />}
                                {showDescription && (
                                    <th className="overflow-hidden whitespace-nowrap border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">
                                        Descrição
                                    </th>
                                )}
                                {showCategory && <SortableHeader label={activeTab === "transfer" ? "Origem" : "Categoria"} field="category" sortMode={sortMode} onSortModeChange={onSortModeChange} />}
                                {showTags && (
                                    <th className="overflow-hidden whitespace-nowrap border-b border-white/[0.08] px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-white/45">Tags</th>
                                )}
                                {showBeneficiary && (
                                    <SortableHeader label={activeTab === "transfer" ? "Destino" : "Beneficiário"} field="beneficiary" sortMode={sortMode} onSortModeChange={onSortModeChange} />
                                )}
                                {showValue && <SortableHeader label="Valor" field="value" sortMode={sortMode} align="right" onSortModeChange={onSortModeChange} />}
                                {showActions && (
                                    <th className="overflow-hidden whitespace-nowrap border-b border-white/[0.08] px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em] text-white/45">Ações</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((transaction) => {
                                const group = transactionGroupsById.get(transaction.groupId);
                                const seriesIndicator = resolveTransactionSeriesIndicator(transaction, group);
                                const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
                                const destinationWallet = transaction.destinationWalletId ? resolveTransactionWallet(wallets, transaction.destinationWalletId) : null;
                                const typeMeta = getTransactionTypeMeta(transaction.type);
                                const categoryDisplay = getTransactionCategoryDisplay(transaction.category);
                                const CategoryIcon = getCategoryIconComponent(categoryDisplay.icon, categoryDisplay.type);
                                const categoryColor = categoryDisplay.color ?? "#9CA3AF";
                                const categoryBackground = `${categoryColor}22`;
                                const beneficiary = transaction.beneficiaryId ? beneficiariesById.get(transaction.beneficiaryId) : null;
                                const visibleTags = transaction.tags.slice(0, 2);
                                const hiddenTagsCount = Math.max(transaction.tags.length - visibleTags.length, 0);

                                return (
                                    <tr key={transaction.id} className="odd:bg-white/[0.01]">
                                        {showStatus && (
                                            <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5">
                                                <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <WalletAvatar wallet={wallet} className="h-8 w-8 rounded-md border border-white/[0.1]" iconSize={16} iconStrokeWidth={1.8} />
                                                    </div>
                                                    <span
                                                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]/4 uppercase tracking-[0.08em] ${STATUS_BADGE_CLASS[transaction.status]}`}
                                                    >
                                                        {STATUS_LABELS[transaction.status]}
                                                    </span>
                                                    {seriesIndicator?.kind === "installment" && <span className="text-xs text-white/55">{seriesIndicator.label}</span>}
                                                    {seriesIndicator?.kind === "recurring" && (
                                                        <span className={`inline-flex`} role="img" title="Transacao recorrente" aria-label="Transacao recorrente">
                                                            <Repeat2 strokeWidth={2} size={15} />
                                                        </span>
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
                                                    <span className="truncate">{transaction.description || "Sem descrição."}</span>
                                                </div>
                                            </td>
                                        )}
                                        {showCategory && (
                                            <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                {transaction.type === "transfer" ? (
                                                    <WalletTableCell wallet={wallet} />
                                                ) : (
                                                    <div className="flex min-w-0 max-w-full items-center gap-2">
                                                        <span
                                                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.1]"
                                                            style={{ color: categoryColor, backgroundColor: categoryBackground }}
                                                        >
                                                            <CategoryIcon size={16} />
                                                        </span>
                                                        <span className="truncate">{getTransactionCategoryDisplayLabel(transaction.category)}</span>
                                                    </div>
                                                )}
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
                                            <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/70">
                                                {transaction.type === "transfer" ? (
                                                    destinationWallet ? (
                                                        <WalletTableCell wallet={destinationWallet} />
                                                    ) : (
                                                        <NoDestinationWalletCell />
                                                    )
                                                ) : (
                                                    <div className="flex min-w-0 max-w-full items-center gap-2 text-white/70">
                                                        <BeneficiaryAvatar
                                                            beneficiary={{
                                                                name: beneficiary?.name ?? "BeneficiÃ¡rio",
                                                                avatarImage: beneficiary?.avatarImage ?? null,
                                                                avatarColor: beneficiary?.avatarColor ?? "#374151",
                                                            }}
                                                        />
                                                        <span className="truncate">{beneficiary?.name?.split(" ")?.[0] ?? ""}</span>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                        {showValue && (
                                            <td className={`overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-right font-semibold ${typeMeta.amountColorClass}`}>
                                                R$ {formatCurrencyBRL(transaction.value)}
                                            </td>
                                        )}
                                        {showActions && (
                                            <td className="overflow-hidden whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5">
                                                <div className="flex justify-end gap-1 whitespace-nowrap">
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
                                                        aria-label="Editar transação"
                                                        title="Editar transação"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(transaction)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100"
                                                        aria-label="Excluir transação"
                                                        title="Excluir transação"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
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
    onSortModeChange,
    onEdit,
    onConfirmPayment,
    onDelete,
    selectedMonth,
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
                emptyMessage: "Nenhuma receita neste mês para os filtros selecionados.",
            },
            {
                key: "spending",
                label: "Despesas",
                transactions: spendingTransactions,
                emptyMessage: "Nenhuma despesa neste mês para os filtros selecionados.",
            },
            {
                key: "transfer",
                label: "Transferências",
                transactions: transferTransactions,
                emptyMessage: "Nenhuma transferência neste mês para os filtros selecionados.",
            },
        ],
        [incomeTransactions, spendingTransactions, transferTransactions],
    );

    return (
        <div className="flex flex-col gap-3 w-full">
            <TransactionsTable
                tabs={tabs}
                activeTab={activeTab}
                selectedMonth={selectedMonth}
                wallets={wallets}
                beneficiariesById={beneficiariesById}
                transactionGroupsById={transactionGroupsById}
                sortMode={sortMode}
                onSortModeChange={onSortModeChange}
                onEdit={onEdit}
                onConfirmPayment={onConfirmPayment}
                onDelete={onDelete}
            />
        </div>
    );
}
