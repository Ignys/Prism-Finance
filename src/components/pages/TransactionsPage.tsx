import { useEffect, useMemo, useState } from "react";
import { type Transaction, useFinanceActions, useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { AuthShell } from "../layout/AuthShell";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { EditTransaction } from "../modal/EditTransaction";
import { TransactionsFiltersPanel } from "./transactions/TransactionsFiltersPanel";
import { TransactionsListPanel } from "./transactions/TransactionsListPanel";
import { TransactionsSummaryCards } from "./transactions/TransactionsSummaryCards";
import {
    INITIAL_FILTER_STATE,
    compareTransactions,
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

export function TransactionsPage() {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { deleteTransaction, markTransactionAsPaid } = useFinanceActions();
    const { openModal } = useModal();
    const { consumePendingNavigation } = usePage();
    const [filters, setFilters] = useState<TransactionsFilterState>(INITIAL_FILTER_STATE);
    const [activeTab, setActiveTab] = useState<TransactionsTabKey>("income");

    useEffect(() => {
        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page === "transactions") {
            setActiveTab(pendingNavigation.tab);
        }
    }, [consumePendingNavigation]);

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

    const nonCreditCardTransactions = useMemo(
        () => transactions.filter((transaction) => !(transaction.type === "spending" && transaction.paymentMethod === "credit_card")),
        [transactions],
    );

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
        const beneficiaries = Array.from(
            new Set(nonCreditCardTransactions.map((transaction) => transaction.beneficiary.trim()).filter((beneficiary) => beneficiary.length > 0)),
        );
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
    }, [
        dateFrom,
        dateTo,
        maxAmount,
        minAmount,
        searchQuery,
        selectedBeneficiary,
        selectedCategoryKey,
        selectedStatus,
        selectedTagIds,
        selectedWalletId,
        nonCreditCardTransactions,
        walletNameById,
    ]);

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

    const handleEditTransaction = (transaction: Transaction) => {
        openModal(<EditTransaction transaction={transaction} />);
    };

    const getTransactionDisplayLabel = (transaction: Transaction) => {
        return transaction.description.trim() || getTransactionCategoryLabel(transaction);
    };

    const handleDeleteTransaction = (transaction: Transaction) => {
        const transactionLabel = getTransactionDisplayLabel(transaction);
        const isInvoicePayment = transaction.systemKind === "invoice_payment";

        openModal(
            <ConfirmActionModal
                title="Excluir transacao?"
                description={
                    isInvoicePayment
                        ? `Essa acao remove \"${transactionLabel}\" e reverte o pagamento vinculado na fatura.`
                        : `Essa acao remove \"${transactionLabel}\" em definitivo.`
                }
                confirmLabel="Excluir"
                tone="danger"
                onConfirm={() => deleteTransaction(transaction)}
            />,
        );
    };

    const handleConfirmPayment = (transaction: Transaction) => {
        const transactionLabel = getTransactionDisplayLabel(transaction);

        openModal(
            <ConfirmActionModal
                title="Confirmar pagamento?"
                description={`Essa acao marca "${transactionLabel}" como paga e atualiza os saldos.`}
                confirmLabel="Marcar como pago"
                tone="success"
                onConfirm={() => markTransactionAsPaid(transaction)}
            />,
        );
    };

    return (
        <AuthShell mainClassName="text-white">
            <div className="w-full flex justify-center space-y-3">
                <div className="flex flex-col gap-3 2xl:flex-row w-[90%]">
                    <div className="min-w-0 flex-1 space-y-3">
                        <TransactionsFiltersPanel
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
                        />
                        <TransactionsListPanel
                            activeTab={activeTab}
                            incomeTransactions={incomeTransactions}
                            spendingTransactions={spendingTransactions}
                            transferTransactions={transferTransactions}
                            wallets={wallets}
                            sortMode={sortMode}
                            onTabChange={setActiveTab}
                            onSortModeChange={(value) => setFilter("sortMode", value)}
                            onEdit={handleEditTransaction}
                            onConfirmPayment={handleConfirmPayment}
                            onDelete={handleDeleteTransaction}
                        />
                    </div>
                    <div className="w-full 2xl:w-[230px]">
                        <TransactionsSummaryCards activeTab={activeTab} summary={summary} />
                    </div>
                </div>
            </div>
        </AuthShell>
    );
}
