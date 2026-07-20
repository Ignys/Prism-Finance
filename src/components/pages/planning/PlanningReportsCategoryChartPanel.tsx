import { useMemo } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategoryReport } from "./planningReportsUtils";

interface PlanningReportsCategoryChartPanelProps {
    categoryReports: CategoryReport[];
    datasetLabel: string;
    emptyChartLabel: string;
    totalAmount: number;
}

export function PlanningReportsCategoryChartPanel({ categoryReports, datasetLabel, emptyChartLabel, totalAmount }: PlanningReportsCategoryChartPanelProps) {
    const orderedReports = useMemo(() => [...categoryReports].sort((a, b) => b.totalAmount - a.totalAmount), [categoryReports]);
    const doughnutData = useMemo(
        () => ({
            labels: orderedReports.map((category) => category.label),
            datasets: [
                {
                    label: datasetLabel,
                    data: orderedReports.map((category) => category.totalAmount),
                    backgroundColor: orderedReports.map((category) => category.color),
                    borderWidth: 0,
                    hoverOffset: 6,
                    spacing: 2,
                },
            ],
        }),
        [datasetLabel, orderedReports],
    );
    const barData = useMemo(
        () => ({
            labels: orderedReports.map((category) => category.label),
            datasets: [
                {
                    label: datasetLabel,
                    data: orderedReports.map((category) => category.totalAmount),
                    backgroundColor: orderedReports.map((category) => category.color),
                    borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false,
                    maxBarThickness: 28,
                },
            ],
        }),
        [datasetLabel, orderedReports],
    );
    const doughnutOptions = useMemo(() => buildDoughnutOptions(totalAmount), [totalAmount]);
    const barOptions = useMemo(() => buildBarOptions(totalAmount), [totalAmount]);

    return (
        <div className="min-h-[315px]">
            {totalAmount > 0 ? (
                <div className="grid min-h-[315px] gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/20 p-2">
                        <div className="h-[260px] w-full max-w-[260px]">
                            <Doughnut data={doughnutData} options={doughnutOptions} />
                        </div>
                    </div>
                    <div className="h-[280px] rounded-lg border border-white/[0.06] bg-black/20 p-3 md:h-auto">
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
            ) : (
                <div className="flex min-h-[315px] items-center justify-center rounded-lg border border-white/[0.06] bg-black/20 text-xs uppercase tracking-[0.08em] text-white/42">
                    {emptyChartLabel}
                </div>
            )}
        </div>
    );
}

function buildBarOptions(total: number): ChartOptions<"bar"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 700,
            easing: "easeOutQuart",
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    display: false,
                },
            },
            y: {
                beginAtZero: true,
                grid: { color: "rgba(255,255,255,0.07)" },
                ticks: {
                    color: "rgba(255,255,255,0.48)",
                    callback: (value) => formatReportCurrency(Number(value)).replace("R$", "").trim(),
                },
            },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label: (context: TooltipItem<"bar">) => {
                        const value = Number(context.parsed.y ?? 0);
                        return `${context.dataset.label}: ${formatReportCurrency(value)} (${(total > 0 ? (value / total) * 100 : 0).toFixed(1)}%)`;
                    },
                },
            },
        },
    };
}

function buildDoughnutOptions(total: number): ChartOptions<"doughnut"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        animation: {
            duration: 700,
            easing: "easeOutQuart",
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                callbacks: {
                    label: (context: TooltipItem<"doughnut">) => {
                        const value = Number(context.parsed ?? 0);
                        return `${formatReportCurrency(value)} (${(total > 0 ? (value / total) * 100 : 0).toFixed(1)}%)`;
                    },
                },
            },
        },
    };
}
