import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { type CreditCardInvoice, type ReportPeriod, type Transaction, useFinanceBeneficiaries } from "../../../context/FinanceContext";
import { REPORTS_ENTRANCE_CONTAINER_VARIANTS, REPORTS_ENTRANCE_GRID_VARIANTS, REPORTS_ENTRANCE_ITEM_VARIANTS } from "./planningReportsMotion";
import { PlanningReportsCategoriesSection } from "./PlanningReportsCategoriesSection";
import { PlanningReportsEmptyState } from "./PlanningReportsEmptyState";
import { PlanningReportsFlowSection } from "./PlanningReportsFlowSection";
import { PlanningReportsMetricsSection } from "./PlanningReportsMetricsSection";
import { PlanningReportsRankingSection } from "./PlanningReportsRankingSection";
import { buildReportsDataset } from "./planningReportsUtils";

interface PlanningReportsTabProps {
    period: ReportPeriod;
    transactions: Transaction[];
    allTransactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
}

export function PlanningReportsTab({ period, transactions, allTransactions, creditCardInvoices }: PlanningReportsTabProps) {
    const shouldReduceMotion = useReducedMotion();
    const beneficiaries = useFinanceBeneficiaries();
    const { monthReports, categoryReports, incomeCategoryReports, beneficiaryReports, summary } = useMemo(
        () => buildReportsDataset(period, transactions, creditCardInvoices, allTransactions, beneficiaries),
        [allTransactions, beneficiaries, creditCardInvoices, period, transactions],
    );

    return (
        <motion.section
            variants={REPORTS_ENTRANCE_CONTAINER_VARIANTS}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            className="flex flex-1 flex-col gap-3 text-left"
        >
            <p className="text-xs text-white/55">Valores pagos e pendentes pela data prevista. Gastos no cartão entram pelos pagamentos de fatura; fechamentos sem débito em carteira não compõem os totais.</p>
            {summary.transactionCount === 0 ? (
                <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS}>
                    <PlanningReportsEmptyState />
                </motion.div>
            ) : (
                <>
                    <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS}>
                        <PlanningReportsMetricsSection summary={summary} />
                    </motion.div>
                    <motion.div
                        variants={REPORTS_ENTRANCE_GRID_VARIANTS}
                        className="grid min-h-0 gap-3 grid-cols-[minmax(0,1fr)_minmax(340px,1fr)] desktop:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)_minmax(340px,0.7fr)]"
                    >
                        <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS} className="min-w-0">
                            <PlanningReportsCategoriesSection categoryReports={categoryReports} totalAmount={summary.spending} />
                        </motion.div>

                        <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS} className="min-w-0">
                            <PlanningReportsCategoriesSection categoryReports={incomeCategoryReports} totalAmount={summary.income} kind="income" />
                        </motion.div>

                        <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS} className="min-w-0">
                            <PlanningReportsFlowSection monthReports={monthReports} />
                        </motion.div>
                        <motion.div variants={REPORTS_ENTRANCE_ITEM_VARIANTS} className="min-w-0">
                            <PlanningReportsRankingSection beneficiaryReports={beneficiaryReports} />
                        </motion.div>
                    </motion.div>
                </>
            )}
        </motion.section>
    );
}
