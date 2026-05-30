import { Columns3Cog, CreditCard as CreditCardIcon, Plus } from "lucide-react";
import type { PlanningWishlistSelection, WishItem } from "../../../context/FinanceContext";
import type { MonthProjection, PlanningPanel, SimulatedIncomeItem } from "./planningTimelineTypes";
import { getAmountClassName } from "./planningTimelineUtils";
import { PlanningListRow } from "./PlanningListRow";
import { PlanningToggleRow } from "./PlanningToggleRow";

interface PlanningDetailsAsideProps {
    selectedMonth: MonthProjection | null;
    fallbackMonth: MonthProjection | null;
    selectedPanel: PlanningPanel;
    activeWishItems: WishItem[];
    categoryIconById: Map<string, string>;
    wishlistSelectionByWishItemId: Map<string, PlanningWishlistSelection>;
    onAddIncome: (month: MonthProjection) => void;
    onDeleteExpense: (expenseId: string) => void;
    onDeleteIncome: (income: SimulatedIncomeItem) => void;
    onToggleIncome: (incomeId: string) => void;
    onToggleInheritedExpense: (expenseId: string) => void;
    onToggleWishlistSelection: (wishItemId: string) => void;
}

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
    categoryIconById,
    wishlistSelectionByWishItemId,
    onAddIncome,
    onDeleteExpense,
    onDeleteIncome,
    onToggleIncome,
    onToggleInheritedExpense,
    onToggleWishlistSelection,
}: PlanningDetailsAsideProps) {
    const selectedPanelTitle = getPanelTitle(selectedPanel);

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
                    <section className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/42">Receitas</p>
                        <div className="space-y-1">
                            {selectedMonth.simulatedIncomeItems.map((item) => (
                                <PlanningListRow
                                    key={item.id}
                                    label={item.label}
                                    amount={item.amount}
                                    iconName={item.iconName}
                                    iconTone="income"
                                    valueClassName={getAmountClassName("income", item.amount)}
                                    onDelete={() => onDeleteIncome(item)}
                                    deleteLabel="Remover receita simulada"
                                />
                            ))}
                        </div>
                    </section>
                ) : null}

                {hasSimulatedExpenses ? (
                    <section className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/42">Despesas</p>
                        <div className="space-y-1">
                            {selectedMonth.simulatedExpenseItems.map((expense) => (
                                <PlanningListRow
                                    key={expense.id}
                                    label={expense.description}
                                    amount={expense.amount}
                                    iconName={null}
                                    iconTone="expense"
                                    valueClassName={getAmountClassName("simulation", expense.amount)}
                                    onDelete={() => onDeleteExpense(expense.id)}
                                    deleteLabel="Remover gasto simulado"
                                />
                            ))}
                        </div>
                    </section>
                ) : null}

                {hasWishlistItems ? (
                    <section className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/42">Lista de Desejos</p>
                        <div className="space-y-1">
                            {activeWishItems.map((item) => {
                                const selection = wishlistSelectionByWishItemId.get(item.id);
                                return (
                                    <PlanningToggleRow
                                        key={item.id}
                                        toggleId={item.id}
                                        label={item.description.trim() || "Desejo"}
                                        amount={item.value}
                                        iconName={categoryIconById.get(item.categoryId) ?? null}
                                        iconTone="expense"
                                        active={selection?.monthKey === selectedMonth.monthKey}
                                        onToggle={onToggleWishlistSelection}
                                    />
                                );
                            })}
                        </div>
                    </section>
                ) : null}
            </>
        );
    };

    return (
        <aside className="flex max-h-[calc(100vh-6rem)] w-full max-w-[380px] shrink-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#111111] p-3 text-left shadow-[0_24px_60px_-36px_rgba(0,0,0,0.9)] xl:sticky xl:top-4">
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
        </aside>
    );
}
