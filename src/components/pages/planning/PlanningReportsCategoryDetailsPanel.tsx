import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategorySectionKind } from "./planningReportsCategoryTypes";
import type { CategoryReport } from "./planningReportsUtils";

interface PlanningReportsCategoryDetailsPanelProps {
    categoryReports: CategoryReport[];
    emptyListLabel: string;
    kind: CategorySectionKind;
    totalAmount: number;
}

export function PlanningReportsCategoryDetailsPanel({ categoryReports, emptyListLabel, kind, totalAmount }: PlanningReportsCategoryDetailsPanelProps) {
    const sortedReports = [...categoryReports].sort((a, b) => b.totalAmount - a.totalAmount);

    return (
        <div className="elegant-scrollbar max-h-[315px] min-h-[315px] space-y-1 overflow-y-auto pr-1">
            {sortedReports.length > 0 ? (
                sortedReports.map((category) => <CategoryRow key={category.key} category={category} totalAmount={totalAmount} kind={kind} />)
            ) : (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-white/55">{emptyListLabel}</div>
            )}
        </div>
    );
}

function CategoryRow({ category, totalAmount, kind }: { category: CategoryReport; totalAmount: number; kind: CategorySectionKind }) {
    const CategoryIcon = getCategoryIconComponent(category.icon, category.type);
    const barWidth = totalAmount > 0 ? (category.totalAmount / totalAmount) * 100 : 0;

    if (kind === "spending") {
        return <SpendingCategoryRow category={category} barWidth={barWidth} />;
    }

    return (
        <div className="border-b border-white/[0.07] py-3 mr-1">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04]" style={{ color: category.color, backgroundColor: `${category.color}1A` }}>
                        <CategoryIcon size={18} />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/84">{category.label}</p>
                        <p className="text-xs mt-0.5 text-white/45">{category.percent.toFixed(1)}%</p>
                    </div>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                    <p className=" font-medium text-white tracking-wide">{formatReportCurrency(category.totalAmount)}</p>
                    <span className="uppercase tracking-tight text-white/40 text-[11px]">{formatTransactionCount(category.count)}</span>
                </div>
            </div>
            <div className="flex mt-1.5 w-full gap-3 items-center">
                <div className=" h-1.5 grow overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: category.color }} />
                </div>
            </div>
        </div>
    );
}

function SpendingCategoryRow({ category, barWidth }: { category: CategoryReport; barWidth: number }) {
    const CategoryIcon = getCategoryIconComponent(category.icon, category.type);

    return (
        <div className="border-b border-white/[0.07] py-3 mr-1">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04]" style={{ color: category.color, backgroundColor: `${category.color}1A` }}>
                        <CategoryIcon size={18} />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/84">{category.label}</p>
                        <p className="text-xs mt-0.5 text-white/45">{category.percent.toFixed(1)}%</p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <SpendingBreakdownItem label="Carteiras" value={category.walletAmount} />
                    <SpendingBreakdownItem label="Faturas" value={category.invoiceAmount} />
                </div>
            </div>
            <div className="flex mt-0.5 w-full gap-3 items-center">
                <div className=" h-1.5 grow overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: category.color }} />
                </div>
                <SpendingBreakdownItem bold value={category.totalAmount} />
            </div>
        </div>
    );
}

function SpendingBreakdownItem({ bold, label, value }: { bold?: boolean; label?: string; value: number }) {
    if (!bold) {
        return (
            <div className={`flex items-baseline justify-end gap-2 text-[11px] opacity-80`}>
                <span className="uppercase tracking-tight text-white/40">{label}</span>
                <p className="text-sm text-white/60">{formatReportCurrency(value)}</p>
            </div>
        );
    } else {
        return (
            <div className={`flex`}>
                <p className=" font-medium text-white tracking-wide">{formatReportCurrency(value)}</p>
            </div>
        );
    }
}

function formatTransactionCount(count: number): string {
    return count === 1 ? "1 transação" : `${count} transações`;
}
