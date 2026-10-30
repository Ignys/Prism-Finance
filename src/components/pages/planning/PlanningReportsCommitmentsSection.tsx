import type { Transaction } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { getTransactionCategoryDisplay } from "../../../lib/transactionCategory";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import type { UpcomingInstallmentMonth } from "./planningAccountReports";
import { formatReportCurrency } from "./planningReportFormatting";
import { formatMonthLabel } from "./planningReportsUtils";

const UPCOMING_LIMIT = 8;

export function PlanningReportsInstallmentsSection({ months }: { months: UpcomingInstallmentMonth[] }) {
    const visible = months.slice(0, UPCOMING_LIMIT);
    const total = months.reduce((sum, month) => sum + month.amount, 0);
    const peak = Math.max(1, ...visible.map((month) => month.amount));

    return (
        <PlanningReportsPanel
            title="Parcelas a vencer"
           
            aside={<span className="text-sm text-white/70" style={REPORT_MONO_STYLE}>{formatReportCurrency(total)}</span>}
        >
            {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">Nenhuma parcela futura nos cartões selecionados.</p>
            ) : (
                <ul className="space-y-3">
                    {visible.map((month) => (
                        <li key={month.monthKey} className="flex items-center gap-3">
                            <span className="w-16 shrink-0 text-xs capitalize text-white/60">{formatMonthLabel(month.monthKey)}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                <div className="h-full rounded-full bg-violet-300/80" style={{ width: `${(month.amount / peak) * 100}%` }} />
                            </div>
                            <span className="w-28 shrink-0 text-right text-sm text-white" style={REPORT_MONO_STYLE}>
                                {formatReportCurrency(month.amount)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </PlanningReportsPanel>
    );
}

export function PlanningReportsTopPurchasesSection({ purchases }: { purchases: Transaction[] }) {
    return (
        <PlanningReportsPanel title="Maiores compras">
            {purchases.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">Nenhuma compra no período.</p>
            ) : (
                <ul className="divide-y divide-white/[0.06]">
                    {purchases.map((purchase) => {
                        const category = getTransactionCategoryDisplay(purchase.category);
                        const CategoryIcon = getCategoryIconComponent(category.icon, category.type);
                        const color = category.color ?? "#737373";
                        const installment = purchase.installmentNumber !== null ? ` · parcela ${purchase.installmentNumber}` : "";
                        return (
                            <li key={purchase.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}1F` }}>
                                    <CategoryIcon size={16} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-white/85">{purchase.description || purchase.beneficiary || category.displayLabel}</p>
                                    <p className="truncate text-xs text-white/40">
                                        {category.displayLabel}
                                        {installment}
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm text-white" style={REPORT_MONO_STYLE}>
                                    {formatReportCurrency(purchase.value)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </PlanningReportsPanel>
    );
}
