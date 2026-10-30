import { monthPeriod } from "../../context/finance/recurrence/period";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    type PlanningSimulatedExpense,
    type PlanningSimulatedIncome,
    type PlanningWishlistSelection,
    useFinanceActions,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceLedgerEntries,
    useFinancePlanning,
    useFinanceTransactions,
    useFinanceWallets,
    useFinanceWishItems,
} from "../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { AddWishItem } from "../modal/AddWishItem";
import { PlanningInvoiceMonthModal } from "../modal/PlanningInvoiceMonthModal";
import { PlanningSimulationModal, type PlanningSimulationModalDraft } from "../modal/PlanningSimulationModal";
import { PlanningDetailsAside } from "./planning/PlanningDetailsAside";
import { PlanningPageHeader } from "./planning/PlanningPageHeader";
import { PlanningTimelinePanel } from "./planning/PlanningTimelinePanel";
import { PlanningTimelineToolbar } from "./planning/PlanningTimelineToolbar";
import { DEFAULT_TIMELINE_MONTHS, type InheritedExpenseItem, type MonthProjection, type PlanningPanel, type SimulatedExpenseItem, type SimulatedIncomeItem } from "./planning/planningTimelineTypes";
import { buildTimelineProjection, getCurrentMonthKey, mergePlanningUpdate, parseCurrencyInput } from "./planning/planningTimelineUtils";
import {
    getAllCreditCardIds,
    getAllWalletIds,
    getScopedCreditCardInvoices,
    getScopedCreditCardsByIds,
    getScopedLedgerEntries,
    getScopedTransactions,
    getScopedWallets,
    resolveSelectedIds,
} from "./planning/planningWalletScope";

const TIMELINE_PAST_MONTHS = 3;

function isValidPlanningMonthKey(monthKey: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);
}

function toInstallmentField(installmentCount: number | null): Pick<PlanningSimulatedExpense, "installmentCount"> {
    return installmentCount ? { installmentCount } : {};
}

function isPlanningPanel(value: string | null): value is PlanningPanel {
    return value === "income" || value === "inherited_expenses" || value === "projections";
}

