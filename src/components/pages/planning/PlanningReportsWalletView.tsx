import { useMemo } from "react";
import { useFinanceBeneficiaries, useFinanceLedgerEntries, type CreditCardInvoice, type ReportPeriod, type Transaction, type Wallet } from "../../../context/FinanceContext";
import { PlanningReportsAccountsSection } from "./PlanningReportsAccountsSection";
import { PlanningReportsBalanceSection } from "./PlanningReportsBalanceSection";
import { PlanningReportsCategoryList } from "./PlanningReportsCategoryList";
import { PlanningReportsFlowSection } from "./PlanningReportsFlowSection";
import { PlanningReportsMethodSection } from "./PlanningReportsMethodSection";
import { PlanningReportsOverviewSection } from "./PlanningReportsOverviewSection";
import { PlanningReportsRankingSection } from "./PlanningReportsRankingSection";
import { buildBalanceTimeline, buildWalletRows } from "./planningAccountReports";
import { formatReportCurrency } from "./planningReportFormatting";
import type { ReportsDataset } from "./planningReportsUtils";

interface PlanningReportsWalletViewProps {
    dataset: ReportsDataset;
    period: ReportPeriod;
    transactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
    wallets: Wallet[];
}

export function PlanningReportsWalletView({ dataset, period, transactions, creditCardInvoices, wallets }: PlanningReportsWalletViewProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const ledgerEntries = useFinanceLedgerEntries();
    const { monthReports, categoryReports, incomeCategoryReports, beneficiaryReports, tagReports, summary } = dataset;
    const hasMethods = summary.methodReports.length > 1;
    const isSingle = wallets.length === 1;
    const balance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const timeline = useMemo(() => buildBalanceTimeline(monthReports, wallets, ledgerEntries), [ledgerEntries, monthReports, wallets]);
    const rows = useMemo(
        () => (isSingle ? [] : buildWalletRows(period, transactions, creditCardInvoices, wallets, beneficiaries)),
        [beneficiaries, creditCardInvoices, isSingle, period, transactions, wallets],
    );

    return (
        <>
            <PlanningReportsOverviewSection
                summary={summary}
                categoryReports={categoryReports}
                headline={{ label: "Saldo atual", value: balance }}
                facts={[
                    { label: "Entrou", value: formatReportCurrency(summary.income), className: "text-emerald-200" },
                    { label: "Saiu", value: formatReportCurrency(summary.spending), className: "text-rose-200" },
                    { label: "Balanço", value: formatReportCurrency(summary.net), className: summary.net >= 0 ? "text-white" : "text-orange-200" },
                ]}
            />
            {/* Grade irregular: gráficos ganham largura, listas ficam estreitas ao lado. */}
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <PlanningReportsFlowSection monthReports={monthReports} transactions={transactions} walletIds={wallets.map((wallet) => wallet.id)} />
                </div>
                <div className="lg:col-span-4 lg:row-span-2">
                    <PlanningReportsCategoryList title="Despesas por categoria" emptyLabel="Nenhuma despesa no período." categoryReports={categoryReports} totalAmount={summary.spending} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsBalanceSection points={timeline} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsCategoryList title="Receitas por categoria" emptyLabel="Nenhuma receita no período." categoryReports={incomeCategoryReports} totalAmount={summary.income} />
                </div>
                {isSingle ? null : (
                    <div className="lg:col-span-12">
                        <PlanningReportsAccountsSection kind="wallets" rows={rows} />
                    </div>
                )}
                <div className={hasMethods ? "lg:col-span-4" : "lg:col-span-6"}>
                    <PlanningReportsCategoryList title="Despesas por tag" emptyLabel="Nenhuma despesa com tag no período." categoryReports={tagReports} totalAmount={summary.spending} />
                </div>
                <div className={hasMethods ? "lg:col-span-4" : "lg:col-span-6"}>
                    <PlanningReportsRankingSection beneficiaryReports={beneficiaryReports} />
                </div>
                {hasMethods ? (
                    <div className="lg:col-span-4">
                        <PlanningReportsMethodSection methodReports={summary.methodReports} />
                    </div>
                ) : null}
            </div>
        </>
    );
}
