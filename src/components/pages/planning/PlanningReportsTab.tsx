import { useMemo } from "react";
import type { CreditCardInvoice, ReportPeriod, Transaction } from "../../../context/FinanceContext";
import { PlanningReportsCategoriesSection } from "./PlanningReportsCategoriesSection";
import { PlanningReportsEmptyState } from "./PlanningReportsEmptyState";
import { PlanningReportsFlowSection } from "./PlanningReportsFlowSection";
import { PlanningReportsMetricsSection } from "./PlanningReportsMetricsSection";
import { PlanningReportsPulseSection } from "./PlanningReportsPulseSection";
import { PlanningReportsRankingSection } from "./PlanningReportsRankingSection";
import { buildReportsDataset } from "./planningReportsUtils";

interface PlanningReportsTabProps {
    period: ReportPeriod;
    transactions: Transaction[];
    allTransactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
}

export function PlanningReportsTab({ period, transactions, allTransactions, creditCardInvoices }: PlanningReportsTabProps) {
    const { monthReports, categoryReports, summary } = useMemo(
        () => buildReportsDataset(period, transactions, creditCardInvoices, allTransactions),
        [allTransactions, creditCardInvoices, period, transactions],
    );

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-3 text-left">
            {summary.transactionCount === 0 ? (
                <PlanningReportsEmptyState />
            ) : (
                <>
                    <PlanningReportsMetricsSection summary={summary} />
                    <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
                        <PlanningReportsCategoriesSection categoryReports={categoryReports} totalSpending={summary.spending} />
                        <PlanningReportsFlowSection monthReports={monthReports} />
                        
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <PlanningReportsRankingSection categoryReports={categoryReports} />
                        <PlanningReportsPulseSection summary={summary} />
                    </div>
                </>
            )}
        </section>
    );
}
