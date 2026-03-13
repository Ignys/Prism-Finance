import { useMemo, useState } from "react";
import { ChartOptions, TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useFinanceCategories, useFinanceTransactions } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { motion } from "framer-motion";
import { parseAppDate } from "../../../lib/localDate";

type BreakdownMode = "category" | "category-with-subcategories";

interface CategoryChartItem {
    key: string;
    label: string;
    value: number;
    color: string;
    icon: string;
    type: "income" | "expense";
}

export function GastosPorCategoria() {
    const transactions = useFinanceTransactions();
    const categories = useFinanceCategories();
    const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("category");

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(currentDate);

    const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = parseAppDate(t.date);
        if (!transactionDate) {
            return false;
        }
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const spendingTransactions = currentMonthTransactions.filter((tx) => tx.type === "spending").filter((t) => !t.status || t.status !== "cancelled");

    const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

    const finalCategories = useMemo(() => {
        const categoryTotals = new Map<string, CategoryChartItem>();

        spendingTransactions.forEach((transaction) => {
            const resolvedCategory = transaction.category.id ? categoriesById.get(transaction.category.id) : null;
            const parentCategory = resolvedCategory?.parentId ? categoriesById.get(resolvedCategory.parentId) : null;

            const targetCategory = breakdownMode === "category" && parentCategory ? parentCategory : resolvedCategory;
            const fallbackLabel = breakdownMode === "category" && transaction.category.parentLabel ? transaction.category.parentLabel : transaction.category.label;

            const key = targetCategory ? `id:${targetCategory.id}` : `fallback:${fallbackLabel}`;
            const current = categoryTotals.get(key);

            if (current) {
                current.value += transaction.value;
                return;
            }

            categoryTotals.set(key, {
                key,
                label: targetCategory?.name ?? fallbackLabel,
                value: transaction.value,
                color: targetCategory?.color ?? transaction.category.color ?? "#6B7280",
                icon: targetCategory?.icon ?? transaction.category.icon,
                type: targetCategory?.type ?? transaction.category.type,
            });
        });

        return Array.from(categoryTotals.values()).sort((a, b) => b.value - a.value);
    }, [breakdownMode, categoriesById, spendingTransactions]);

    const totalGastos = finalCategories.reduce((sum, cat) => sum + cat.value, 0);

    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const formatPercent = (value: number) => (totalGastos > 0 ? ((value / totalGastos) * 100).toFixed(1) : "0.0");

    const despesasPorCategoria = {
        labels: finalCategories.map((cat) => cat.label),
        datasets: [
            {
                label: "Despesas",
                data: finalCategories.map((cat) => cat.value),
                backgroundColor: finalCategories.map((cat) => cat.color),
                borderWidth: 0,
                hoverOffset: 6,
                spacing: 2,
            },
        ],
    };

    const doughnutOptions: ChartOptions<"doughnut"> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        animation: {
            duration: 850,
            easing: "easeOutQuart",
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: "rgba(10, 10, 10, 0.96)",
                padding: 12,
                titleColor: "#ffffff",
                bodyColor: "#e5e7eb",
                borderColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: 1,
                cornerRadius: 10,
                callbacks: {
                    label: function (context: TooltipItem<"doughnut">) {
                        const value = Number(context.parsed ?? 0);
                        const percentage = formatPercent(value);
                        return `R$ ${formatCurrency(value)} (${percentage}%)`;
                    },
                },
            },
        },
    };

    const biggestCategoryValue = finalCategories[0]

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className={`pointer-events-none absolute -left-20 -top-24 h-40 w-40 rounded-full ${!biggestCategoryValue && "bg-neutral-500"} opacity-15 blur-3xl`} style={{ backgroundColor: biggestCategoryValue?.color }} />
            <div className={`pointer-events-none absolute -bottom-24 -right-20 h-40 w-40 rounded-full ${!biggestCategoryValue && "bg-neutral-500"} opacity-15 blur-3xl`} style={{ backgroundColor: biggestCategoryValue?.color }} />

            <div className="relative mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-medium text-white">Gastos por categoria</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Alternar visualizacao entre categorias e subcategorias"
                        aria-pressed={breakdownMode === "category-with-subcategories"}
                        onClick={() => setBreakdownMode((current) => (current === "category" ? "category-with-subcategories" : "category"))}
                        className="flex justify-between items-center px-1.5  rounded-full border border-white/[0.18] bg-white/[0.03] p-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300 transition-colors hover:border-white/[0.3] hover:bg-white/[0.08]"
                    >
                        <motion.span className="relative z-10 px-2" animate={{ color: breakdownMode === "category" ? "#ffffff" : "#a3a3a3" }} transition={{ duration: 0.2 }}>
                            Categorias
                        </motion.span>
                        <motion.span className="relative z-10 px-2" animate={{ color: breakdownMode === "category-with-subcategories" ? "#ffffff" : "#a3a3a3" }} transition={{ duration: 0.2 }}>
                            Subcategorias
                        </motion.span>
                    </button>
                    <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.12em] text-neutral-300">{monthLabel}</span>
                </div>
            </div>

            <div className="relative flex flex-col gap-4 lg:flex-row">
                <div className="mx-auto h-[250px] w-[250px] rounded-xl border border-white/[0.06] bg-black/20 p-2 lg:mx-0">
                    {totalGastos > 0 ? (
                        <Doughnut data={despesasPorCategoria} options={doughnutOptions} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.08em] text-neutral-500">Sem dados</div>
                    )}
                </div>

                <div className="flex-1 space-y-2">
                    {finalCategories.length > 0 ? (
                        finalCategories.map((cat) => {
                            const CategoryIcon = getCategoryIconComponent(cat.icon, cat.type);

                            return (
                                <div key={cat.key} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.1]"
                                            style={{ color: cat.color, backgroundColor: "rgba(255, 255, 255, 0.04)" }}
                                        >
                                            <CategoryIcon size={13} />
                                        </span>
                                        <span className="truncate text-sm text-neutral-200">{cat.label}</span>
                                    </div>
                                    <div className="ml-3 flex items-center gap-3 text-sm">
                                        <span className="text-neutral-400">{formatPercent(cat.value)}%</span>
                                        <span className="font-semibold text-white">R$ {formatCurrency(cat.value)}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-neutral-400">Nenhuma despesa registrada neste mes.</div>
                    )}

                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-base font-medium text-neutral-200">Total</span>
                            <span className="text-base font-bold text-white">R$ {formatCurrency(totalGastos)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
