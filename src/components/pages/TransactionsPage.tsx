import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { useFinanceSession, useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { useLocalPreferenceSection } from "../../lib/localPreferences";
import { getLocalTodayDate } from "../../lib/localDate";
import { AddTransactionModal } from "../modal/AddTransaction";
import { AddTransferModal } from "../modal/AddTransferModal";
import { EditTransaction } from "../modal/EditTransaction";
import { useTransactionContextActionHandler } from "../transactions/useTransactionContextActionHandler";
import { TransactionsFiltersPanel } from "./transactions/TransactionsFiltersPanel";
import { TransactionsListPanel } from "./transactions/TransactionsListPanel";
import { TransactionsOverviewPanel } from "./transactions/TransactionsOverviewPanel";
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

interface TransactionsPagePreferences {
    activeTab: TransactionsTabKey;
    filters: TransactionsFilterState;
}

const TRANSACTIONS_PAGE_PREFERENCES_SECTION = "transactions";
const DEFAULT_TRANSACTIONS_PAGE_PREFERENCES: TransactionsPagePreferences = {
    activeTab: "income",
    filters: INITIAL_FILTER_STATE,
};
const VALID_TRANSACTION_TABS = new Set<TransactionsTabKey>(["income", "spending", "transfer"]);
const VALID_TRANSACTION_STATUS_FILTERS = new Set<TransactionsFilterState["selectedStatus"]>(["all", "pending", "paid", "cancelled", "skipped"]);
const VALID_TRANSACTION_DATE_MODES = new Set<TransactionsFilterState["dateMode"]>(["month", "period"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeTransactionsFilterState(value: unknown): TransactionsFilterState {
    if (!isRecord(value)) {
        return INITIAL_FILTER_STATE;
    }

    const sortMode = asString(value.sortMode, INITIAL_FILTER_STATE.sortMode);
    const selectedStatus = asString(value.selectedStatus, INITIAL_FILTER_STATE.selectedStatus) as TransactionsFilterState["selectedStatus"];
    const dateMode = asString(value.dateMode, INITIAL_FILTER_STATE.dateMode) as TransactionsFilterState["dateMode"];

    return {
        selectedMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(asString(value.selectedMonth, "")) ? asString(value.selectedMonth, INITIAL_FILTER_STATE.selectedMonth) : INITIAL_FILTER_STATE.selectedMonth,
        dateMode: VALID_TRANSACTION_DATE_MODES.has(dateMode) ? dateMode : INITIAL_FILTER_STATE.dateMode,
        sortMode: /^(date|value|status|category|beneficiary)-(asc|desc)$/.test(sortMode) ? (sortMode as TransactionsFilterState["sortMode"]) : INITIAL_FILTER_STATE.sortMode,
        showAdvancedFilters: typeof value.showAdvancedFilters === "boolean" ? value.showAdvancedFilters : INITIAL_FILTER_STATE.showAdvancedFilters,
        searchQuery: asString(value.searchQuery, INITIAL_FILTER_STATE.searchQuery),
        selectedCategoryKey: asString(value.selectedCategoryKey, INITIAL_FILTER_STATE.selectedCategoryKey),
        selectedWalletIds: asStringArray(value.selectedWalletIds),
        selectedBeneficiary: asString(value.selectedBeneficiary, INITIAL_FILTER_STATE.selectedBeneficiary),
        selectedStatus: VALID_TRANSACTION_STATUS_FILTERS.has(selectedStatus) ? selectedStatus : INITIAL_FILTER_STATE.selectedStatus,
        selectedTagIds: asStringArray(value.selectedTagIds),
        dateFrom: asString(value.dateFrom, INITIAL_FILTER_STATE.dateFrom),
        dateTo: asString(value.dateTo, INITIAL_FILTER_STATE.dateTo),
        minAmount: asString(value.minAmount, INITIAL_FILTER_STATE.minAmount),
        maxAmount: asString(value.maxAmount, INITIAL_FILTER_STATE.maxAmount),
    };
}

function normalizeTransactionsPagePreferences(value: unknown): TransactionsPagePreferences {
    if (!isRecord(value)) {
        return DEFAULT_TRANSACTIONS_PAGE_PREFERENCES;
    }

    const activeTab = asString(value.activeTab, DEFAULT_TRANSACTIONS_PAGE_PREFERENCES.activeTab) as TransactionsTabKey;
    return {
        activeTab: VALID_TRANSACTION_TABS.has(activeTab) ? activeTab : DEFAULT_TRANSACTIONS_PAGE_PREFERENCES.activeTab,
        filters: normalizeTransactionsFilterState(value.filters),
    };
}

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
    const { user } = useFinanceSession();
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { openModal } = useModal();
    const handleTransactionContextAction = useTransactionContextActionHandler();
    const { consumePendingNavigation, currentPage, goToPage } = usePage();
    const [pagePreferences, setPagePreferences] = useLocalPreferenceSection(
        user?.uid,
        TRANSACTIONS_PAGE_PREFERENCES_SECTION,
        DEFAULT_TRANSACTIONS_PAGE_PREFERENCES,
        normalizeTransactionsPagePreferences,
    );
    const [pendingOpenTransactionId, setPendingOpenTransactionId] = useState<string | null>(null);
    const { activeTab, filters } = pagePreferences;

    const setFilters = (nextFiltersAction: SetStateAction<TransactionsFilterState>) => {
        setPagePreferences((current) => {
            const nextFilters = typeof nextFiltersAction === "function" ? (nextFiltersAction as (currentFilters: TransactionsFilterState) => TransactionsFilterState)(current.filters) : nextFiltersAction;
            return {
                ...current,
                filters: nextFilters,
            };
        });
    };

    useEffect(() => {
        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page === "transactions") {
            setPagePreferences((current) => ({
                ...current,
                activeTab: pendingNavigation.tab,
                filters: {
                    ...current.filters,
                    selectedMonth: pendingNavigation.selectedMonth ?? current.filters.selectedMonth,
                    dateMode: "month",
                },
            }));
            setPendingOpenTransactionId(pendingNavigation.targetTransactionId ?? null);
            return;
        }

        if (currentPage === "transactions") {
            return;
        }

        setPagePreferences((current) => ({
            ...current,
            activeTab: resolveTransactionsTabFromPage(currentPage),
        }));
    }, [consumePendingNavigation, currentPage, setPagePreferences]);

    useEffect(() => {
        if (!pendingOpenTransactionId) {
            return;
        }

        const transaction = transactions.find((item) => item.id === pendingOpenTransactionId);
        if (!transaction) {
            return;
        }

        setFilters((current) => ({
            ...current,
            selectedMonth: getTransactionMonthKey(transaction.date),
        }));
        setPendingOpenTransactionId(null);
        openModal(<EditTransaction transaction={transaction} />);
    }, [openModal, pendingOpenTransactionId, transactions]);

    const {
        selectedMonth,
        dateMode,
        sortMode,
        showAdvancedFilters,
        searchQuery,
        selectedCategoryKey,
        selectedWalletIds,
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
            selectedBeneficiary: "all",
            selectedStatus: "all",
            selectedTagIds: [],
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

    useEffect(() => {
        const validWalletIds = new Set(wallets.map((wallet) => wallet.id));
        const validCategoryKeys = new Set(categoryOptions.map((option) => option.value));
        const validBeneficiaries = new Set(beneficiaryOptions);
        const validTagIds = new Set(tagOptions.map((tag) => tag.id));

        setPagePreferences((current) => {
            const nextFilters: TransactionsFilterState = {
                ...current.filters,
                selectedWalletIds: current.filters.selectedWalletIds.filter((walletId) => validWalletIds.has(walletId)),
                selectedCategoryKey:
                    current.filters.selectedCategoryKey === "all" || validCategoryKeys.has(current.filters.selectedCategoryKey) ? current.filters.selectedCategoryKey : "all",
                selectedBeneficiary:
                    current.filters.selectedBeneficiary === "all" || validBeneficiaries.has(current.filters.selectedBeneficiary) ? current.filters.selectedBeneficiary : "all",
                selectedTagIds: current.filters.selectedTagIds.filter((tagId) => validTagIds.has(tagId)),
            };

            if (JSON.stringify(nextFilters) === JSON.stringify(current.filters)) {
                return current;
            }

            return {
                ...current,
                filters: nextFilters,
            };
        });
    }, [beneficiaryOptions, categoryOptions, setPagePreferences, tagOptions, wallets]);

    const hasAdvancedFilters = hasActiveAdvancedFilters(filters);

    const advancedFilteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim() ? normalizeComparisonText(searchQuery) : "";
        const minValue = parseNumberish(minAmount);
        const maxValue = parseNumberish(maxAmount);

        return nonCreditCardTransactions.filter((transaction) => {
            if (selectedCategoryKey !== "all" && getTransactionCategoryKey(transaction) !== selectedCategoryKey) {
                return false;
            }

            const matchesSelectedWallet =
                selectedWalletIds.includes(transaction.inWallet) || (transaction.type === "transfer" && Boolean(transaction.destinationWalletId) && selectedWalletIds.includes(transaction.destinationWalletId as string));

            if (selectedWalletIds.length > 0 && !matchesSelectedWallet) {
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
    }, [maxAmount, minAmount, searchQuery, selectedBeneficiary, selectedCategoryKey, selectedStatus, selectedTagIds, selectedWalletIds, nonCreditCardTransactions, walletNameById]);

    const monthlyTransactions = useMemo(() => {
        const filtered =
            dateMode === "period"
                ? advancedFilteredTransactions.filter((transaction) => (!dateFrom || transaction.date >= dateFrom) && (!dateTo || transaction.date <= dateTo))
                : advancedFilteredTransactions.filter((transaction) => getTransactionMonthKey(transaction.date) === selectedMonth);
        filtered.sort((a, b) => compareTransactions(a, b, sortMode));
        return filtered;
    }, [advancedFilteredTransactions, dateFrom, dateMode, dateTo, selectedMonth, sortMode]);

    const incomeTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "income"), [monthlyTransactions]);
    const spendingTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "spending"), [monthlyTransactions]);
    const transferTransactions = useMemo(() => monthlyTransactions.filter((transaction) => transaction.type === "transfer"), [monthlyTransactions]);

    const activeTabTransactions = useMemo(() => {
        if (activeTab === "transfer") {
            return transferTransactions;
        }

        return activeTab === "spending" ? spendingTransactions : incomeTransactions;
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

    const handleTypeSelect = (type: TransactionsTabKey) => {
        if (type === activeTab) {
            return;
        }

        setPagePreferences((current) => ({ ...current, activeTab: type }));
        goToPage(type);
    };

    return (
        <div className="w-full flex">
            <div className="flex flex-col gap-3 2xl:flex-row w-full">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <TransactionsFiltersPanel
                        showAdvancedFilters={showAdvancedFilters}
                        searchQuery={searchQuery}
                        selectedCategoryKey={selectedCategoryKey}
                        selectedBeneficiary={selectedBeneficiary}
                        selectedStatus={selectedStatus}
                        selectedTagIds={selectedTagIds}
                        minAmount={minAmount}
                        maxAmount={maxAmount}
                        categoryOptions={categoryOptions}
                        beneficiaryOptions={beneficiaryOptions}
                        tagOptions={tagOptions}
                        hasAdvancedFilters={hasAdvancedFilters}
                        onToggleAdvancedFilters={toggleAdvancedFilters}
                        onClearAdvancedFilters={clearAdvancedFilters}
                        onSearchQueryChange={(value) => setFilter("searchQuery", value)}
                        onCategoryChange={(value) => setFilter("selectedCategoryKey", value)}
                        onBeneficiaryChange={(value) => setFilter("selectedBeneficiary", value)}
                        onStatusChange={(value) => setFilter("selectedStatus", value)}
                        onMinAmountChange={(value) => setFilter("minAmount", value)}
                        onMaxAmountChange={(value) => setFilter("maxAmount", value)}
                        onTagToggle={toggleTagFilter}
                    />

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start w-full shrink-0">
                        <div className="min-w-0 flex-1">
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
                        </div>
                        <div className="w-full lg:w-64 lg:shrink-0">
                            <TransactionsOverviewPanel
                                wallets={wallets}
                                selectedWalletIds={selectedWalletIds}
                                onWalletIdsChange={(value) => setFilter("selectedWalletIds", value)}
                                activeTab={activeTab}
                                onTypeSelect={handleTypeSelect}
                                dateMode={dateMode}
                                onDateModeChange={(value) => setFilter("dateMode", value)}
                                selectedMonth={selectedMonth}
                                onMonthChange={(value) => setFilter("selectedMonth", value)}
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                                onDateFromChange={(value) => setFilter("dateFrom", value)}
                                onDateToChange={(value) => setFilter("dateTo", value)}
                                summary={summary}
                            />
                            <button
                                type="button"
                                onClick={handleCreateFromActiveTab}
                                className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-all hover:border-emerald-300/45 hover:bg-emerald-500/20"
                            >
                                <Plus size={14} />
                                {activeTab === "income" ? "Adicionar receita" : activeTab === "spending" ? "Adicionar despesa" : "Adicionar transferência"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}