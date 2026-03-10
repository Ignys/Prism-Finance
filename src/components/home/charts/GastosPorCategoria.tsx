import { ChartOptions, TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useFinanceTransactions } from "../../../context/FinanceContext";

export function GastosPorCategoria() {
    const transactions = useFinanceTransactions();

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(currentDate);

    const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const categoryData = Array.from(
        new Set(currentMonthTransactions.filter((tx) => tx.type === "spending").map((tx) => tx.category.principal))
    ).map((category) => ({
        category,
        value: currentMonthTransactions
            .filter((tx) => tx.type === "spending" && tx.category.principal === category)
            .reduce((sum, tx) => sum + tx.value, 0),
    }));

    const sortedCategories = categoryData.sort((a, b) => b.value - a.value);
    const top5Categories = sortedCategories.slice(0, 5);
    const otherCategories = sortedCategories.slice(5);
    const otherValue = otherCategories.reduce((sum, cat) => sum + cat.value, 0);

    const finalCategories = otherValue > 0
        ? [...top5Categories, { category: "Outros", value: otherValue }]
        : top5Categories;

    const totalGastos = finalCategories.reduce((sum, cat) => sum + cat.value, 0);

    const colors = [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#22c55e",
        "#06b6d4",
        "#64748b",
    ];

    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const formatPercent = (value: number) => (totalGastos > 0 ? ((value / totalGastos) * 100).toFixed(1) : "0.0");

    const despesasPorCategoria = {
        labels: finalCategories.map((cat) => cat.category),
        datasets: [
            {
                label: "Despesas",
                data: finalCategories.map((cat) => cat.value),
                backgroundColor: colors,
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

    const biggestCategory = finalCategories[0];

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className="pointer-events-none absolute -left-20 -top-24 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-20 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-medium text-white">Gastos por categoria</p>
                <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.12em] text-neutral-300">
                    {monthLabel}
                </span>
            </div>

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="mx-auto h-[190px] w-[190px] rounded-xl border border-white/[0.06] bg-black/20 p-2 lg:mx-0">
                    {totalGastos > 0 ? (
                        <Doughnut data={despesasPorCategoria} options={doughnutOptions} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.08em] text-neutral-500">
                            Sem dados
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-2">
                    {finalCategories.length > 0 ? (
                        finalCategories.map((cat, index) => (
                            <div key={cat.category} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index] }} />
                                    <span className="truncate text-sm text-neutral-200">{cat.category}</span>
                                </div>
                                <div className="ml-3 flex items-center gap-3 text-sm">
                                    <span className="text-neutral-400">{formatPercent(cat.value)}%</span>
                                    <span className="font-semibold text-white">R$ {formatCurrency(cat.value)}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-neutral-400">
                            Nenhuma despesa registrada neste mes.
                        </div>
                    )}

                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-300">Total</span>
                            <span className="text-base font-bold text-white">R$ {formatCurrency(totalGastos)}</span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">
                            {biggestCategory
                                ? `Maior categoria: ${biggestCategory.category} (${formatPercent(biggestCategory.value)}%)`
                                : "Adicione despesas para ver a distribuicao."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
