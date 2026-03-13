import { ChartOptions, ScriptableContext } from "chart.js";
import { Bar } from "react-chartjs-2";
import { useFinanceTransactions } from "../../../context/FinanceContext";

export function BalancoMensal() {
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

    const incomes = currentMonthTransactions
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + tx.value, 0);

    const spending = currentMonthTransactions
        .filter((tx) => tx.type === "spending")
        .filter((t) => !t.status || t.status !== "cancelled")
        .reduce((sum, tx) => sum + tx.value, 0);

    const balance = incomes - spending;
    const totalFlow = incomes + spending;
    const incomeShare = totalFlow > 0 ? (incomes / totalFlow) * 100 : 0;
    const spendingShare = totalFlow > 0 ? (spending / totalFlow) * 100 : 0;

    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const buildGradient = (context: ScriptableContext<"bar">, from: string, to: string) => {
        const chart = context.chart;
        const area = chart.chartArea;

        if (!area) {
            return from;
        }

        const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        gradient.addColorStop(0, from);
        gradient.addColorStop(1, to);
        return gradient;
    };

    const mensalBarData = {
        labels: ["Receitas", "Despesas"],
        datasets: [
            {
                label: "Valor",
                data: [incomes, spending],
                backgroundColor: (context: ScriptableContext<"bar">) =>
                    context.dataIndex === 0
                        ? buildGradient(context, "rgba(52, 211, 153, 0.95)", "rgba(16, 185, 129, 0.5)")
                        : buildGradient(context, "rgba(248, 113, 113, 0.95)", "rgba(239, 68, 68, 0.5)"),
                borderColor: (context: ScriptableContext<"bar">) => (context.dataIndex === 0 ? "#34d399" : "#f87171"),
                borderWidth: 1,
                borderRadius: 12,
                borderSkipped: false,
                barThickness: 42,
                hoverBorderWidth: 1.5,
            },
        ],
    };

    const barOptions: ChartOptions<"bar"> = {
        responsive: true,
        maintainAspectRatio: false,
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
                padding: 14,
                titleColor: "#ffffff",
                bodyColor: "#e5e7eb",
                borderColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: 1,
                displayColors: false,
                cornerRadius: 10,
                callbacks: {
                    title: function (context) {
                        return context[0]?.label ?? "";
                    },
                    label: function (context) {
                        return "R$ " + formatCurrency(Number(context.parsed.y ?? 0));
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: "#d4d4d4",
                    font: {
                        size: 12,
                        weight: 600,
                    },
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: "rgba(163, 163, 163, 0.12)",
                    drawTicks: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: "#a3a3a3",
                    font: {
                        size: 11,
                    },
                    callback: function (value) {
                        return "R$ " + formatCurrency(Number(value));
                    },
                },
            },
        },
    };

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className={`pointer-events-none absolute -left-20 -top-24 h-44 w-44 rounded-full  blur-3xl ${
                            balance >= 0 ? " bg-emerald-400/[0.10]" : " bg-red-500/[0.08]"
                        }`} />
            <div className={`pointer-events-none absolute -bottom-24 -right-20 h-44 w-44 rounded-full  blur-3xl ${
                            balance >= 0 ? " bg-emerald-400/[0.10]" : " bg-red-500/[0.08]"
                        }`} />

            <div className="relative mb-5 flex items-center justify-between gap-3">
                <p className="text-lg font-medium text-white">Balanço mensal</p>
                <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.12em] text-neutral-300">
                    {monthLabel}
                </span>
            </div>

            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-stretch">
                <div className="h-[230px] w-full rounded-xl border border-white/[0.06] bg-black/20 p-3 xl:w-[58%]">
                    <Bar data={mensalBarData} options={barOptions} />
                </div>

                <div className="flex-1 space-y-3">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                <span className="text-sm font-medium text-neutral-200">Receitas</span>
                            </div>
                            <span className="text-sm font-semibold text-emerald-300">{incomeShare.toFixed(1)}%</span>
                        </div>
                        <div className="mb-2 h-1.5 w-full rounded-full bg-black/30">
                            <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${incomeShare}%` }} />
                        </div>
                        <p className="text-sm font-semibold text-emerald-300">R$ {formatCurrency(incomes)}</p>
                    </div>

                    <div className="rounded-xl border border-red-400/20 bg-red-500/[0.08] p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                                <span className="text-sm font-medium text-neutral-200">Despesas</span>
                            </div>
                            <span className="text-sm font-semibold text-red-300">{spendingShare.toFixed(1)}%</span>
                        </div>
                        <div className="mb-2 h-1.5 w-full rounded-full bg-black/30">
                            <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${spendingShare}%` }} />
                        </div>
                        <p className="text-sm font-semibold text-red-300">R$ {formatCurrency(spending)}</p>
                    </div>

                    <div
                        className={`rounded-xl border p-3 ${
                            balance >= 0 ? "border-emerald-500/30 bg-emerald-500/[0.08]" : "border-red-500/30 bg-red-500/[0.08]"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-neutral-300">Saldo do mes</span>
                        </div>
                        <span className={`mt-1 block text-xl font-bold ${balance >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            R$ {formatCurrency(balance)}
                        </span>
                        <p className="mt-1 text-xs text-neutral-400">
                            {totalFlow > 0 ? `${currentMonthTransactions.length} transacoes no periodo` : "Sem transacoes neste mes"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
