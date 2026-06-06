import { ReceiptText } from "lucide-react";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategoryReport } from "./planningReportsUtils";

export function PlanningReportsRankingSection({ categoryReports }: { categoryReports: CategoryReport[] }) {
    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">Para onde o dinheiro foi</p>
                    <p className="text-xs text-white/42">Ranking com ticket médio e peso no total de gastos</p>
                </div>
                <ReceiptText size={18} className="text-white/42" />
            </div>
            <div className="space-y-2">{categoryReports.slice(0, 5).map((category, index) => <RankingRow key={category.key} category={category} index={index} />)}</div>
        </section>
    );
}

function RankingRow({ category, index }: { category: CategoryReport; index: number }) {
    const averageTicket = category.count > 0 ? category.totalAmount / category.count : 0;
    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/72">{index + 1}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{category.label}</p><p className="text-xs text-white/42">{category.count} lançamentos, ticket médio {formatReportCurrency(averageTicket)}</p></div>
                </div>
                <div className="shrink-0 text-right"><p className="text-sm font-semibold text-white">{formatReportCurrency(category.totalAmount)}</p><p className="text-xs text-white/42">{category.percent.toFixed(1)}%</p></div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, category.percent)}%`, backgroundColor: category.color }} /></div>
        </div>
    );
}
