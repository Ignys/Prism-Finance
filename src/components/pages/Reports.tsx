import { useMemo } from "react";
import { getLocalTodayDate } from "../../lib/localDate";
import { monthPeriod } from "../../context/finance/recurrence/period";
import {
    type ReportPeriod,
    useFinanceActions,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinancePlanning,
    useFinanceTransactions,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { PlanningControlGroup } from "./planning/PlanningControlGroup";
import { PlanningReportPeriodSelector } from "./planning/PlanningReportPeriodSelector";
import { PlanningReportsScopeBar } from "./planning/PlanningReportsScopeBar";
import { PlanningReportsTab } from "./planning/PlanningReportsTab";
import { mergePlanningUpdate } from "./planning/planningTimelineUtils";
import { getAllCreditCardIds, getAllWalletIds } from "./planning/planningWalletScope";
import { useReportScope } from "./planning/reportScope";

// ponytail: parcelas a vencer olham até 24 meses à frente; aumentar se houver parcelamentos mais longos.
const UPCOMING_MONTHS = 24;

export function ReportsPage() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();
    const today = getLocalTodayDate();

    const reportPeriod = planning.reportsPeriod;
    const walletIds = useMemo(() => getAllWalletIds(wallets), [wallets]);
    const creditCardIds = useMemo(() => getAllCreditCardIds(creditCards), [creditCards]);
    const [scope, setScope] = useReportScope(walletIds, creditCardIds);

    // Começa dois meses antes para incluir compras de faturas do período; vai além de hoje para faturas e parcelas futuras.
    const futureEnd = monthPeriod(today.slice(0, 7), 0, UPCOMING_MONTHS).endDate;
    const periodEnd = monthPeriod(reportPeriod.endMonth).endDate;
    const period = { startDate: monthPeriod(reportPeriod.startMonth, 2).startDate, endDate: periodEnd > futureEnd ? periodEnd : futureEnd };
    const transactions = useFinanceTransactions(period);
    const creditCardInvoices = useFinanceCreditCardInvoices(period);

    return (
        <div className="flex min-h-full flex-col gap-5 pb-4">
            <PlanningReportsScopeBar
                wallets={wallets}
                creditCards={creditCards}
                scope={scope}
                onScopeChange={setScope}
                trailing={
                    <PlanningControlGroup>
                        <PlanningReportPeriodSelector
                            period={reportPeriod}
                            onPeriodChange={(nextPeriod: ReportPeriod) => void updatePlanningState(mergePlanningUpdate(planning, { reportsPeriod: nextPeriod }))}
                        />
                    </PlanningControlGroup>
                }
            />
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
