import { useMemo } from "react";
import type { CreditCard, CreditCardInvoice, Transaction, Wallet } from "../../../context/FinanceContext";
import { PlanningReportsCategoryList } from "./PlanningReportsCategoryList";
import { PlanningReportsFlowSection } from "./PlanningReportsFlowSection";
import { PlanningReportsMethodSection } from "./PlanningReportsMethodSection";
import { PlanningReportsOverviewSection } from "./PlanningReportsOverviewSection";
import { PlanningReportsRankingSection } from "./PlanningReportsRankingSection";
import { buildCardSummary } from "./planningAccountReports";
import { formatReportCurrency } from "./planningReportFormatting";
import type { ReportsDataset } from "./planningReportsUtils";

interface PlanningReportsCombinedViewProps {
    dataset: ReportsDataset;
    transactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
    wallets: Wallet[];
    creditCards: CreditCard[];
}

export function PlanningReportsCombinedView({ dataset, transactions, creditCardInvoices, wallets, creditCards }: PlanningReportsCombinedViewProps) {
    const { monthReports, categoryReports, incomeCategoryReports, beneficiaryReports, tagReports, summary } = dataset;
    const balance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const currentInvoice = useMemo(() => buildCardSummary(creditCardInvoices, creditCards).currentInvoice, [creditCardInvoices, creditCards]);

    return (
        <>
            <PlanningReportsOverviewSection
                summary={summary}
                categoryReports={categoryReports}
                headline={{ label: "Saldo após a fatura", value: balance - currentInvoice }}
                facts={[
                    { label: "Saldo", value: formatReportCurrency(balance), className: "text-amber-300" },
                    { label: "Fatura atual", value: formatReportCurrency(currentInvoice), className: "text-violet-200" },
                    { label: "Balanço", value: formatReportCurrency(summary.net), className: summary.net >= 0 ? "text-white" : "text-orange-200" },
                ]}
            />
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <PlanningReportsFlowSection monthReports={monthReports} transactions={transactions} walletIds={wallets.map((wallet) => wallet.id)} />
                </div>
                <div className="lg:col-span-4 lg:row-span-2">
                    <PlanningReportsCategoryList title="Despesas por categoria" emptyLabel="Nenhuma despesa no período." categoryReports={categoryReports} totalAmount={summary.spending} showPaymentSplit />
                </div>
                <div className="lg:col-span-8">
                    <PlanningReportsMethodSection methodReports={summary.methodReports} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsCategoryList title="Receitas por categoria" emptyLabel="Nenhuma receita no período." categoryReports={incomeCategoryReports} totalAmount={summary.income} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsCategoryList title="Despesas por tag" emptyLabel="Nenhuma despesa com tag no período." categoryReports={tagReports} totalAmount={summary.spending} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsRankingSection beneficiaryReports={beneficiaryReports} />
                </div>
            </div>
        </>
    );
}
