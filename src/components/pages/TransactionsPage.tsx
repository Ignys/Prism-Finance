import { useEffect, useMemo, useState } from "react";
import { useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { getLocalTodayDate } from "../../lib/localDate";
import { AddTransactionModal } from "../modal/AddTransaction";
import { AddTransferModal } from "../modal/AddTransferModal";
import { useTransactionContextActionHandler } from "../transactions/useTransactionContextActionHandler";
import { TransactionsFiltersPanel } from "./transactions/TransactionsFiltersPanel";
import { TransactionsListPanel } from "./transactions/TransactionsListPanel";
import { TransactionsSummaryCards } from "./transactions/TransactionsSummaryCards";
import {
    INITIAL_FILTER_STATE,
    compareTransactions,
    getCurrentMonthKey,
    getTransactionCategoryKey,
    getTransactionCategoryLabel,
    getTransactionMonthKey,
    getTransactionSearchSource,
    hasActiveAdvancedFilters,
    parseNumberish,
    type SelectOption,
    type TagOption,
    type TransactionsFilterState,
    type TransactionsTabKey,
    type TransactionsSummary,
} from "./transactions/transactionsPageShared";

function resolveMonthStartDate(monthKey: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return getLocalTodayDate();
    }

    if (monthKey === getCurrentMonthKey()) {
        return getLocalTodayDate();
    }

    const month = Number(match[2]);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return getLocalTodayDate();
    }

    return `${match[1]}-${match[2]}-01`;
}

function resolveTransactionsTabFromPage(page: ReturnType<typeof usePage>["currentPage"]): TransactionsTabKey {
    if (page === "spending") return "spending";
    if (page === "transfer") return "transfer";
    return "income";
}

