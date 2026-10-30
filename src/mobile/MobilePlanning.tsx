import { ArrowDownRight, ArrowUpRight, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PlanningDetailsAside } from "../components/pages/planning/PlanningDetailsAside";
import { buildPlanningTimelineMonthSummary } from "../components/pages/planning/planningTimelineMonthSummary";
import { BALANCE_TONE_CLASS_NAMES, type MonthProjection, type PlanningPanel } from "../components/pages/planning/planningTimelineTypes";
import { formatCurrency } from "../components/pages/planning/planningTimelineUtils";
import { usePlanningPage } from "../components/pages/planning/usePlanningPage";
import { MobileAccountCombobox } from "./MobileAccountCombobox";
import { LABEL_CLASS } from "./MobileHeader";
import { MobileDrawer } from "./MobileDrawer";

const COLUMNS = [
    { panel: "income" as const, icon: ArrowUpRight, className: "text-emerald-300" },
    { panel: "inherited_expenses" as const, icon: ArrowDownRight, className: "text-red-300" },
    { panel: "projections" as const, icon: Pencil, className: "text-neutral-400" },
];

const PANEL_TITLE: Record<PlanningPanel, string> = { income: "Receitas", inherited_expenses: "Despesas", projections: "Projeções" };

// Same treatment as the desktop sheet: smaller, faded "R$", number in front.
function MoneyText({ label }: { label: string }) {
    const match = /^(-?)\s*R\$\s*(.+)$/.exec(label);
    if (!match) return <>{label}</>;
    return (
        <>
            <span className="mr-0.5 text-[0.75em] font-normal opacity-50">R$</span>
            {match[1]}
            {match[2]}
        </>
    );
}

interface MonthRowProps {
    month: MonthProjection;
    compareMode: boolean;
    isPast: boolean;
    activePanel: PlanningPanel | null;
    onOpen: (panel: PlanningPanel) => void;
}

