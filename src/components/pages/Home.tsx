import { Charts } from "../home/Charts";
import { RecentTransactionsPanel } from "../home/RecentTransactionsPanel";
import { AuthShell } from "../layout/AuthShell";
import { DEFAULT_WALLET_ID, useFinanceActions, useFinanceTransactions } from "../../context/FinanceContext";

export function HomePage() {
    const transactions = useFinanceTransactions();
    const { addTransaction } = useFinanceActions();
    const latestTransactions = transactions.slice(-5).reverse();

    const exampleSubmit = () => {
        addTransaction({
            id: Date.now().toString(),
            type: "spending",
            value: 29.99,
            date: new Date().toISOString().split("T")[0],
            inWallet: DEFAULT_WALLET_ID,
            category: { principal: "Transporte", sub: null },
            beneficiary: "Xuxu",
            description: "Corrida",
            status: true,
        });
    };

    return (
        <AuthShell mainClassName="justify-center text-center text-white">
            <div className="flex gap-2 px-8">
                <Charts />
                <RecentTransactionsPanel transactions={latestTransactions} onExampleSubmit={exampleSubmit} />
            </div>
        </AuthShell>
    );
}
