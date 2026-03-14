import { RecentTransactionsPanel } from "./home/RecentTransactionsPanel";
import { SpendingBillsAlertCard } from "./home/SpendingBillsAlertCard";
import { AuthShell } from "../layout/AuthShell";
import { useFinanceTransactions } from "../../context/FinanceContext";
import { Suspense, lazy } from "react";

const BalancoMensal = lazy(() => import("./home/charts/BalancoMensal").then((module) => ({ default: module.BalancoMensal })));
const GastosPorCategoria = lazy(() => import("./home/charts/GastosPorCategoria").then((module) => ({ default: module.GastosPorCategoria })));

export function HomePage() {
    const transactions = useFinanceTransactions();

    return (
        <AuthShell mainClassName="justify-center text-center text-white">
            <div className="flex gap-2 px-8">
                <section className="w-[28%] space-y-2">
                    <SpendingBillsAlertCard transactions={transactions} />
                    <RecentTransactionsPanel transactions={transactions} />
                </section>
                <section className="w-[40%] space-y-2">
                    <Suspense fallback={<div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-sm text-neutral-400">Carregando graficos...</div>}>
                        <BalancoMensal />
                        <GastosPorCategoria />
                    </Suspense>
                </section>
            </div>
        </AuthShell>
    );
}
