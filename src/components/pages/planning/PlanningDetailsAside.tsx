import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Columns3Cog, CreditCard as CreditCardIcon, Gift, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { PlanningWishlistSelection, WishItem } from "../../../context/FinanceContext";
import { PLANNING_ENTRANCE_EASE } from "./planningEntranceMotion";
import type { IncomeItem, InheritedExpenseItem, MonthProjection, PlanningPanel, SimulatedExpenseItem, SimulatedIncomeItem } from "./planningTimelineTypes";
import { getAmountClassName } from "./planningTimelineUtils";
import { PlanningDetailsSection } from "./PlanningDetailsSection";
import { PlanningListRow } from "./PlanningListRow";
import { PlanningProjectionContextMenu, type PlanningProjectionContextMenuState } from "./PlanningProjectionContextMenu";
import { buildPlanningProjectionContextActions, type PlanningProjectionContextAction } from "./planningProjectionContextActions";
import { PlanningToggleRow } from "./PlanningToggleRow";

interface PlanningDetailsAsideProps {
    selectedMonth: MonthProjection | null;
    fallbackMonth: MonthProjection | null;
    selectedPanel: PlanningPanel;
    activeWishItems: WishItem[];
    wishlistSelectionByWishItemId: Map<string, PlanningWishlistSelection>;
    onAddIncome: (month: MonthProjection) => void;
    onDeleteExpense: (expenseId: string) => void;
    onDeleteIncome: (income: SimulatedIncomeItem) => void;
    onEditExpense: (expense: SimulatedExpenseItem) => void;
    onEditIncome: (income: SimulatedIncomeItem) => void;
    onEditWishlistItem: (wishItemId: string) => void;
    onOpenTransaction: (transactionId: string) => void;
    onToggleExpense: (expenseId: string) => void;
    onToggleIncome: (incomeId: string) => void;
    onToggleSimulatedIncome: (income: SimulatedIncomeItem) => void;
    onToggleInheritedExpense: (expenseId: string) => void;
    onToggleWishlistSelection: (wishItemId: string) => void;
}

type PlanningProjectionContextTarget =
    | {
          itemType: "income";
          variant: "normal";
          item: IncomeItem;
      }
    | {
          itemType: "income";
          variant: "projected";
          item: SimulatedIncomeItem;
      }
    | {
          itemType: "expense";
          variant: "normal";
          item: InheritedExpenseItem;
      }
    | {
          itemType: "expense";
          variant: "projected";
          item: SimulatedExpenseItem;
      }
    | {
          itemType: "wishlist";
          wishItemId: string;
          isActive: boolean;
      };

type PlanningProjectionContextState = PlanningProjectionContextMenuState & {
    target: PlanningProjectionContextTarget;
};

function getPanelTitle(panel: PlanningPanel): string {
    if (panel === "income") {
        return "Receitas";
    }

    if (panel === "inherited_expenses") {
        return "Despesas";
    }

    return "Projeções";
}

