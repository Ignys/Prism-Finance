import { useMemo } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";
import { CalendarRange } from "lucide-react";
import type { MonthReport } from "./planningReportsUtils";
import { formatReportCurrency } from "./planningReportFormatting";

export function PlanningReportsFlowSection({ monthReports }: { monthReports: MonthReport[] }) {
    const data = useMemo(
        () => ({
            labels: monthReports.map((report) => report.shortLabel),
            datasets: [
                { label: "Receitas", data: monthReports.map((report) => report.income), backgroundColor: "rgba(52, 211, 153, 0.72)", borderRadius: 6 },
                { label: "Despesas", data: monthReports.map((report) => report.spending), backgroundColor: "rgba(248, 113, 113, 0.72)", borderRadius: 6 },
            ],
        }),
        [monthReports],
    );
    const options = useMemo(() => buildBarOptions(), []);

    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">Receitas vs despesas</p>
                    <p className="text-xs text-white/42">Evolução mensal da saída de caixa e das receitas registradas</p>
                </div>
                <CalendarRange size={18} className="text-white/42" />
            </div>
            <div className="h-[315px]">
                <Bar data={data} options={options} />
            </div>
        </section>
    );
}

function buildBarOptions(): ChartOptions<"bar"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { grid: { display: false }, ticks: { color: "rgba(255,255,255,0.58)" } },
            y: { grid: { color: "rgba(255,255,255,0.07)" }, ticks: { color: "rgba(255,255,255,0.5)", callback: (value) => formatReportCurrency(Number(value)).replace("R$", "").trim() } },
        },
        plugins: {
            legend: { labels: { color: "rgba(255,255,255,0.72)", boxWidth: 10, boxHeight: 10 } },
            tooltip: {
                backgroundColor: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                callbacks: { label: (context: TooltipItem<"bar">) => `${context.dataset.label}: ${formatReportCurrency(Number(context.parsed.y ?? 0))}` },
            },
        },
    };
}
