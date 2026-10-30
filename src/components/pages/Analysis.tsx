import { PlanningDetailsAside } from "./planning/PlanningDetailsAside";
import { PlanningPageHeader } from "./planning/PlanningPageHeader";
import { PlanningTimelinePanel } from "./planning/PlanningTimelinePanel";
import { PlanningTimelineToolbar } from "./planning/PlanningTimelineToolbar";
import { usePlanningPage } from "./planning/usePlanningPage";

export function PlanningPage() {
    const {
        compareMode,
        horizontalMode,
        timelineMonthCount,
        wallets,
        creditCards,
        timelineSelectedWalletIds,
        timelineSelectedCreditCardIds,
        handleTimelineCompareModeChange,
        handleTimelineCreditCardIdsChange,
        handleTimelineHorizontalModeChange,
        handleTimelineWalletIdsChange,
        handleTimelineMonthCountChange,
        projection,
        selectedMonth,
        selectedPanel,
        handleSelectPanel,
        currentMonth,
        activeWishItems,
        wishlistSelectionByWishItemId,
        openSimulationModal,
        handleDeleteExpense,
        handleDeleteIncome,
        openExpenseEditModal,
        openIncomeEditModal,
        openWishlistItemOnWishlistPage,
        openTransactionOnTransactionsPage,
        openInvoiceOnStatementPage,
        openInvoiceMonthModal,
        setInvoiceMonthOverride,
        handleToggleSimulatedExpense,
        handleToggleIncome,
        handleToggleSimulatedIncome,
        handleToggleInheritedExpense,
        handleToggleWishlistSelection,
    } = usePlanningPage();

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
