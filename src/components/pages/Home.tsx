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
        <AuthShell mainClassName="text-center text-white">
            <div className="grid w-full gap-3 xl:grid-cols-[minmax(280px,400px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,420px)_minmax(0,700px)_minmax(0,1fr)]">
                <section className="min-w-0 space-y-2">
                    <SpendingBillsAlertCard transactions={transactions} />
                    <RecentTransactionsPanel transactions={transactions} />
                </section>
                <section className="min-w-0 space-y-2">
                    <GastosPorCategoria />
                </section>
                <section className="min-w-0 space-y-2">
                    <Suspense fallback={<div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-sm text-neutral-400">Carregando graficos...</div>}>
                        <BalancoMensal />
                    </Suspense>
                </section>
            </div>
        </AuthShell>
    );
}
