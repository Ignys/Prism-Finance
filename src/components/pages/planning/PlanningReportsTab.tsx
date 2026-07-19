import { useMemo } from "react";
import { type CreditCardInvoice, type ReportPeriod, type Transaction, useFinanceBeneficiaries } from "../../../context/FinanceContext";
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
    const beneficiaries = useFinanceBeneficiaries();
    const { monthReports, categoryReports, incomeCategoryReports, beneficiaryReports, summary } = useMemo(
        () => buildReportsDataset(period, transactions, creditCardInvoices, allTransactions, beneficiaries),
        [allTransactions, beneficiaries, creditCardInvoices, period, transactions],
    );

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-3 text-left">
            {summary.transactionCount === 0 ? (
                <PlanningReportsEmptyState />
            ) : (
                <>
                    <PlanningReportsMetricsSection summary={summary} />
                    <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)_minmax(340px,0.7fr)]">
                        <PlanningReportsCategoriesSection categoryReports={categoryReports} totalAmount={summary.spending} />
                       
                        <PlanningReportsCategoriesSection categoryReports={incomeCategoryReports} totalAmount={summary.income} kind="income" />
                        
                        <PlanningReportsFlowSection monthReports={monthReports} />
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                         <PlanningReportsRankingSection beneficiaryReports={beneficiaryReports} />
                        
                    </div>
                </>
            )}
        </section>
    );
}
