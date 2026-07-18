import { useMemo, useState } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { ArrowDown, ArrowDownRight, ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategoryReport } from "./planningReportsUtils";

type CategorySectionKind = "spending" | "income";

interface PlanningReportsCategoriesSectionProps {
    categoryReports: CategoryReport[];
    totalAmount: number;
    kind?: CategorySectionKind;
}

const SECTION_COPY: Record<CategorySectionKind, { title: string; datasetLabel: string; emptyChartLabel: string; emptyListLabel: string }> = {
    spending: {
        title: "Gastos por categoria",
        datasetLabel: "Despesas",
        emptyChartLabel: "Sem despesas",
        emptyListLabel: "Nenhuma despesa encontrada no periodo.",
    },
    income: {
        title: "Receitas por categoria",
        datasetLabel: "Receitas",
        emptyChartLabel: "Sem receitas",
        emptyListLabel: "Nenhuma receita encontrada no periodo.",
    },
};

export function PlanningReportsCategoriesSection({ categoryReports, totalAmount, kind = "spending" }: PlanningReportsCategoriesSectionProps) {
    const [showDetails, setShowDetails] = useState(false);
    const copy = SECTION_COPY[kind];
    const visibleReports = useMemo(() => (showDetails ? categoryReports : [...categoryReports].sort((a, b) => b.totalAmount - a.totalAmount)), [categoryReports, showDetails]);
    const data = useMemo(
        () => ({
            labels: categoryReports.map((category) => category.label),
            datasets: [
                {
                    label: copy.datasetLabel,
                    data: categoryReports.map((category) => category.totalAmount),
                    backgroundColor: categoryReports.map((category) => category.color),
                    borderWidth: 0,
                    hoverOffset: 6,
                    spacing: 2,
                },
            ],
        }),
        [categoryReports, copy.datasetLabel],
    );
    const options = useMemo(() => buildDoughnutOptions(totalAmount), [totalAmount]);

    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">{copy.title}</p>
                </div>
                {categoryReports.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setShowDetails((current) => !current)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/72 transition-colors hover:border-white/[0.22] hover:text-white"
                    >
                        {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
                    </button>
                ) : null}
            </div>
            <div className="flex gap-2">
                <div className=" rounded-lg border border-white/[0.06] bg-black/20 p-2">
                    {totalAmount > 0 ? (
                        <Doughnut data={data} options={options} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.08em] text-white/42">{copy.emptyChartLabel}</div>
                    )}
                </div>
                <div className="elegant-scrollbar w-full max-h-[420px] space-y-1 overflow-y-auto pr-1">
                    {visibleReports.length > 0 ? (
                        visibleReports.map((category) => <CategoryRow key={category.key} category={category} showDetails={showDetails} totalAmount={totalAmount} kind={kind} />)
                    ) : (
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-white/55">{copy.emptyListLabel}</div>
                    )}
                </div>
            </div>
        </section>
    );
}

function CategoryRow({ category, showDetails, totalAmount, kind }: { category: CategoryReport; showDetails: boolean; totalAmount: number; kind: CategorySectionKind }) {
    const CategoryIcon = getCategoryIconComponent(category.icon, category.type);
    const barWidth = totalAmount > 0 ? (category.totalAmount / totalAmount) * 100 : 0;

    return (
        <div>
            <div className="flex items-center border-white/[0.06] border-b pb-1">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04]" style={{ color: category.color }}>
                    <CategoryIcon size={18} />
                </span>
                <div className="flex w-full items-center justify-between gap-3 px-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm text-white/78">{category.label}</span>
                    </div>
                    <div className="flex grow max-w-full justify-end h-1">
                        <div className="h-1 rounded-full bg-white/20" style={{ width: `${barWidth}%`, backgroundColor: category.color }}></div>
                    </div>
                    <div className="flex items-center text-sm gap-2.5">
                        <p className="text-xs text-white/60">{category.percent.toFixed(1)}%</p>
                        <div className="h-0.5 w-0.5 rounded-full bg-white/40"></div>
                        {showDetails && kind === "spending" ? (
                            <div className="flex flex-col p-1 items-end text-xs">
                                <div className="flex items-center justify-between w-25 gap-1 border-b border-white/[0.08] pb-0.5 mb-0.5">
                                    <ArrowDownRight className="h-4 w-4 opacity-60" />
                                    <span className=" text-white/60">{formatReportCurrency(category.walletAmount)}</span>
                                </div>
                                <div className="flex items-center justify-between w-25 gap-1">
                                    <CreditCard className="h-4 w-4 opacity-60" />
                                    <span className=" text-white/60">{formatReportCurrency(category.invoiceAmount)}</span>
                                </div>
                            </div>
                        ) : showDetails ? (
                            <div className="flex items-center justify-between w-25 gap-1 p-1 text-xs">
                                <ArrowDown className="h-4 w-4 opacity-60" />
                                <span className=" text-white/60">{formatReportCurrency(category.walletAmount)}</span>
                            </div>
                        ) : (
                            <p className="font-medium text-white">{formatReportCurrency(category.totalAmount)}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function buildDoughnutOptions(total: number): ChartOptions<"doughnut"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
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
