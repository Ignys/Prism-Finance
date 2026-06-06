import { useEffect, useMemo, useState } from "react";
import {
    type PlanningSimulatedExpense,
    type PlanningSimulatedIncome,
    type PlanningWishlistSelection,
    type ReportPeriod,
    useFinanceActions,
    useFinanceCategories,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceLedgerEntries,
    useFinancePlanning,
    useFinanceTransactions,
    useFinanceWallets,
    useFinanceWishItems,
} from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AuthShell } from "../layout/AuthShell";
import { PlanningSimulationModal } from "../modal/PlanningSimulationModal";
import { PlanningDetailsAside } from "./planning/PlanningDetailsAside";
import { DEFAULT_PLANNING_TAB, PlanningPageHeader } from "./planning/PlanningPageHeader";
import { PlanningReportsTab } from "./planning/PlanningReportsTab";
import { PlanningTimelinePanel } from "./planning/PlanningTimelinePanel";
import { DEFAULT_TIMELINE_MONTHS, type MonthProjection, type PlanningPanel, type PlanningTab, type SimulatedIncomeItem } from "./planning/planningTimelineTypes";
import { buildTimelineProjection, getCurrentMonthKey, mergePlanningUpdate, parseCurrencyInput } from "./planning/planningTimelineUtils";
import {
    getAllCreditCardIds,
    getAllWalletIds,
    getScopedCreditCardInvoices,
    getScopedCreditCards,
    getScopedLedgerEntries,
    getReportScopedTransactions,
    getScopedTransactions,
    getScopedWallets,
    resolveSelectedIds,
} from "./planning/planningWalletScope";

