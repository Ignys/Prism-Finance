import { Charts } from "../home/Charts";
import { RecentTransactionsPanel } from "../home/RecentTransactionsPanel";
import { SpendingBillsAlertCard } from "../home/SpendingBillsAlertCard";
import { AuthShell } from "../layout/AuthShell";
import { useFinanceTransactions } from "../../context/FinanceContext";

export function HomePage() {
    const transactions = useFinanceTransactions();

    return (
        <AuthShell mainClassName="justify-center text-center text-white">
            <div className="flex gap-2 px-8">
                <div className="w-3/10 space-y-2">
                    <SpendingBillsAlertCard transactions={transactions} />
                    <RecentTransactionsPanel transactions={transactions} />
                </div>
                <Charts />
            </div>
        </AuthShell>
    );
}
