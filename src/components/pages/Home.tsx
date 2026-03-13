import { Charts } from "../home/Charts";
import { RecentTransactionsPanel } from "../home/RecentTransactionsPanel";
import { AuthShell } from "../layout/AuthShell";
import { useFinanceTransactions } from "../../context/FinanceContext";

export function HomePage() {
    const transactions = useFinanceTransactions();
    const latestTransactions = transactions.slice(-5).reverse();

    return (
        <AuthShell mainClassName="justify-center text-center text-white">
            <div className="flex gap-2 px-8">
                <Charts />
                <RecentTransactionsPanel transactions={latestTransactions} />
            </div>
        </AuthShell>
    );
}
