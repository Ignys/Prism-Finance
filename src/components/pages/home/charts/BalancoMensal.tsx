import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { Line } from "react-chartjs-2";
import { type Transaction, useFinanceTransactions } from "../../../../context/FinanceContext";
import { transactionSettlementDate } from "../../../../lib/transactionSettlementDate";

const INCOME_COLOR = "#34d399";
const SPENDING_COLOR = "#fb7185";
const INVOICE_COLOR = "#fcd34d";

function areaFill(rgb: string) {
    return (context: ScriptableContext<"line">) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return "transparent";
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, `rgba(${rgb}, 0.22)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);
        return gradient;
    };
}

interface BalancoMensalProps {
    /** "AAAA-MM"; sem ele, o mês atual. */
    monthKey?: string;
    /** Já filtradas pelas carteiras desejadas; sem elas, todas. */
    transactions?: Transaction[];
    /** Esconde o mês e a frase "Sobrou x%" (o relatório já mostra o período). */
    hideCaptions?: boolean;
    className?: string;
}

export function BalancoMensal({ monthKey, transactions: scopedTransactions, hideCaptions = false, className = "" }: BalancoMensalProps = {}) {
    const allTransactions = useFinanceTransactions();
    const transactions = scopedTransactions ?? allTransactions;

    const now = new Date();
    const [keyYear, keyMonth] = (monthKey ?? "").split("-").map(Number);
    const currentDate = keyYear && keyMonth ? new Date(keyYear, keyMonth - 1, 1) : now;
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Mês passado mostra a linha inteira; o mês atual para em hoje.
    const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    const today = isCurrentMonth ? now.getDate() : daysInMonth;
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(currentDate);

    const dailyIncome = Array<number>(daysInMonth).fill(0);
    const dailySpending = Array<number>(daysInMonth).fill(0);
    const dailyInvoice = Array<number>(daysInMonth).fill(0);
    let incomes = 0;
    let spending = 0;
    let invoicePaymentSpending = 0;

    for (const transaction of transactions) {
        if (transaction.status !== "paid") continue;
        const date = transactionSettlementDate(transaction);
        if (!date || date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) continue;
        const day = date.getDate() - 1;
        if (transaction.type === "income") {
            dailyIncome[day] += transaction.value;
            incomes += transaction.value;
        } else if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card") {
            dailySpending[day] += transaction.value;
            spending += transaction.value;
            if (transaction.systemKind === "invoice_payment") {
                dailyInvoice[day] += transaction.value;
                invoicePaymentSpending += transaction.value;
            }
        }
    }

    const invoicePaymentSpendingInRange = Math.min(invoicePaymentSpending, spending);
    const monthlyRegularSpending = Math.max(0, spending - invoicePaymentSpendingInRange);
    const balance = incomes - spending;
    const positive = balance >= 0;
    const share = incomes > 0 ? Math.abs(balance / incomes) * 100 : null;
    const isEmpty = incomes <= 0 && spending <= 0;

    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    // Running totals up to today; future days stay empty so the lines stop at "now".
    const cumulative = (daily: number[]) => {
        let running = 0;
        return daily.map((value, index) => {
            running += value;
            return index < today ? running : null;
        });
    };
    const spendingLine = cumulative(dailySpending);

    const chartData: ChartData<"line", (number | null)[]> = {
        labels: Array.from({ length: daysInMonth }, (_, index) => String(index + 1)),
        datasets: [
            {
                label: "Entrou",
                data: cumulative(dailyIncome),
                borderColor: INCOME_COLOR,
                backgroundColor: areaFill("52, 211, 153"),
                fill: "origin",
                stepped: true,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            },
            {
                label: "Saiu",
                data: spendingLine,
                borderColor: SPENDING_COLOR,
                backgroundColor: areaFill("251, 113, 133"),
                fill: "origin",
                stepped: true,
                borderWidth: 2,
                pointRadius: dailyInvoice.map((value) => (value > 0 ? 4.5 : 0)),
                pointBackgroundColor: INVOICE_COLOR,
                pointBorderColor: "#111111",
                pointBorderWidth: 2,
                pointHoverRadius: 5,
            },
        ],
    };

    const chartOptions: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: "#525252",
                    font: { size: 11 },
                    autoSkip: false,
                    maxRotation: 0,
                    callback: (_value, index) => (index === 0 || index === today - 1 || index === daysInMonth - 1 ? String(index + 1) : ""),
                },
            },
            y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: "rgba(255, 255, 255, 0.04)" },
                ticks: { display: false, maxTicksLimit: 4 },
            },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(10, 10, 10, 0.96)",
                borderColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: 1,
                cornerRadius: 10,
                padding: 10,
                callbacks: {
                    title: (items) => `Até o dia ${items[0]?.label ?? ""}`,
                    label: (item) => ` ${item.dataset.label}: R$ ${formatCurrency(Number(item.raw ?? 0))}`,
                    afterBody: (items) => {
                        const invoice = dailyInvoice[items[0]?.dataIndex ?? -1];
                        return invoice ? `Fatura paga no dia: R$ ${formatCurrency(invoice)}` : "";
                    },
                },
            },
        },
    };

    const pills = [
        { label: "Receitas", value: incomes, color: INCOME_COLOR },
        { label: "Despesas", value: monthlyRegularSpending, color: SPENDING_COLOR },
        { label: "Faturas pagas", value: invoicePaymentSpendingInRange, color: INVOICE_COLOR },
    ];

    return (
        <div className={`w-full rounded-2xl border border-white/[0.08] bg-[#111111] p-4 sm:p-5 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-medium text-white">Balanço do mês</p>
                    {hideCaptions ? null : <p className="text-sm capitalize text-neutral-500">{monthLabel}</p>}
                </div>
                {!isEmpty && (
                    <div className="text-right">
                        <p className={`text-2xl font-semibold leading-none tabular-nums ${positive ? "text-emerald-300" : "text-rose-300"}`}>
                            {positive ? "+" : "−"} R$ {formatCurrency(Math.abs(balance))}
                        </p>
                        {hideCaptions ? null : (
                        <p className="mt-1 text-xs text-neutral-500">
                            {positive ? "Sobrou" : "Faltou"}
                            {share !== null && `, ${share.toFixed(0)}% ${positive ? "do que entrou" : "além do que entrou"}`}
                        </p>
                        )}
                    </div>
                )}
            </div>

            {isEmpty ? (
                <p className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-6 text-center text-sm text-neutral-400">Nenhuma receita ou despesa paga neste mês</p>
            ) : (
                <>
                    <div className="mt-4 h-44">
                        <Line data={chartData} options={chartOptions} />
                    </div>

                    <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        {pills.map((pill) => (
                            <li key={pill.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pill.color }} />
                                    {pill.label}
                                </span>
                                <span className={`mt-0.5 block text-sm font-semibold tabular-nums ${pill.value > 0 ? "text-white" : "text-neutral-600"}`}>
                                    R$ {formatCurrency(pill.value)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
