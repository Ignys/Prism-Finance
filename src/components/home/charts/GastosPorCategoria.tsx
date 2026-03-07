import { Pie } from "react-chartjs-2";
import { useFinanceTransactions } from "../../../context/FinanceContext";

export function GastosPorCategoria() {
    const transactions = useFinanceTransactions();

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Filtrar transações do mês atual
    const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    // Calcular gastos por categoria
    const categoryData = Array.from(
        new Set(currentMonthTransactions.filter((tx) => tx.type === "spending").map((tx) => tx.category.principal))
    ).map((category) => ({
        category,
        value: currentMonthTransactions
            .filter((tx) => tx.type === "spending" && tx.category.principal === category)
            .reduce((sum, tx) => sum + tx.value, 0),
    }));

    // Ordenar por valor e pegar top 5
    const sortedCategories = categoryData.sort((a, b) => b.value - a.value);
    const top5Categories = sortedCategories.slice(0, 5);
    const otherCategories = sortedCategories.slice(5);
    
    // Somar "Outros" se houver mais de 5 categorias
    const otherValue = otherCategories.reduce((sum, cat) => sum + cat.value, 0);
    
    // Preparar dados finais
    const finalCategories = otherValue > 0 
        ? [...top5Categories, { category: "Outros", value: otherValue }]
        : top5Categories;

    const totalGastos = finalCategories.reduce((sum, cat) => sum + cat.value, 0);

    const colors = [
        "#ef4444", // vermelho
        "#f59e0b", // laranja
        "#10b981", // verde
        "#3b82f6", // azul
        "#8b5cf6", // roxo
        "#64748b", // cinza para "Outros"
    ];

    const despesasPorCategoria = {
        labels: finalCategories.map((cat) => cat.category),
        datasets: [
            {
                label: "Despesas",
                data: finalCategories.map((cat) => cat.value),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 0,
            },
        ],
    };

    const pieOptions = {
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
                callbacks: {
                    label: function (context: any) {
                        const value = context.parsed;
                        const percentage = ((value / totalGastos) * 100).toFixed(1);
                        return `R$ ${value.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })} (${percentage}%)`;
                    },
                },
            },
        },
    };

    return (
        <div className="w-full bg-[#1e1e1e] p-6 rounded-2xl shadow-lg">
            <p className="text-white text-lg font-medium mb-6">Gastos por categoria</p>
            <div className="flex gap-8 items-center">
                {/* Gráfico de Pizza */}
                <div className="w-[350px] h-[300px] flex justify-center">
                    <Pie data={despesasPorCategoria} options={pieOptions} />
                </div>

                {/* Legenda Customizada */}
                <div className="flex-1 space-y-3">
                    {finalCategories.map((cat, index) => {
                        const percentage = ((cat.value / totalGastos) * 100).toFixed(1);
                        return (
                            <div key={cat.category} className="flex items-center justify-between group hover:bg-neutral-800/50 p-3 rounded-lg transition-colors">
                                <div className="flex items-center gap-3 flex-1">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: colors[index] }}
                                    />
                                    <span className="text-neutral-200 font-medium text-sm">
                                        {cat.category}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-neutral-400 text-sm font-medium">
                                        {percentage}%
                                    </span>
                                    <span className="text-white font-semibold text-sm min-w-[100px] text-right">
                                        R$ {cat.value.toLocaleString("pt-BR", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Total */}
                    <div className="pt-3 mt-3 border-t border-neutral-700">
                        <div className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg">
                            <span className="text-neutral-300 font-semibold">Total</span>
                            <span className="text-white font-bold text-lg">
                                R$ {totalGastos.toLocaleString("pt-BR", {
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
