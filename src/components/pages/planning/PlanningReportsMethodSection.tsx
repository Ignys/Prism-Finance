import { useMemo } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";
import type { MethodReport, MonthReport } from "./planningReportsUtils";
import { formatReportCurrency } from "./planningReportFormatting";

interface PlanningReportsMethodSectionProps {
    monthReports: MonthReport[];
    methodReports: MethodReport[];
}

export function PlanningReportsMethodSection({ monthReports, methodReports }: PlanningReportsMethodSectionProps) {
    const data = useMemo(
        () => ({
            labels: monthReports.map((report) => report.shortLabel),
            datasets: [
                { label: "Carteira", data: monthReports.map((report) => report.walletSpending), backgroundColor: "rgba(34, 211, 238, 0.72)", borderRadius: 6 },
                { label: "Fatura", data: monthReports.map((report) => report.invoiceSpending), backgroundColor: "rgba(251, 191, 36, 0.72)", borderRadius: 6 },
            ],
        }),
        [monthReports],
    );
    const options = useMemo(() => buildBarOptions(), []);
    const total = methodReports.reduce((sum, method) => sum + method.amount, 0);

    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">Carteira vs Fatura</p>
                    <p className="text-xs text-white/42">Despesas pagas na conta e faturas de cartão pagas</p>
                </div>
                <div className="flex flex-wrap gap-4">
                    {methodReports.map((method) => (
                        <div key={method.key} className="text-right">
                            <p className="flex items-center justify-end gap-1.5 text-xs text-white/54">
                                <span className={`h-2 w-2 rounded-full ${method.colorClassName}`} />
                                {method.label}
                            </p>
                            <p className="text-sm font-semibold text-white">{formatReportCurrency(method.amount)}</p>
                            <p className="text-xs text-white/42">{total > 0 ? ((method.amount / total) * 100).toFixed(1) : "0.0"}%</p>
                        </div>
                    ))}
                </div>
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
