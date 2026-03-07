import { Bar } from "react-chartjs-2";
import { useFinanceTransactions } from "../../../context/FinanceContext";

export function BalancoMensal() {
    const transactions = useFinanceTransactions();

    // Obter mês e ano atuais
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Filtrar transações do mês atual
    const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const incomes = currentMonthTransactions
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + tx.value, 0);

    const spending = currentMonthTransactions
        .filter((tx) => tx.type === "spending")
        .reduce((sum, tx) => sum + tx.value, 0);

    const balance = incomes - spending;

    const mensalBarData = {
        labels: ["Receitas", "Despesas"],
        datasets: [
            {
                label: "Valor",
                data: [incomes, spending],
                backgroundColor: ["#10b981", "#ef4444"],
                borderRadius: 8,
                borderSkipped: false,
                barPercentage: 0.6,
            },
        ],
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                padding: 12,
                titleColor: "#ffffff",
                bodyColor: "#ffffff",
                borderColor: "#374151",
                borderWidth: 1,
                displayColors: false,
                callbacks: {
                    label: function (context: any) {
                        return "R$ " + context.parsed.y.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        });
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: "#a3a3a3",
                    font: {
                        size: 13,
                        weight: "normal",
                    },
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: "rgba(163, 163, 163, 0.1)",
                    drawBorder: false,
                },
                ticks: {
                    color: "#737373",
                    font: {
                        size: 12,
                    },
                    callback: function (value: any) {
                        return "R$ " + value.toLocaleString("pt-BR");
                    },
                },
            },
        },
    };

    return (
        <div className="w-full bg-[#1e1e1e] p-6 rounded-2xl shadow-lg">
            <p className="text-white text-lg font-medium mb-6">Balanço mensal</p>
            <div className="flex gap-8 items-center">
                {/* Gráfico de Barras */}
                <div className="w-[400px] h-[200px]">
                    <Bar data={mensalBarData} options={barOptions} />
                </div>

                {/* Informações do Balanço */}
                <div className="flex-1 space-y-3">
                    {/* Receitas */}
                    <div className="flex items-center justify-between group hover:bg-neutral-800/50 p-3 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0" />
                            <span className="text-neutral-200 font-medium text-sm">Receitas</span>
                        </div>
                        <span className="text-green-400 font-semibold text-sm">
                            R$ {incomes.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                    </div>

                    {/* Despesas */}
                    <div className="flex items-center justify-between group hover:bg-neutral-800/50 p-3 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="text-neutral-200 font-medium text-sm">Despesas</span>
                        </div>
                        <span className="text-red-400 font-semibold text-sm">
                            R$ {spending.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                    </div>

                    {/* Separador */}
                    <div className="pt-3 mt-3 border-t border-neutral-700">
                        {/* Balanço Final */}
                        <div className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg">
                            <span className="text-neutral-300 font-semibold">Balanço</span>
                            <span className={`font-bold text-lg ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                                R$ {balance.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
