import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { PlanningReportsCategoryChartPanel } from "./PlanningReportsCategoryChartPanel";
import { PlanningReportsCategoryDetailsPanel } from "./PlanningReportsCategoryDetailsPanel";
import { PlanningReportsCategoryTabs } from "./PlanningReportsCategoryTabs";
import type { CategoryReportView, CategorySectionKind } from "./planningReportsCategoryTypes";
import type { CategoryReport } from "./planningReportsUtils";

interface PlanningReportsCategoriesSectionProps {
    categoryReports: CategoryReport[];
    totalAmount: number;
    kind?: CategorySectionKind;
}

const SECTION_COPY: Record<CategorySectionKind, { title: string; datasetLabel: string; emptyChartLabel: string; emptyListLabel: string }> = {
    spending: {
        title: "Categoria de Despesas",
        datasetLabel: "Despesas",
        emptyChartLabel: "Sem despesas",
        emptyListLabel: "Nenhuma despesa encontrada no período.",
    },
    income: {
        title: "Categoria de Receitas",
        datasetLabel: "Receitas",
        emptyChartLabel: "Sem receitas",
        emptyListLabel: "Nenhuma receita encontrada no período.",
    },
};

const CONTENT_VARIANTS: Variants = {
    initial: (direction: number) => ({ opacity: 0, x: direction * 28 }),
    animate: { opacity: 1, x: 0 },
    exit: (direction: number) => ({ opacity: 0, x: direction * -28 }),
};

export function PlanningReportsCategoriesSection({ categoryReports, totalAmount, kind = "spending" }: PlanningReportsCategoriesSectionProps) {
    const [activeView, setActiveView] = useState<CategoryReportView>("chart");
    const [slideDirection, setSlideDirection] = useState(1);
    const copy = SECTION_COPY[kind];

    const handleViewChange = (nextView: CategoryReportView) => {
        if (nextView === activeView) return;

        setSlideDirection(nextView === "details" ? 1 : -1);
        setActiveView(nextView);
    };

    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="flex justify-between mb-3">
                <div className="sm:justify-self-start">
                    <p className="text-base font-medium text-white">{copy.title}</p>
                </div>
                <PlanningReportsCategoryTabs activeView={activeView} layoutId={`planning-report-category-tab-${kind}`} onChange={handleViewChange} />
            </div>
            <AnimatePresence custom={slideDirection} initial={false} mode="wait">
                <motion.div
                    key={activeView}
                    custom={slideDirection}
                    variants={CONTENT_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden"
                >
                    {activeView === "chart" ? (
                        <PlanningReportsCategoryChartPanel categoryReports={categoryReports} datasetLabel={copy.datasetLabel} emptyChartLabel={copy.emptyChartLabel} totalAmount={totalAmount} />
                    ) : (
                        <PlanningReportsCategoryDetailsPanel categoryReports={categoryReports} emptyListLabel={copy.emptyListLabel} kind={kind} totalAmount={totalAmount} />
                    )}
                </motion.div>
            </AnimatePresence>
        </section>
    );
}