export function PlanningDetailsAside({
    selectedMonth,
    fallbackMonth,
    selectedPanel,
    activeWishItems,
    wishlistSelectionByWishItemId,
    onAddIncome,
    onDeleteExpense,
    onDeleteIncome,
    onEditExpense,
    onEditIncome,
    onEditWishlistItem,
    onOpenTransaction,
    onToggleExpense,
    onToggleIncome,
    onToggleSimulatedIncome,
    onToggleInheritedExpense,
    onToggleWishlistSelection,
}: PlanningDetailsAsideProps) {
    const shouldReduceMotion = useReducedMotion();
    const [contextMenuState, setContextMenuState] = useState<PlanningProjectionContextState | null>(null);
    const selectedPanelTitle = getPanelTitle(selectedPanel);
    const contextMenuActions = useMemo(() => {
        if (!contextMenuState) {
            return [];
        }

        const target = contextMenuState.target;
        const isActive = target.itemType === "wishlist" ? target.isActive : !target.item.isDisabled;
        const isNormalItem = target.itemType !== "wishlist" && target.variant === "normal";
        const isNormalExpenseInvoice = isNormalItem && target.itemType === "expense" && target.item.source === "invoice";

        return buildPlanningProjectionContextActions({
            itemType: target.itemType,
            isActive,
            canEdit: !isNormalExpenseInvoice,
            canRemove: !isNormalItem && target.itemType !== "wishlist",
            editLabel: isNormalItem ? (target.itemType === "income" ? "Abrir receita" : "Abrir despesa") : undefined,
        });
    }, [contextMenuState]);

    useEffect(() => {
        setContextMenuState(null);
    }, [selectedMonth?.monthKey, selectedPanel]);

    const handleProjectionContextMenu = (event: MouseEvent, target: PlanningProjectionContextTarget) => {
        event.preventDefault();
        setContextMenuState({
            itemId: target.itemType === "wishlist" ? target.wishItemId : target.item.id,
            target,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const handleProjectionContextActionSelect = (action: PlanningProjectionContextAction) => {
        if (!contextMenuState) {
            return;
        }

        const target = contextMenuState.target;
        setContextMenuState(null);

        if (target.itemType === "income") {
            if (action.id === "toggle") {
                if (target.variant === "normal") {
                    onToggleIncome(target.item.id);
                    return;
                }

                onToggleSimulatedIncome(target.item);
                return;
            }
            if (action.id === "edit") {
                if (target.variant === "normal") {
                    onOpenTransaction(target.item.transactionId);
                    return;
                }

                onEditIncome(target.item);
                return;
            }
            if (target.variant === "projected" && action.id === "remove") {
                onDeleteIncome(target.item);
            }
            return;
        }

        if (target.itemType === "expense") {
            if (action.id === "toggle") {
                if (target.variant === "normal") {
                    onToggleInheritedExpense(target.item.id);
                    return;
                }

                onToggleExpense(target.item.id);
                return;
            }
            if (action.id === "edit") {
                if (target.variant === "normal") {
                    if (target.item.transactionId) {
                        onOpenTransaction(target.item.transactionId);
                    }
                    return;
                }

                onEditExpense(target.item);
                return;
            }
            if (target.variant === "projected" && action.id === "remove") {
                onDeleteExpense(target.item.id);
            }
            return;
        }

        if (action.id === "toggle") {
            onToggleWishlistSelection(target.wishItemId);
            return;
        }

        if (action.id === "edit") {
            onEditWishlistItem(target.wishItemId);
        }
    };

    const renderContent = () => {
        if (!selectedMonth) {
            return <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/52">Nenhum mês disponivel.</p>;
        }

        if (selectedPanel === "income") {
            return (
                <>
                    {selectedMonth.incomeItems.length === 0 ? <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Nenhuma receita neste mês.</p> : null}
                    {selectedMonth.incomeItems.map((item) => (
                        <PlanningToggleRow
                            key={item.id}
                            toggleId={item.id}
                            label={item.label}
                            amount={item.amount}
                            iconName={item.iconName}
                            iconTone="income"
                            active={!item.isDisabled}
                            onToggle={onToggleIncome}
                            onContextMenu={(event) =>
                                handleProjectionContextMenu(event, {
                                    itemType: "income",
                                    variant: "normal",
                                    item,
                                })
                            }
                        />
                    ))}
                </>
            );
        }

        if (selectedPanel === "inherited_expenses") {
            return (
                <>
                    {selectedMonth.inheritedItems.length === 0 ? <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Você não tem despesas nesse mês.</p> : null}
                    {selectedMonth.inheritedItems.map((item) => (
                        <PlanningToggleRow
                            key={item.id}
                            toggleId={item.id}
                            label={item.label}
                            amount={item.amount}
                            iconName={item.iconName}
                            iconTone="expense"
                            active={!item.isDisabled}
                            onToggle={onToggleInheritedExpense}
                            customIcon={item.source === "invoice" ? CreditCardIcon : undefined}
                            onContextMenu={(event) =>
                                handleProjectionContextMenu(event, {
                                    itemType: "expense",
                                    variant: "normal",
                                    item,
                                })
                            }
                        />
                    ))}
                </>
            );
        }

        const hasSimulatedIncomes = selectedMonth.simulatedIncomeItems.length > 0;
        const hasSimulatedExpenses = selectedMonth.simulatedExpenseItems.length > 0;
        const hasWishlistItems = activeWishItems.length > 0;
        const hasProjectionItems = hasSimulatedIncomes || hasSimulatedExpenses || hasWishlistItems;

        return (
            <>
                {!hasProjectionItems ? <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Você não criou nenhuma projeção nesse mês.</p> : null}

                {hasSimulatedIncomes ? (
                    <PlanningDetailsSection title="Receitas" tone="income">
                        {selectedMonth.simulatedIncomeItems.map((item) => (
                            <PlanningListRow
                                key={item.id}
                                active={!item.isDisabled}
                                label={item.label}
                                amount={item.amount}
                                iconName={item.iconName}
                                iconTone="income"
                                customIcon={ArrowUpRight}
                                valueClassName={getAmountClassName("income", item.amount)}
                                onClick={item.source === "simulated_income" ? () => onToggleSimulatedIncome(item) : undefined}
                                onContextMenu={
                                    item.source === "simulated_income"
                                        ? (event) =>
                                              handleProjectionContextMenu(event, {
                                                  itemType: "income",
                                                  variant: "projected",
                                                  item,
                                              })
                                        : undefined
                                }
                            />
                        ))}
                    </PlanningDetailsSection>
                ) : null}

                {hasSimulatedExpenses ? (
                    <PlanningDetailsSection title="Despesas" tone="expense">
                        {selectedMonth.simulatedExpenseItems.map((expense) => (
                            <PlanningListRow
                                key={expense.id}
                                active={!expense.isDisabled}
                                label={expense.description}
                                amount={expense.amount}
                                iconName={null}
                                iconTone="expense"
                                customIcon={ArrowDownRight}
                                valueClassName={getAmountClassName("simulation", expense.amount)}
                                onClick={() => onToggleExpense(expense.id)}
                                onContextMenu={(event) =>
                                    handleProjectionContextMenu(event, {
                                        itemType: "expense",
                                        variant: "projected",
                                        item: expense,
                                    })
                                }
                            />
                        ))}
                    </PlanningDetailsSection>
                ) : null}

                {hasWishlistItems ? (
                    <PlanningDetailsSection title="Lista de Desejos" tone="wishlist">
                        {activeWishItems.map((item) => {
                            const selection = wishlistSelectionByWishItemId.get(item.id);
                            return (
                                <PlanningToggleRow
                                    key={item.id}
                                    toggleId={item.id}
                                    label={item.description.trim() || "Desejo"}
                                    amount={item.value}
                                    iconName={null}
                                    iconTone="wishlist"
                                    customIcon={Gift}
                                    active={selection?.monthKey === selectedMonth.monthKey}
                                    onToggle={onToggleWishlistSelection}
                                    onContextMenu={(event) =>
                                        handleProjectionContextMenu(event, {
                                            itemType: "wishlist",
                                            wishItemId: item.id,
                                            isActive: selection?.monthKey === selectedMonth.monthKey,
                                        })
                                    }
                                />
                            );
                        })}
                    </PlanningDetailsSection>
                ) : null}
            </>
        );
    };

    return (
        <>
            <motion.aside
                initial={shouldReduceMotion ? false : { opacity: 0, x: 20, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: shouldReduceMotion ? 0 : 0.28, duration: 0.55, ease: PLANNING_ENTRANCE_EASE }}
                className="flex max-h-[calc(100vh-2rem)] w-full shrink-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#111111] p-3 text-left xl:sticky xl:top-4 xl:max-w-[360px]"
            >
            <div className="shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2 items-center">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/12 text-fuchsia-200">
                            <Columns3Cog size={18} />
                        </span>
                        <div>
                            <p className="text-lg font-medium text-white">{selectedPanelTitle}</p>
                            <p className="text-xs text-white/42">{selectedMonth?.monthLabel ?? fallbackMonth?.monthLabel ?? "Mês atual"}</p>
                        </div>
                    </div>
                    <div>
                        {selectedPanel === "projections" && selectedMonth ? (
                            <button
                                type="button"
                                onClick={() => onAddIncome(selectedMonth)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-medium uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/16"
                            >
                                <Plus size={13} />
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className={`elegant-scrollbar mt-4 flex min-h-0 max-h-165 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-1 ${selectedPanel === "projections" ? "gap-3" : "gap-1"}`}>
                {renderContent()}
            </div>
            </motion.aside>
            <PlanningProjectionContextMenu state={contextMenuState} actions={contextMenuActions} onSelect={handleProjectionContextActionSelect} onClose={() => setContextMenuState(null)} />
        </>
    );
}