export function PlanningPage() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const ledgerEntries = useFinanceLedgerEntries();
    const wishItems = useFinanceWishItems();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();
    const { openModal } = useModal();
    const { goToPage } = usePage();
    const [searchParams] = useSearchParams();
    const currentMonthKey = getCurrentMonthKey();
    const requestedMonthKey = searchParams.get("month");
    const requestedPanel = searchParams.get("panel");

    const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
        requestedMonthKey && isValidPlanningMonthKey(requestedMonthKey) && requestedMonthKey >= currentMonthKey ? requestedMonthKey : currentMonthKey,
    );
    const [selectedPanel, setSelectedPanel] = useState<PlanningPanel>(() => (isPlanningPanel(requestedPanel) ? requestedPanel : "income"));

    const activeWishItems = useMemo(() => wishItems.filter((item) => item.isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [wishItems]);
    const wishlistSelectionByWishItemId = useMemo(() => new Map(planning.wishlistSelections.map((selection) => [selection.wishItemId, selection])), [planning.wishlistSelections]);
    const walletIds = useMemo(() => getAllWalletIds(wallets), [wallets]);
    const creditCardIds = useMemo(() => getAllCreditCardIds(creditCards), [creditCards]);
    const timelineSelectedWalletIds = useMemo(() => resolveSelectedIds(walletIds, planning.timelineSelectedWalletIds ?? []), [planning.timelineSelectedWalletIds, walletIds]);
    const timelineSelectedCreditCardIds = useMemo(
        () => resolveSelectedIds(creditCardIds, planning.timelineSelectedCreditCardIds ?? []),
        [creditCardIds, planning.timelineSelectedCreditCardIds],
    );
    const compareMode = planning.timelineCompareMode ?? true;
    const horizontalMode = planning.timelineHorizontalMode ?? false;
    const timelineMonthCount = planning.timelineMonthCount ?? DEFAULT_TIMELINE_MONTHS;
    const timelinePeriod = monthPeriod(currentMonthKey, TIMELINE_PAST_MONTHS, timelineMonthCount - 1);
    const selectedPeriod = monthPeriod(selectedMonthKey, 2);
    const projectionPeriod = {
        startDate: [timelinePeriod.startDate, selectedPeriod.startDate].sort()[0],
        endDate: [timelinePeriod.endDate, selectedPeriod.endDate].sort().reverse()[0],
    };
    const transactions = useFinanceTransactions(projectionPeriod);
    const creditCardInvoices = useFinanceCreditCardInvoices(projectionPeriod);
    const scopedWallets = useMemo(() => getScopedWallets(wallets, timelineSelectedWalletIds), [timelineSelectedWalletIds, wallets]);
    const scopedCreditCards = useMemo(() => getScopedCreditCardsByIds(creditCards, timelineSelectedCreditCardIds), [creditCards, timelineSelectedCreditCardIds]);
    const scopedCreditCardInvoices = useMemo(() => getScopedCreditCardInvoices(creditCardInvoices, scopedCreditCards), [creditCardInvoices, scopedCreditCards]);
    const scopedLedgerEntries = useMemo(() => getScopedLedgerEntries(ledgerEntries, timelineSelectedWalletIds), [ledgerEntries, timelineSelectedWalletIds]);
    const scopedTransactions = useMemo(
        () => getScopedTransactions(transactions, timelineSelectedWalletIds, scopedCreditCards, timelineSelectedWalletIds.length === walletIds.length),
        [scopedCreditCards, timelineSelectedWalletIds, transactions, walletIds.length],
    );

    useEffect(() => {
        if (!requestedMonthKey && !requestedPanel) {
            return;
        }

        if (requestedMonthKey && isValidPlanningMonthKey(requestedMonthKey) && requestedMonthKey >= currentMonthKey) {
            setSelectedMonthKey(requestedMonthKey);
        }

        if (isPlanningPanel(requestedPanel)) {
            setSelectedPanel(requestedPanel);
        }
    }, [currentMonthKey, requestedMonthKey, requestedPanel]);

    const projection = useMemo(
        () =>
            buildTimelineProjection({
                wallets: scopedWallets,
                creditCards: scopedCreditCards,
                creditCardInvoices: scopedCreditCardInvoices,
                transactions: scopedTransactions,
                ledgerEntries: scopedLedgerEntries,
                wishItems,
                planning,
                monthsToShow: timelineMonthCount,
                pastMonthsToShow: TIMELINE_PAST_MONTHS,
                pinnedMonthKey: selectedMonthKey,
            }),
        [planning, scopedCreditCardInvoices, scopedCreditCards, scopedLedgerEntries, scopedTransactions, scopedWallets, selectedMonthKey, timelineMonthCount, wishItems],
    );

    const currentMonth = projection.months.find((month) => month.isCurrentMonth) ?? projection.months[0] ?? null;
    const selectedMonth = projection.months.find((month) => month.monthKey === selectedMonthKey) ?? currentMonth;

    const commitExpenseDraft = async (monthKey: string, draft: Pick<PlanningSimulationModalDraft, "description" | "amountInput" | "installmentCount">) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar o gasto.");
        }

        const expense: PlanningSimulatedExpense = {
            id: `planning-expense-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Gasto simulado",
            amount,
            ...toInstallmentField(draft.installmentCount),
            createdAt: new Date().toISOString(),
        };

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: [...planning.simulatedExpenses, expense],
            }),
        );
    };

    const commitIncomeDraft = async (monthKey: string, draft: { description: string; amountInput: string }) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar a receita.");
        }

        const income: PlanningSimulatedIncome = {
            id: `planning-income-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Receita simulada",
            amount,
            createdAt: new Date().toISOString(),
        };

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: [...planning.simulatedIncomes, income],
            }),
        );
    };

    const handleDeleteExpense = (expenseId: string) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: planning.simulatedExpenses.filter((expense) => expense.id !== expenseId),
                disabledSimulatedExpenseIds: (planning.disabledSimulatedExpenseIds ?? []).filter((id) => id !== expenseId),
            }),
        );
    };

    const handleDeleteIncome = (income: SimulatedIncomeItem) => {
        if (income.source === "legacy_override" && income.overrideMonthKey) {
            void updatePlanningState(
                mergePlanningUpdate(planning, {
                    revenueOverrides: planning.revenueOverrides.filter((override) => override.monthKey !== income.overrideMonthKey),
                }),
            );
            return;
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: planning.simulatedIncomes.filter((item) => item.id !== income.id),
                disabledSimulatedIncomeIds: (planning.disabledSimulatedIncomeIds ?? []).filter((id) => id !== income.id),
            }),
        );
    };

    const handleToggleSimulatedExpense = (expenseId: string) => {
        const disabledIds = new Set(planning.disabledSimulatedExpenseIds ?? []);
        if (disabledIds.has(expenseId)) {
            disabledIds.delete(expenseId);
        } else {
            disabledIds.add(expenseId);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledSimulatedExpenseIds: Array.from(disabledIds),
            }),
        );
    };

    const handleToggleSimulatedIncome = (income: SimulatedIncomeItem) => {
        if (income.source !== "simulated_income") {
            return;
        }

        const disabledIds = new Set(planning.disabledSimulatedIncomeIds ?? []);
        if (disabledIds.has(income.id)) {
            disabledIds.delete(income.id);
        } else {
            disabledIds.add(income.id);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledSimulatedIncomeIds: Array.from(disabledIds),
            }),
        );
    };

    const handleToggleIncome = (incomeId: string) => {
        const disabledIds = new Set(planning.disabledIncomeIds ?? []);
        if (disabledIds.has(incomeId)) {
            disabledIds.delete(incomeId);
        } else {
            disabledIds.add(incomeId);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledIncomeIds: Array.from(disabledIds),
            }),
        );
    };

    const handleToggleInheritedExpense = (expenseId: string) => {
        const disabledIds = new Set(planning.disabledInheritedExpenseIds ?? []);
        if (disabledIds.has(expenseId)) {
            disabledIds.delete(expenseId);
        } else {
            disabledIds.add(expenseId);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledInheritedExpenseIds: Array.from(disabledIds),
            }),
        );
    };

    /** `monthKey` nulo (ou igual ao vencimento) devolve a fatura ao mês original. */
    const setInvoiceMonthOverride = (invoiceId: string, monthKey: string | null) => {
        const { [invoiceId]: _previous, ...overrides } = planning.invoiceMonthOverrides ?? {};
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                invoiceMonthOverrides: monthKey ? { ...overrides, [invoiceId]: monthKey } : overrides,
            }),
        );
    };

    const openInvoiceMonthModal = (item: InheritedExpenseItem) => {
        const { invoiceId, dueMonthKey } = item;
        if (!invoiceId || !dueMonthKey || !selectedMonth) {
            return;
        }

        openModal(
            <PlanningInvoiceMonthModal
                label={item.label}
                amount={item.amount}
                dueMonthKey={dueMonthKey}
                chargeMonthKey={item.movedToMonthKey ?? selectedMonth.monthKey}
                onSubmit={(monthKey) => setInvoiceMonthOverride(invoiceId, monthKey === dueMonthKey ? null : monthKey)}
            />,
        );
    };

    const handleToggleWishlistSelection = (wishItemId: string) => {
        if (!selectedMonth) {
            return;
        }

        const existingSelection = planning.wishlistSelections.find((selection) => selection.wishItemId === wishItemId) ?? null;
        if (existingSelection?.monthKey === selectedMonth.monthKey) {
            void updatePlanningState(
                mergePlanningUpdate(planning, {
                    wishlistSelections: planning.wishlistSelections.filter((selection) => selection.wishItemId !== wishItemId),
                }),
            );
            return;
        }

        const nextSelection: PlanningWishlistSelection = {
            id: existingSelection?.id ?? `planning-wishlist-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            wishItemId,
            monthKey: selectedMonth.monthKey,
            createdAt: new Date().toISOString(),
        };

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                wishlistSelections: [...planning.wishlistSelections.filter((selection) => selection.wishItemId !== wishItemId), nextSelection],
            }),
        );
    };

    const commitEditedIncome = async (income: SimulatedIncomeItem, draft: PlanningSimulationModalDraft) => {
        if (income.source !== "simulated_income") {
            return;
        }

        const existingIncome = planning.simulatedIncomes.find((item) => item.id === income.id);
        if (!existingIncome) {
            throw new Error("Receita simulada nao encontrada.");
        }

        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar a receita.");
        }

        const baseProjection = {
            monthKey: draft.monthKey,
            description: draft.description.trim() || (draft.tone === "income" ? "Receita simulada" : "Gasto simulado"),
            amount,
            createdAt: existingIncome.createdAt,
        };

        if (draft.tone === "income") {
            await updatePlanningState(
                mergePlanningUpdate(planning, {
                    simulatedIncomes: planning.simulatedIncomes.map((item) => (item.id === existingIncome.id ? { ...baseProjection, id: existingIncome.id } : item)),
                }),
            );
            return;
        }

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: planning.simulatedIncomes.filter((item) => item.id !== existingIncome.id),
                simulatedExpenses: [
                    ...planning.simulatedExpenses,
                    {
                        ...baseProjection,
                        ...toInstallmentField(draft.installmentCount),
                        id: `planning-expense-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
                    },
                ],
                disabledSimulatedIncomeIds: (planning.disabledSimulatedIncomeIds ?? []).filter((id) => id !== existingIncome.id),
            }),
        );
    };

    const commitEditedExpense = async (expense: SimulatedExpenseItem, draft: PlanningSimulationModalDraft) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar o gasto.");
        }

        const baseProjection = {
            monthKey: draft.monthKey,
            description: draft.description.trim() || (draft.tone === "income" ? "Receita simulada" : "Gasto simulado"),
            amount,
            createdAt: expense.createdAt,
        };

        if (draft.tone === "expense") {
            await updatePlanningState(
                mergePlanningUpdate(planning, {
                    simulatedExpenses: planning.simulatedExpenses.map((item) =>
                        item.id === expense.id ? { ...baseProjection, ...toInstallmentField(draft.installmentCount), id: expense.id } : item,
                    ),
                }),
            );
            return;
        }

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: planning.simulatedExpenses.filter((item) => item.id !== expense.id),
                simulatedIncomes: [
                    ...planning.simulatedIncomes,
                    {
                        ...baseProjection,
                        id: `planning-income-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
                    },
                ],
                disabledSimulatedExpenseIds: (planning.disabledSimulatedExpenseIds ?? []).filter((id) => id !== expense.id),
            }),
        );
    };

    const handleSubmitSimulation = async (draft: PlanningSimulationModalDraft) => {
        if (draft.tone === "income") {
            await commitIncomeDraft(draft.monthKey, draft);
            return;
        }

        await commitExpenseDraft(draft.monthKey, draft);
    };

    const openSimulationModal = (month: MonthProjection, tone: "income" | "expense") => {
        openModal(<PlanningSimulationModal tone={tone} monthKey={month.monthKey} onSubmit={handleSubmitSimulation} />);
    };

    const openIncomeEditModal = (income: SimulatedIncomeItem) => {
        if (income.source !== "simulated_income") {
            return;
        }

        const existingIncome = planning.simulatedIncomes.find((item) => item.id === income.id);
        if (!existingIncome) {
            return;
        }

        openModal(
            <PlanningSimulationModal
                title="Editar projeção"
                tone="income"
                monthKey={existingIncome.monthKey}
                initialValues={{
                    description: existingIncome.description,
                    amount: existingIncome.amount,
                    monthKey: existingIncome.monthKey,
                    tone: "income",
                }}
                onSubmit={(draft) => commitEditedIncome(income, draft)}
            />,
        );
    };

    const openExpenseEditModal = (expense: SimulatedExpenseItem) => {
        // Parcelas exibidas na timeline trazem mês/valor da parcela; a edição usa o total e o mês inicial salvos.
        const storedExpense = planning.simulatedExpenses.find((item) => item.id === expense.id) ?? expense;
        openModal(
            <PlanningSimulationModal
                title="Editar projeção"
                tone="expense"
                monthKey={storedExpense.monthKey}
                initialValues={{
                    description: storedExpense.description,
                    amount: storedExpense.amount,
                    monthKey: storedExpense.monthKey,
                    tone: "expense",
                    installmentCount: storedExpense.installmentCount,
                }}
                onSubmit={(draft) => commitEditedExpense(expense, draft)}
            />,
        );
    };

    const openWishlistItemOnWishlistPage = (wishItemId: string) => {
        goToPage("wishlist");
        window.setTimeout(() => {
            openModal(<AddWishItem mode="edit" wishItemId={wishItemId} />);
        }, 0);
    };

    const openTransactionOnTransactionsPage = (transactionId: string) => {
        const transaction = transactions.find((item) => item.id === transactionId);
        if (!transaction || transaction.type === "transfer") {
            return;
        }

        goToPage("transactions", {
            page: "transactions",
            tab: transaction.type === "income" ? "income" : "spending",
            selectedMonth: getMonthKeyFromDateValue(transaction.date),
            targetTransactionId: transaction.id,
        });
    };

    const openInvoiceOnStatementPage = (invoiceId: string) => {
        const invoice = creditCardInvoices.find((item) => item.id === invoiceId);
        if (!invoice) {
            return;
        }

        goToPage("statement", {
            page: "statement",
            selectedCardId: invoice.creditCardId,
            selectedMonth: getMonthKeyFromDateValue(invoice.dueDate),
        });
    };

    const handleSelectPanel = (monthKey: string, panel: PlanningPanel) => {
        setSelectedMonthKey(monthKey);
        setSelectedPanel(panel);
    };

    const handleTimelineWalletIdsChange = (walletIds: string[]) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineSelectedWalletIds: walletIds,
            }),
        );
    };

    const handleTimelineCreditCardIdsChange = (creditCardIds: string[]) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineSelectedCreditCardIds: creditCardIds,
            }),
        );
    };

    const handleTimelineCompareModeChange = (nextCompareMode: boolean) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineCompareMode: nextCompareMode,
            }),
        );
    };

    const handleTimelineHorizontalModeChange = (nextHorizontalMode: boolean) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineHorizontalMode: nextHorizontalMode,
            }),
        );
    };

    const handleTimelineMonthCountChange = (monthCount: number) => {
        if (monthCount !== 3 && monthCount !== 6 && monthCount !== 9 && monthCount !== 12) {
            return;
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineMonthCount: monthCount,
            }),
        );
    };

    return (
        <div className="flex flex-col min-h-full gap-3">
            <PlanningPageHeader
                toolbar={
                    <PlanningTimelineToolbar
                        compareMode={compareMode}
                        horizontalMode={horizontalMode}
                        timelineMonthCount={timelineMonthCount}
                        wallets={wallets}
                        creditCards={creditCards}
                        selectedWalletIds={timelineSelectedWalletIds}
                        selectedCreditCardIds={timelineSelectedCreditCardIds}
                        onCompareModeChange={handleTimelineCompareModeChange}
                        onSelectedCreditCardIdsChange={handleTimelineCreditCardIdsChange}
                        onHorizontalModeChange={handleTimelineHorizontalModeChange}
                        onSelectedWalletIdsChange={handleTimelineWalletIdsChange}
                        onTimelineMonthCountChange={handleTimelineMonthCountChange}
                    />
                }
            />

            <div className="flex max-h-[calc(100vh-11rem)] flex-1 flex-col gap-2 xl:flex-row overflow-clip">
                <PlanningTimelinePanel
                    months={projection.months}
                    selectedMonthKey={selectedMonth?.monthKey ?? null}
                    selectedPanel={selectedPanel}
                    compareMode={compareMode}
                    horizontalMode={horizontalMode}
                    onSelectPanel={handleSelectPanel}
                />

                <PlanningDetailsAside
                    selectedMonth={selectedMonth}
                    fallbackMonth={currentMonth}
                    selectedPanel={selectedPanel}
                    activeWishItems={activeWishItems}
                    wishlistSelectionByWishItemId={wishlistSelectionByWishItemId}
                    onAddIncome={(month) => openSimulationModal(month, "income")}
                    onDeleteExpense={handleDeleteExpense}
                    onDeleteIncome={handleDeleteIncome}
                    onEditExpense={openExpenseEditModal}
                    onEditIncome={openIncomeEditModal}
                    onEditWishlistItem={openWishlistItemOnWishlistPage}
                    onOpenTransaction={openTransactionOnTransactionsPage}
                    onOpenInvoice={openInvoiceOnStatementPage}
                    onMoveInvoice={openInvoiceMonthModal}
                    onRestoreInvoiceMonth={(invoiceId) => setInvoiceMonthOverride(invoiceId, null)}
                    onToggleExpense={handleToggleSimulatedExpense}
                    onToggleIncome={handleToggleIncome}
                    onToggleSimulatedIncome={handleToggleSimulatedIncome}
                    onToggleInheritedExpense={handleToggleInheritedExpense}
                    onToggleWishlistSelection={handleToggleWishlistSelection}
                />
            </div>
        </div>
    );
}
