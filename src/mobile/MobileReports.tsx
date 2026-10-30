import { useMemo } from "react";
import { PlanningReportPeriodSelector } from "../components/pages/planning/PlanningReportPeriodSelector";
import { PlanningReportsTab } from "../components/pages/planning/PlanningReportsTab";
import { mergePlanningUpdate } from "../components/pages/planning/planningTimelineUtils";
import { getAllCreditCardIds, getAllWalletIds } from "../components/pages/planning/planningWalletScope";
import { useReportScope } from "../components/pages/planning/reportScope";
import { monthPeriod } from "../context/finance/recurrence/period";
import { useFinanceActions, useFinanceCreditCardInvoices, useFinanceCreditCards, useFinancePlanning, useFinanceTransactions, useFinanceWallets } from "../context/FinanceContext";
import { getLocalTodayDate } from "../lib/localDate";
import { MobileAccountCombobox } from "./MobileAccountCombobox";

// Same window as the desktop ReportsPage: upcoming installments look 24 months ahead.
const UPCOMING_MONTHS = 24;

export function MobileReports() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();
    const today = getLocalTodayDate();

    const reportPeriod = planning.reportsPeriod;
    const walletIds = useMemo(() => getAllWalletIds(wallets), [wallets]);
    const creditCardIds = useMemo(() => getAllCreditCardIds(creditCards), [creditCards]);
    const [scope, setScope] = useReportScope(walletIds, creditCardIds);

    const futureEnd = monthPeriod(today.slice(0, 7), 0, UPCOMING_MONTHS).endDate;
    const periodEnd = monthPeriod(reportPeriod.endMonth).endDate;
    const period = { startDate: monthPeriod(reportPeriod.startMonth, 2).startDate, endDate: periodEnd > futureEnd ? periodEnd : futureEnd };
    const transactions = useFinanceTransactions(period);
    const creditCardInvoices = useFinanceCreditCardInvoices(period);

    return (
        <div className="space-y-5 pb-4">
            <div className="space-y-2">
                <div className={`grid gap-2 ${creditCards.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                    <MobileAccountCombobox
                        label="Carteiras"
                        placeholder="Nenhuma carteira"
                        emptyMessage="Nenhuma carteira encontrada."
                        accounts={wallets}
                        values={scope.walletIds}
                        onChange={(ids) => setScope({ ...scope, walletIds: ids })}
                    />
                    {creditCards.length > 0 && (
                        <MobileAccountCombobox
                            label="Cartões"
                            placeholder="Nenhum cartão"
                            emptyMessage="Nenhum cartão encontrado."
                            accounts={creditCards}
                            values={scope.creditCardIds}
                            onChange={(ids) => setScope({ ...scope, creditCardIds: ids })}
                        />
                    )}
                </div>
                <PlanningReportPeriodSelector period={reportPeriod} onPeriodChange={(nextPeriod) => void updatePlanningState(mergePlanningUpdate(planning, { reportsPeriod: nextPeriod }))} />
            </div>

            <PlanningReportsTab
                period={reportPeriod}
                scope={scope}
                transactions={transactions}
                creditCardInvoices={creditCardInvoices}
                wallets={wallets}
                creditCards={creditCards}
                today={today}
            />
        </div>
    );
}