function areStringArraysEqual(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function PlanningPage() {
    const wallets = useFinanceWallets();
    const categories = useFinanceCategories();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactions = useFinanceTransactions();
    const ledgerEntries = useFinanceLedgerEntries();
    const wishItems = useFinanceWishItems();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();
    const { openModal } = useModal();

    const [activePlanningTab, setActivePlanningTab] = useState<PlanningTab>(DEFAULT_PLANNING_TAB);
    const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentMonthKey());
    const [selectedPanel, setSelectedPanel] = useState<PlanningPanel>("income");

    const categoryIconById = useMemo(() => new Map(categories.map((category) => [category.id, category.icon])), [categories]);
    const activeWishItems = useMemo(() => wishItems.filter((item) => item.isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [wishItems]);
    const wishlistSelectionByWishItemId = useMemo(() => new Map(planning.wishlistSelections.map((selection) => [selection.wishItemId, selection])), [planning.wishlistSelections]);
    const walletIds = useMemo(() => getAllWalletIds(wallets), [wallets]);
    const creditCardIds = useMemo(() => getAllCreditCardIds(creditCards), [creditCards]);
    const timelineSelectedWalletIds = useMemo(() => resolveSelectedIds(walletIds, planning.timelineSelectedWalletIds ?? []), [planning.timelineSelectedWalletIds, walletIds]);
    const reportsSelectedWalletIds = useMemo(() => resolveSelectedIds(walletIds, planning.reportsSelectedWalletIds ?? []), [planning.reportsSelectedWalletIds, walletIds]);
    const reportsSelectedCreditCardIds = useMemo(
        () => resolveSelectedIds(creditCardIds, planning.reportsSelectedCreditCardIds ?? []),
        [creditCardIds, planning.reportsSelectedCreditCardIds],
    );
    const compareMode = planning.timelineCompareMode ?? true;
    const horizontalMode = planning.timelineHorizontalMode ?? false;
    const timelineMonthCount = planning.timelineMonthCount ?? DEFAULT_TIMELINE_MONTHS;
    const reportPeriod = planning.reportsPeriod;
    const scopedWallets = useMemo(() => getScopedWallets(wallets, timelineSelectedWalletIds), [timelineSelectedWalletIds, wallets]);
    const scopedCreditCards = useMemo(() => getScopedCreditCards(creditCards, timelineSelectedWalletIds, timelineSelectedWalletIds.length === walletIds.length), [creditCards, timelineSelectedWalletIds, walletIds.length]);
    const scopedCreditCardInvoices = useMemo(() => getScopedCreditCardInvoices(creditCardInvoices, scopedCreditCards), [creditCardInvoices, scopedCreditCards]);
    const scopedLedgerEntries = useMemo(() => getScopedLedgerEntries(ledgerEntries, timelineSelectedWalletIds), [ledgerEntries, timelineSelectedWalletIds]);
    const scopedTransactions = useMemo(
        () => getScopedTransactions(transactions, timelineSelectedWalletIds, scopedCreditCards, timelineSelectedWalletIds.length === walletIds.length),
        [scopedCreditCards, timelineSelectedWalletIds, transactions, walletIds.length],
    );
    const reportScopedTransactions = useMemo(
        () =>
            getReportScopedTransactions(
                transactions,
                reportsSelectedWalletIds,
                reportsSelectedCreditCardIds,
                reportsSelectedWalletIds.length === walletIds.length,
                reportsSelectedCreditCardIds.length === creditCardIds.length,
            ),
        [creditCardIds.length, reportsSelectedCreditCardIds, reportsSelectedWalletIds, transactions, walletIds.length],
    );

    useEffect(() => {
        const nextTimelineWalletIds = timelineSelectedWalletIds;
        const nextReportsWalletIds = reportsSelectedWalletIds;
        const nextReportsCreditCardIds = reportsSelectedCreditCardIds;
        const shouldPersistTimelineWallets = !areStringArraysEqual(planning.timelineSelectedWalletIds ?? [], nextTimelineWalletIds);
        const shouldPersistReportsWallets = !areStringArraysEqual(planning.reportsSelectedWalletIds ?? [], nextReportsWalletIds);
        const shouldPersistReportsCreditCards = !areStringArraysEqual(planning.reportsSelectedCreditCardIds ?? [], nextReportsCreditCardIds);

        if (!shouldPersistTimelineWallets && !shouldPersistReportsWallets && !shouldPersistReportsCreditCards) {
            return;
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                timelineSelectedWalletIds: nextTimelineWalletIds,
                reportsSelectedWalletIds: nextReportsWalletIds,
                reportsSelectedCreditCardIds: nextReportsCreditCardIds,
            }),
        );
    }, [
        planning.reportsSelectedCreditCardIds,
        planning.reportsSelectedWalletIds,
        planning.timelineSelectedWalletIds,
        reportsSelectedCreditCardIds,
        reportsSelectedWalletIds,
        timelineSelectedWalletIds,
        updatePlanningState,
    ]);

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
            }),
        [planning, scopedCreditCardInvoices, scopedCreditCards, scopedLedgerEntries, scopedTransactions, scopedWallets, timelineMonthCount, wishItems],
    );

    const currentMonth = projection.months[0] ?? null;
    const selectedMonth = projection.months.find((month) => month.monthKey === selectedMonthKey) ?? currentMonth;

    const commitExpenseDraft = async (monthKey: string, draft: { description: string; amountInput: string }) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar o gasto.");
        }

        const expense: PlanningSimulatedExpense = {
            id: `planning-expense-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Gasto simulado",
            amount,
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

    const handleSubmitSimulation = async (draft: { description: string; amountInput: string; monthKey: string; tone: "income" | "expense" }) => {
        if (draft.tone === "income") {
            await commitIncomeDraft(draft.monthKey, draft);
            return;
        }

        await commitExpenseDraft(draft.monthKey, draft);
    };

    const openSimulationModal = (month: MonthProjection, tone: "income" | "expense") => {
        openModal(<PlanningSimulationModal tone={tone} monthKey={month.monthKey} onSubmit={handleSubmitSimulation} />);
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

    const handleReportsWalletIdsChange = (walletIds: string[]) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                reportsSelectedWalletIds: walletIds,
            }),
        );
    };

    const handleReportsCreditCardIdsChange = (creditCardIds: string[]) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                reportsSelectedCreditCardIds: creditCardIds,
            }),
        );
    };

    const handleReportsPeriodChange = (period: ReportPeriod) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                reportsPeriod: period,
            }),
        );
    };

    const isReportsTab = activePlanningTab === "reports";

    return (
        <AuthShell mainClassName="text-white">
            <div className="flex flex-col min-h-full gap-3">
                <PlanningPageHeader
                    activePlanningTab={activePlanningTab}
                    onTabChange={setActivePlanningTab}
                    timelineToolbarProps={{
                        compareMode,
                        horizontalMode,
                        timelineMonthCount,
                        wallets,
                        selectedWalletIds: timelineSelectedWalletIds,
                        onCompareModeChange: handleTimelineCompareModeChange,
                        onHorizontalModeChange: handleTimelineHorizontalModeChange,
                        onSelectedWalletIdsChange: handleTimelineWalletIdsChange,
                        onTimelineMonthCountChange: handleTimelineMonthCountChange,
                    }}
                    reportsToolbarProps={{
                        creditCards,
                        period: reportPeriod,
                        selectedCreditCardIds: reportsSelectedCreditCardIds,
                        selectedWalletIds: reportsSelectedWalletIds,
                        wallets,
                        onPeriodChange: handleReportsPeriodChange,
                        onSelectedCreditCardIdsChange: handleReportsCreditCardIdsChange,
                        onSelectedWalletIdsChange: handleReportsWalletIdsChange,
                    }}
                />

                {isReportsTab ? (
                    <PlanningReportsTab period={reportPeriod} transactions={reportScopedTransactions} allTransactions={transactions} creditCardInvoices={creditCardInvoices} />
                ) : (
                    <div className="flex max-h-190 flex-1 flex-col gap-2 xl:flex-row">
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
                            categoryIconById={categoryIconById}
                            wishlistSelectionByWishItemId={wishlistSelectionByWishItemId}
                            onAddIncome={(month) => openSimulationModal(month, "income")}
                            onDeleteExpense={handleDeleteExpense}
                            onDeleteIncome={handleDeleteIncome}
                            onToggleIncome={handleToggleIncome}
                            onToggleInheritedExpense={handleToggleInheritedExpense}
                            onToggleWishlistSelection={handleToggleWishlistSelection}
                        />
                    </div>
                )}
            </div>
        </AuthShell>
    );
}
