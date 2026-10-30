import { useMemo } from "react";
import { type CreditCard, type CreditCardInvoice, type ReportPeriod, type Transaction, type Wallet, useFinanceBeneficiaries, useFinanceTags } from "../../../context/FinanceContext";
import { PlanningReportsCardView } from "./PlanningReportsCardView";
import { PlanningReportsCombinedView } from "./PlanningReportsCombinedView";
import { PlanningReportsEmptyState } from "./PlanningReportsEmptyState";
import { PlanningReportsWalletView } from "./PlanningReportsWalletView";
import { buildReportsDataset, type ReportScope } from "./planningReportsUtils";
import { getReportScopeKind } from "./reportScope";

interface PlanningReportsTabProps {
    period: ReportPeriod;
    scope: ReportScope;
    transactions: Transaction[];
    creditCardInvoices: CreditCardInvoice[];
    wallets: Wallet[];
    creditCards: CreditCard[];
    today: string;
}

/** Escolhe o relatório pela combinação de contas: carteira(s), cartão(ões) ou ambos. */
export function PlanningReportsTab({ period, scope, transactions, creditCardInvoices, wallets, creditCards, today }: PlanningReportsTabProps) {
    const beneficiaries = useFinanceBeneficiaries();
    const tags = useFinanceTags();
    const kind = getReportScopeKind(scope);
    const dataset = useMemo(
        () => buildReportsDataset(period, transactions, creditCardInvoices, scope, beneficiaries, tags),
        [beneficiaries, creditCardInvoices, period, scope, tags, transactions],
    );
    const scopedWallets = useMemo(() => wallets.filter((wallet) => scope.walletIds.includes(wallet.id)), [scope.walletIds, wallets]);
    const scopedCreditCards = useMemo(() => creditCards.filter((creditCard) => scope.creditCardIds.includes(creditCard.id)), [creditCards, scope.creditCardIds]);

    if (kind === "empty") {
        return <PlanningReportsEmptyState title="Nenhuma conta selecionada" description="Marque ao menos uma carteira ou um cartão acima para montar o relatório." />;
    }

    if (dataset.summary.transactionCount === 0 && kind !== "card" && kind !== "cards") {
        return <PlanningReportsEmptyState />;
    }

    return (
        <section className="flex flex-1 flex-col gap-4 text-left">
            {kind === "wallet" || kind === "wallets" ? (
                <PlanningReportsWalletView dataset={dataset} period={period} transactions={transactions} creditCardInvoices={creditCardInvoices} wallets={scopedWallets} />
            ) : kind === "card" || kind === "cards" ? (
                <PlanningReportsCardView
                    dataset={dataset}
                    period={period}
                    transactions={transactions}
                    creditCardInvoices={creditCardInvoices}
                    creditCards={scopedCreditCards}
                    today={today}
                />
            ) : (
                <PlanningReportsCombinedView dataset={dataset} transactions={transactions} creditCardInvoices={creditCardInvoices} wallets={scopedWallets} creditCards={scopedCreditCards} />
            )}
        </section>
    );
}
