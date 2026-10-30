import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { useModal } from "../../../context/ModalContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { PlanningReportsCategoryModal } from "./PlanningReportsCategoryModal";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategoryReport } from "./planningReportsUtils";

// Antes da primeira medição; depois vale o que couber na altura do card.
const INITIAL_ROWS = 6;
// Igual ao space-y-3.5 da lista.
const ROW_GAP = 14;

interface PlanningReportsCategoryListProps {
    title: string;
    emptyLabel: string;
    categoryReports: CategoryReport[];
    totalAmount: number;
    showPaymentSplit?: boolean;
}

export function PlanningReportsCategoryList({ title, emptyLabel, categoryReports, totalAmount, showPaymentSplit = false }: PlanningReportsCategoryListProps) {
    const { openModal } = useModal();
    const ordered = [...categoryReports].sort((a, b) => b.totalAmount - a.totalAmount);
    const containerRef = useRef<HTMLDivElement>(null);
    const firstRowRef = useRef<HTMLLIElement>(null);
    const [fitCount, setFitCount] = useState(INITIAL_ROWS);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const measure = () => {
            const rowHeight = firstRowRef.current?.offsetHeight ?? 0;
            if (rowHeight === 0) return;
            setFitCount(Math.max(1, Math.floor((container.clientHeight + ROW_GAP) / (rowHeight + ROW_GAP))));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [ordered.length]);

    return (
        <PlanningReportsPanel
            title={title}
            aside={
                <span className="text-sm text-white/70" style={REPORT_MONO_STYLE}>
                    {formatReportCurrency(totalAmount)}
                </span>
            }
        >
            {showPaymentSplit && ordered.some((category) => category.invoiceAmount > 0) ? (
                <div className="-mt-2 mb-4 flex gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 rounded-full bg-white/70" />
                        Carteira
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 rounded-full bg-white/30" />
                        Fatura do cartão
                    </span>
                </div>
            ) : null}
            {ordered.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">{emptyLabel}</p>
            ) : (
                <>
                    {/* A lista não define a altura do card: mostra só as linhas que cabem no espaço que a grade já deu. */}
                    <div ref={containerRef} className="relative min-h-[14rem] flex-1">
                        <ul className="absolute inset-0 space-y-3.5 overflow-hidden">
                            {ordered.slice(0, fitCount).map((category, index) => (
                                <CategoryRow key={category.key} ref={index === 0 ? firstRowRef : undefined} category={category} showPaymentSplit={showPaymentSplit} />
                            ))}
                        </ul>
                    </div>
                    {fitCount < ordered.length ? (
                        <button
                            type="button"
                            onClick={() =>
                                openModal(<PlanningReportsCategoryModal title={title} totalAmount={totalAmount} categoryReports={ordered} showPaymentSplit={showPaymentSplit} />)
                            }
                            className="mt-4 self-start rounded-md px-2 py-1 text-xs text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-white/40"
                        >
                            Mostrar todas ({ordered.length})
                        </button>
                    ) : null}
                </>
            )}
        </PlanningReportsPanel>
    );
}

export const CategoryRow = forwardRef<HTMLLIElement, { category: CategoryReport; showPaymentSplit: boolean }>(function CategoryRow({ category, showPaymentSplit }, ref) {
    const CategoryIcon = getCategoryIconComponent(category.icon, category.type);
    // A barra é a mesma porcentagem escrita ao lado: fatia do total do período.
    const width = category.percent;
    const walletWidth = category.totalAmount > 0 ? (category.walletAmount / category.totalAmount) * 100 : 100;
    const split = showPaymentSplit && category.invoiceAmount > 0;

    return (
        <li ref={ref} className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color: category.color, backgroundColor: `${category.color}1F` }}>
                <CategoryIcon size={16} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm text-white/85">{category.label}</p>
                    <p className="shrink-0 text-sm text-white" style={REPORT_MONO_STYLE}>
                        {formatReportCurrency(category.totalAmount)}
                    </p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="flex h-full overflow-hidden rounded-full"
                            style={{ width: `${width}%` }}
                            title={split ? `Carteiras ${formatReportCurrency(category.walletAmount)} · Faturas ${formatReportCurrency(category.invoiceAmount)}` : undefined}
                        >
                            <span className="h-full" style={{ width: split ? `${walletWidth}%` : "100%", backgroundColor: category.color }} />
                            {split ? <span className="h-full flex-1 opacity-45" style={{ backgroundColor: category.color }} /> : null}
                        </div>
                    </div>
                    <span className="w-11 shrink-0 text-right text-[11px] text-white/40">{category.percent.toFixed(1)}%</span>
                </div>
            </div>
        </li>
    );
});
