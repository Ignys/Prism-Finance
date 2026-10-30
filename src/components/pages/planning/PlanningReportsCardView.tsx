import { useMemo } from "react";
import { useFinanceBeneficiaries, type CreditCard, type CreditCardInvoice, type ReportPeriod, type Transaction } from "../../../context/FinanceContext";
import { PlanningReportsAccountsSection } from "./PlanningReportsAccountsSection";
import { PlanningReportsCategoryList } from "./PlanningReportsCategoryList";
import { PlanningReportsInstallmentsSection, PlanningReportsTopPurchasesSection } from "./PlanningReportsCommitmentsSection";
import { PlanningReportsInvoicesSection } from "./PlanningReportsInvoicesSection";
import { PlanningReportsOverviewSection } from "./PlanningReportsOverviewSection";
import { PlanningReportsRankingSection } from "./PlanningReportsRankingSection";
import { buildCardRows, buildCardSummary, buildInvoiceMonths, buildUpcomingInstallments, getTopPurchases } from "./planningAccountReports";
import { formatReportCurrency } from "./planningReportFormatting";
import type { ReportsDataset } from "./planningReportsUtils";

interface PlanningReportsCardViewProps {
    dataset: ReportsDataset;
    period: ReportPeriod;
    transactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
    creditCards: CreditCard[];
    today: string;
}

export function PlanningReportsCardView({ dataset, period, transactions, creditCardInvoices, creditCards, today }: PlanningReportsCardViewProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const { monthReports, categoryReports, beneficiaryReports, tagReports, summary } = dataset;
    const isSingle = creditCards.length === 1;
    const creditCardIds = useMemo(() => creditCards.map((creditCard) => creditCard.id), [creditCards]);
    const cardSummary = useMemo(() => buildCardSummary(creditCardInvoices, creditCards), [creditCardInvoices, creditCards]);
    const invoiceMonths = useMemo(() => buildInvoiceMonths(monthReports, creditCardInvoices, creditCardIds, today), [creditCardIds, creditCardInvoices, monthReports, today]);
    const upcoming = useMemo(() => buildUpcomingInstallments(transactions, creditCardInvoices, creditCardIds, today), [creditCardIds, creditCardInvoices, today, transactions]);
    const topPurchases = useMemo(() => getTopPurchases(transactions, creditCardInvoices, creditCardIds, monthReports), [creditCardIds, creditCardInvoices, monthReports, transactions]);
    const rows = useMemo(
        () => (isSingle ? [] : buildCardRows(period, transactions, creditCardInvoices, creditCards, beneficiaries)),
        [beneficiaries, creditCardInvoices, creditCards, isSingle, period, transactions],
    );
    const usedPercent = cardSummary.limit > 0 ? `${((cardSummary.used / cardSummary.limit) * 100).toFixed(0)}%` : "--";

    return (
        <>
            <PlanningReportsOverviewSection
                summary={summary}
                categoryReports={categoryReports}
                headline={{ label: "Fatura atual", value: cardSummary.currentInvoice }}
                facts={[
                    { label: "Próxima fatura", value: formatReportCurrency(cardSummary.nextInvoice), className: "text-white" },
                    { label: "Limite usado", value: usedPercent, className: "text-violet-200" },
                    { label: "Disponível", value: formatReportCurrency(cardSummary.available), className: cardSummary.available >= 0 ? "text-white" : "text-orange-200" },
                ]}
            />
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <PlanningReportsInvoicesSection months={invoiceMonths} />
                </div>
                <div className="lg:col-span-4 lg:row-span-2">
                    <PlanningReportsCategoryList title="Compras por categoria" emptyLabel="Nenhuma compra no período." categoryReports={categoryReports} totalAmount={summary.spending} />
                </div>
                <div className="lg:col-span-8">
                    <PlanningReportsInstallmentsSection months={upcoming} />
                </div>
                {isSingle ? null : (
                    <div className="lg:col-span-12">
                        <PlanningReportsAccountsSection kind="cards" rows={rows} />
                    </div>
                )}
                <div className="lg:col-span-5">
                    <PlanningReportsTopPurchasesSection purchases={topPurchases} />
                </div>
                <div className="lg:col-span-4">
                    <PlanningReportsCategoryList title="Compras por tag" emptyLabel="Nenhuma compra com tag no período." categoryReports={tagReports} totalAmount={summary.spending} />
                </div>
                <div className="lg:col-span-3">
                    <PlanningReportsRankingSection beneficiaryReports={beneficiaryReports} />
                </div>
            </div>
        </>
    );
}
