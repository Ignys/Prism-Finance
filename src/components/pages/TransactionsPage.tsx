import { useMemo, useState } from "react";
import { type Transaction, useFinanceActions, useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { AuthShell } from "../layout/AuthShell";
import { EditTransaction } from "../modal/EditTransaction";
import { TransactionsFiltersPanel } from "./transactions/TransactionsFiltersPanel";
import { TransactionsListPanel } from "./transactions/TransactionsListPanel";
import { TransactionsSummaryCards } from "./transactions/TransactionsSummaryCards";
import {
    INITIAL_FILTER_STATE,
    compareTransactions,
    getTransactionCategoryKey,
    getTransactionCategoryLabel,
    getTransactionSearchSource,
    hasActiveAdvancedFilters,
    parseNumberish,
    type QuickTypeFilter,
    type SelectOption,
    type TagOption,
    type TransactionsFilterState,
    type TransactionsSummary,
} from "./transactions/transactionsPageShared";

export function TransactionsPage() {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { deleteTransaction } = useFinanceActions();
    const { openModal } = useModal();
    const [filters, setFilters] = useState<TransactionsFilterState>(INITIAL_FILTER_STATE);

    const {
        quickFilter,
        sortMode,
        showAdvancedFilters,
        searchQuery,
        selectedCategoryKey,
        selectedWalletId,
        selectedBeneficiary,
        selectedStatus,
        selectedTagIds,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
    } = filters;

    const setFilter = <K extends keyof TransactionsFilterState>(key: K, value: TransactionsFilterState[K]) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const toggleAdvancedFilters = () => {
        setFilters((current) => ({ ...current, showAdvancedFilters: !current.showAdvancedFilters }));
    };

    const toggleTagFilter = (tagId: string) => {
        setFilters((current) => ({
            ...current,
            selectedTagIds: current.selectedTagIds.includes(tagId) ? current.selectedTagIds.filter((id) => id !== tagId) : [...current.selectedTagIds, tagId],
        }));
    };

    const clearAdvancedFilters = () => {
        setFilters((current) => ({
            ...current,
            searchQuery: "",
            selectedCategoryKey: "all",
            selectedWalletId: "all",
            selectedBeneficiary: "all",
            selectedStatus: "all",
            selectedTagIds: [],
            dateFrom: "",
            dateTo: "",
            minAmount: "",
            maxAmount: "",
        }));
    };

    const walletNameById = useMemo(() => {
        const next = new Map<string, string>();
        wallets.forEach((wallet) => next.set(wallet.id, wallet.name));
        return next;
    }, [wallets]);

    const quickFilterCounts = useMemo<Record<QuickTypeFilter, number>>(() => {
        return transactions.reduce(
            (acc, transaction) => {
                acc.all += 1;
                if (transaction.type === "income") {
                    acc.income += 1;
                }
                if (transaction.type === "spending") {
                    acc.spending += 1;
                }
                return acc;
            },
            { all: 0, income: 0, spending: 0 },
        );
    }, [transactions]);

    const categoryOptions = useMemo<SelectOption[]>(() => {
        const categoryMap = new Map<string, string>();

        transactions.forEach((transaction) => {
            categoryMap.set(getTransactionCategoryKey(transaction), getTransactionCategoryLabel(transaction));
        });

        return Array.from(categoryMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    }, [transactions]);

    const tagOptions = useMemo<TagOption[]>(() => {
        const tagMap = new Map<string, TagOption>();

        transactions.forEach((transaction) => {
            transaction.tags.forEach((tag) => {
                if (!tagMap.has(tag.id)) {
                    tagMap.set(tag.id, {
                        id: tag.id,
                        name: tag.name,
                        color: tag.color,
                    });
                }
            });
        });

        return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [transactions]);

    const beneficiaryOptions = useMemo(() => {
        const beneficiaries = Array.from(new Set(transactions.map((transaction) => transaction.beneficiary.trim()).filter((beneficiary) => beneficiary.length > 0)));
        beneficiaries.sort((a, b) => a.localeCompare(b, "pt-BR"));
        return beneficiaries;
    }, [transactions]);

    const hasAdvancedFilters = hasActiveAdvancedFilters(filters);

    const filteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim() ? normalizeComparisonText(searchQuery) : "";
        const minValue = parseNumberish(minAmount);
        const maxValue = parseNumberish(maxAmount);

        const filtered = transactions.filter((transaction) => {
            if (quickFilter !== "all" && transaction.type !== quickFilter) {
                return false;
            }

            if (selectedCategoryKey !== "all" && getTransactionCategoryKey(transaction) !== selectedCategoryKey) {
                return false;
            }

            if (selectedWalletId !== "all" && transaction.inWallet !== selectedWalletId) {
                return false;
            }

            if (selectedBeneficiary !== "all" && transaction.beneficiary !== selectedBeneficiary) {
                return false;
            }

            if (selectedStatus !== "all" && transaction.status !== selectedStatus) {
                return false;
            }

            if (selectedTagIds.length > 0 && !selectedTagIds.some((tagId) => transaction.tagIds.includes(tagId))) {
                return false;
            }

            if (dateFrom && transaction.date < dateFrom) {
                return false;
            }

            if (dateTo && transaction.date > dateTo) {
                return false;
            }

            if (minValue !== null && transaction.value < minValue) {
                return false;
            }

            if (maxValue !== null && transaction.value > maxValue) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const walletName = walletNameById.get(transaction.inWallet) ?? "Carteira removida";
            return normalizeComparisonText(getTransactionSearchSource(transaction, walletName)).includes(normalizedSearch);
        });

        filtered.sort((a, b) => compareTransactions(a, b, sortMode));
        return filtered;
    }, [
        dateFrom,
        dateTo,
        maxAmount,
        minAmount,
        quickFilter,
        searchQuery,
        selectedBeneficiary,
        selectedCategoryKey,
        selectedStatus,
        selectedTagIds,
        selectedWalletId,
        sortMode,
        transactions,
        walletNameById,
    ]);

    const summary = useMemo<TransactionsSummary>(() => {
        return filteredTransactions.reduce(
            (acc, transaction) => {
                acc.count += 1;
                if (transaction.type === "income") {
                    acc.income += transaction.value;
                } else if (transaction.type === "spending") {
                    acc.spending += transaction.value;
                } else {
                    acc.transfer += transaction.value;
                }

                if (transaction.status === "pending") {
                    acc.pending += transaction.value;
                }

                return acc;
            },
            { count: 0, income: 0, spending: 0, transfer: 0, pending: 0 },
        );
    }, [filteredTransactions]);

    const handleEditTransaction = (transaction: Transaction) => {
        openModal(<EditTransaction transaction={transaction} />);
    };

    const handleDeleteTransaction = (transaction: Transaction) => {
        void deleteTransaction(transaction);
    };

    return (
        <AuthShell mainClassName="text-white">
            <div className="flex gap-2 px-8 mb-10">
                <div className="w-3/6 flex flex-col gap-3">
                    <TransactionsFiltersPanel
                        quickFilter={quickFilter}
                        sortMode={sortMode}
                        showAdvancedFilters={showAdvancedFilters}
                        searchQuery={searchQuery}
                        selectedCategoryKey={selectedCategoryKey}
                        selectedWalletId={selectedWalletId}
                        selectedBeneficiary={selectedBeneficiary}
                        selectedStatus={selectedStatus}
                        selectedTagIds={selectedTagIds}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        minAmount={minAmount}
                        maxAmount={maxAmount}
                        quickFilterCounts={quickFilterCounts}
                        categoryOptions={categoryOptions}
                        beneficiaryOptions={beneficiaryOptions}
                        tagOptions={tagOptions}
                        wallets={wallets}
                        hasAdvancedFilters={hasAdvancedFilters}
                        onToggleAdvancedFilters={toggleAdvancedFilters}
                        onClearAdvancedFilters={clearAdvancedFilters}
                        onQuickFilterChange={(value) => setFilter("quickFilter", value)}
                        onSortModeChange={(value) => setFilter("sortMode", value)}
                        onSearchQueryChange={(value) => setFilter("searchQuery", value)}
                        onCategoryChange={(value) => setFilter("selectedCategoryKey", value)}
                        onWalletChange={(value) => setFilter("selectedWalletId", value)}
                        onBeneficiaryChange={(value) => setFilter("selectedBeneficiary", value)}
                        onStatusChange={(value) => setFilter("selectedStatus", value)}
                        onDateFromChange={(value) => setFilter("dateFrom", value)}
                        onDateToChange={(value) => setFilter("dateTo", value)}
                        onMinAmountChange={(value) => setFilter("minAmount", value)}
                        onMaxAmountChange={(value) => setFilter("maxAmount", value)}
                        onTagToggle={toggleTagFilter}
                    />
                    <TransactionsListPanel transactions={filteredTransactions} wallets={wallets} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction} />
                </div>
                <TransactionsSummaryCards summary={summary} />
            </div>
        </AuthShell>
    );
}
