import { Suspense, lazy } from "react";
import { ChartSkeleton } from "../components/loading/CompactSkeletons";
import { RecentTransactionsPanel } from "../components/pages/home/RecentTransactionsPanel";
import { SpendingBillsAlertCard } from "../components/pages/home/SpendingBillsAlertCard";
import { UpcomingPanel } from "../components/pages/home/UpcomingPanel";
import { WealthCard } from "../components/pages/home/WealthCard";
import { useFinanceTransactions } from "../context/FinanceContext";

const BalancoMensal = lazy(() => import("../components/pages/home/charts/BalancoMensal").then((module) => ({ default: module.BalancoMensal })));

export function MobileHome() {
    const transactions = useFinanceTransactions();

    return (
        <div className="space-y-3 pb-4">
            <SpendingBillsAlertCard transactions={transactions} />
            <Suspense fallback={<ChartSkeleton />}>
                <BalancoMensal />
            </Suspense>
            <WealthCard />
            <UpcomingPanel transactions={transactions} />
            <RecentTransactionsPanel transactions={transactions} />
        </div>
    );
}