// A spreadsheet row folded in two lines: month and balances on top, the three tappable cells below.
function MonthRow({ month, compareMode, isPast, activePanel, onOpen }: MonthRowProps) {
    const { actionItems, footerBalanceTone, visibleAccumulated, visibleMonthBalance } = buildPlanningTimelineMonthSummary(month, compareMode);

    return (
        <li className={`border-b border-white/[0.06] py-3 ${isPast && !activePanel ? "opacity-55" : ""}`}>
            <div className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-white">
                        {month.shortMonthLabel}
                        <span className="font-normal text-white/40">/{month.year}</span>
                        {month.isCurrentMonth && <span className="ml-1.5 rounded bg-sky-400/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-sky-200">Atual</span>}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-white/45">
                        <MoneyText label={formatCurrency(month.openingMonthBalance)} />
                    </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                    <p className={`text-base font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>
                        <MoneyText label={formatCurrency(visibleAccumulated)} />
                    </p>
                    <p className={`mt-0.5 text-xs font-medium ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>
                        <MoneyText label={formatCurrency(visibleMonthBalance)} />
                    </p>
                </div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {actionItems.map((item) => {
                    const active = activePanel === item.panel;
                    return (
                        <button
                            key={item.panel}
                            type="button"
                            aria-pressed={active}
                            aria-label={`${item.title} de ${month.monthLabel}: ${item.valueLabel}`}
                            onClick={() => onOpen(item.panel)}
                            className={`flex min-w-0 items-center justify-between gap-1 rounded-lg border px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                                active ? "border-sky-300/40 bg-sky-400/[0.12]" : "border-white/[0.06] bg-white/[0.02] active:bg-white/[0.05]"
                            }`}
                        >
                            <span className={`truncate text-xs font-medium tabular-nums ${item.valueClassName}`}>
                                <MoneyText label={item.valueLabel} />
                            </span>
                            <span className={`shrink-0 rounded px-1 text-[10px] tabular-nums ${active ? "bg-sky-400/20 text-sky-100" : "bg-white/[0.04] text-white/45"}`}>{item.countLabel}</span>
                        </button>
                    );
                })}
            </div>
        </li>
    );
}

export function MobilePlanning() {
    const planning = usePlanningPage();
    const { projection, selectedMonth, selectedPanel, compareMode, handleSelectPanel } = planning;
    const [searchParams] = useSearchParams();
    // Arriving from the wishlist (?panel=projections) opens the month's details right away.
    const [drawerOpen, setDrawerOpen] = useState(() => searchParams.has("panel"));
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const currentIndex = projection.months.findIndex((month) => month.isCurrentMonth);

    return (
        <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
                <MobileAccountCombobox
                    label="Carteiras"
                    placeholder="Carteiras"
                    emptyMessage="Nenhuma carteira encontrada."
                    accounts={planning.wallets}
                    values={planning.timelineSelectedWalletIds}
                    onChange={planning.handleTimelineWalletIdsChange}
                />
                <MobileAccountCombobox
                    label="Cartões"
                    placeholder="Cartões"
                    emptyMessage="Nenhum cartão encontrado."
                    accounts={planning.creditCards}
                    values={planning.timelineSelectedCreditCardIds}
                    onChange={planning.handleTimelineCreditCardIdsChange}
                />
            </div>

            <div>
                {/* Column headers mirror the row layout, so rows don't repeat their labels. */}
                <div className="rounded-xl bg-white/[0.03] px-2 py-2.5">
                    <div className="flex justify-between px-1">
                        <span className={LABEL_CLASS}>Mês</span>
                        <span className={LABEL_CLASS}>Saldo final</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {COLUMNS.map(({ panel, icon: Icon, className }) => (
                            <span key={panel} className={`flex items-center justify-center gap-1.5 ${LABEL_CLASS}`}>
                                <Icon size={13} className={`shrink-0 ${className}`} />
                                {PANEL_TITLE[panel]}
                            </span>
                        ))}
                    </div>
                </div>

                <ul>
                    {projection.months.map((month, index) => (
                        <MonthRow
                            key={month.monthKey}
                            month={month}
                            compareMode={compareMode}
                            isPast={index < currentIndex}
                            activePanel={drawerOpen && selectedMonth?.monthKey === month.monthKey ? selectedPanel : null}
                            onOpen={(panel) => {
                                handleSelectPanel(month.monthKey, panel);
                                setDrawerOpen(true);
                            }}
                        />
                    ))}
                </ul>
            </div>

            <MobileDrawer
                open={drawerOpen}
                onClose={closeDrawer}
                title={selectedMonth ? `${PANEL_TITLE[selectedPanel]} de ${selectedMonth.monthLabel}` : PANEL_TITLE[selectedPanel]}
            >
                <PlanningDetailsAside
                    selectedMonth={selectedMonth}
                    fallbackMonth={planning.currentMonth}
                    selectedPanel={selectedPanel}
                    activeWishItems={planning.activeWishItems}
                    wishlistSelectionByWishItemId={planning.wishlistSelectionByWishItemId}
                    onAddIncome={(month) => planning.openSimulationModal(month, "income")}
                    onDeleteExpense={planning.handleDeleteExpense}
                    onDeleteIncome={planning.handleDeleteIncome}
                    onEditExpense={planning.openExpenseEditModal}
                    onEditIncome={planning.openIncomeEditModal}
                    onEditWishlistItem={planning.openWishlistItemOnWishlistPage}
                    onOpenTransaction={planning.openTransactionOnTransactionsPage}
                    onOpenInvoice={planning.openInvoiceOnStatementPage}
                    onMoveInvoice={planning.openInvoiceMonthModal}
                    onRestoreInvoiceMonth={(invoiceId) => planning.setInvoiceMonthOverride(invoiceId, null)}
                    onToggleExpense={planning.handleToggleSimulatedExpense}
                    onToggleIncome={planning.handleToggleIncome}
                    onToggleSimulatedIncome={planning.handleToggleSimulatedIncome}
                    onToggleInheritedExpense={planning.handleToggleInheritedExpense}
                    onToggleWishlistSelection={planning.handleToggleWishlistSelection}
                />
            </MobileDrawer>
        </div>
    );
}