export function TransactionsPage() {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { openModal } = useModal();
    const handleTransactionContextAction = useTransactionContextActionHandler();
    const { consumePendingNavigation, currentPage, goToPage } = usePage();
    const [filters, setFilters] = useState<TransactionsFilterState>(INITIAL_FILTER_STATE);
    const [activeTab, setActiveTab] = useState<TransactionsTabKey>(() => resolveTransactionsTabFromPage(currentPage));

    useEffect(() => {
        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page === "transactions") {
            setActiveTab(pendingNavigation.tab);
            return;
        }

        setActiveTab(resolveTransactionsTabFromPage(currentPage));
    }, [consumePendingNavigation, currentPage]);

    const {
        selectedMonth,
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

    const nonCreditCardTransactions = useMemo(() => transactions.filter((transaction) => !(transaction.type === "spending" && transaction.paymentMethod === "credit_card")), [transactions]);

    const categoryOptions = useMemo<SelectOption[]>(() => {
        const categoryMap = new Map<string, string>();

        nonCreditCardTransactions.forEach((transaction) => {
            categoryMap.set(getTransactionCategoryKey(transaction), getTransactionCategoryLabel(transaction));
        });

        return Array.from(categoryMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    }, [nonCreditCardTransactions]);

    const tagOptions = useMemo<TagOption[]>(() => {
        const tagMap = new Map<string, TagOption>();

        nonCreditCardTransactions.forEach((transaction) => {
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
    }, [nonCreditCardTransactions]);

    const beneficiaryOptions = useMemo(() => {
        const beneficiaries = Array.from(new Set(nonCreditCardTransactions.map((transaction) => transaction.beneficiary.trim()).filter((beneficiary) => beneficiary.length > 0)));
        beneficiaries.sort((a, b) => a.localeCompare(b, "pt-BR"));
        return beneficiaries;
    }, [nonCreditCardTransactions]);

    const hasAdvancedFilters = hasActiveAdvancedFilters(filters);

    const advancedFilteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim() ? normalizeComparisonText(searchQuery) : "";
        const minValue = parseNumberish(minAmount);
        const maxValue = parseNumberish(maxAmount);

        return nonCreditCardTransactions.filter((transaction) => {
            if (selectedCategoryKey !== "all" && getTransactionCategoryKey(transaction) !== selectedCategoryKey) {
                return false;
            }

            const matchesSelectedWallet = transaction.inWallet === selectedWalletId || (transaction.type === "transfer" && transaction.destinationWalletId === selectedWalletId);

            if (selectedWalletId !== "all" && !matchesSelectedWallet) {
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
            const destinationWalletName = transaction.destinationWalletId ? (walletNameById.get(transaction.destinationWalletId) ?? "Carteira removida") : "Nenhuma carteira";
            return normalizeComparisonText(getTransactionSearchSource(transaction, walletName, destinationWalletName)).includes(normalizedSearch);
        });
    }, [dateFrom, dateTo, maxAmount, minAmount, searchQuery, selectedBeneficiary, selectedCategoryKey, selectedStatus, selectedTagIds, selectedWalletId, nonCreditCardTransactions, walletNameById]);

    const monthlyTransactions = useMemo(() => {
        const filtered = advancedFilteredTransactions.filter((transaction) => getTransactionMonthKey(transaction.date) === selectedMonth);
        filtered.sort((a, b) => compareTransactions(a, b, sortMode));
        return filtered;
    }, [advancedFilteredTransactions, selectedMonth, sortMode]);

    const incomeTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "income"), [monthlyTransactions]);
    const spendingTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "spending"), [monthlyTransactions]);
    const transferTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "transfer"), [monthlyTransactions]);

    const activeTabTransactions = useMemo(() => {
        if (activeTab === "spending") {
            return spendingTransactions;
        }

        if (activeTab === "transfer") {
            return transferTransactions;
        }

        return incomeTransactions;
    }, [activeTab, incomeTransactions, spendingTransactions, transferTransactions]);

    const summary = useMemo<TransactionsSummary>(() => {
        return activeTabTransactions.reduce(
            (acc, transaction) => {
                if (transaction.status === "paid") {
                    acc.paid.count += 1;
                    acc.paid.amount += transaction.value;
                    acc.total.count += 1;
                    acc.total.amount += transaction.value;
                }

                if (transaction.status === "pending") {
                    acc.pending.count += 1;
                    acc.pending.amount += transaction.value;
                    acc.total.count += 1;
                    acc.total.amount += transaction.value;
                }

                return acc;
            },
            {
                paid: { count: 0, amount: 0 },
                pending: { count: 0, amount: 0 },
                total: { count: 0, amount: 0 },
            },
        );
    }, [activeTabTransactions]);

    const handleCreateFromActiveTab = () => {
        if (activeTab === "transfer") {
            openModal(
                <AddTransferModal
                    prefill={{
                        initialDate: resolveMonthStartDate(selectedMonth),
                    }}
                />,
            );
            return;
        }

        openModal(
            <AddTransactionModal
                type={activeTab === "income" ? "income" : "spending"}
                prefill={{
                    initialDate: resolveMonthStartDate(selectedMonth),
                }}
            />,
        );
    };

    const handleTabChange = (tab: TransactionsTabKey) => {
        setActiveTab(tab);
        goToPage(tab);
    };

    return (
        <div className="w-full flex">
            <div className="flex flex-col gap-3 2xl:flex-row w-full">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <TransactionsFiltersPanel
                        activeTab={activeTab}
                        selectedMonth={selectedMonth}
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
                        categoryOptions={categoryOptions}
                        beneficiaryOptions={beneficiaryOptions}
                        tagOptions={tagOptions}
                        wallets={wallets}
                        hasAdvancedFilters={hasAdvancedFilters}
                        onTabChange={handleTabChange}
                        onToggleAdvancedFilters={toggleAdvancedFilters}
                        onClearAdvancedFilters={clearAdvancedFilters}
                        onMonthChange={(value) => setFilter("selectedMonth", value)}
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
                        onCreateFromActiveTab={handleCreateFromActiveTab}
                    />

                    <div className="flex flex-row w-full gap-2 shrink-0">
                        <TransactionsListPanel
                            activeTab={activeTab}
                            incomeTransactions={incomeTransactions}
                            spendingTransactions={spendingTransactions}
                            transferTransactions={transferTransactions}
                            wallets={wallets}
                            sortMode={sortMode}
                            onSortModeChange={(value) => setFilter("sortMode", value)}
                            onAction={handleTransactionContextAction}
                            selectedMonth={selectedMonth}
                        />
                        <div className="w-1/7">
                            <TransactionsSummaryCards activeTab={activeTab} summary={summary} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
