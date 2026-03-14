import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { Transaction } from "../../../context/FinanceContext";
import { parseAppDate } from "../../../lib/localDate";
import { MiniTransactionBlock } from "./SmTransactionBlock";

interface RecentTransactionsPanelProps {
    transactions: Transaction[];
}

export function RecentTransactionsPanel({ transactions }: RecentTransactionsPanelProps) {
    const recentPaidTransactions = useMemo(() => {
        return [...transactions]
            .filter((transaction) => transaction.status === "paid")
            .sort((a, b) => {
                const dateA = parseAppDate(a.date)?.getTime() ?? 0;
                const dateB = parseAppDate(b.date)?.getTime() ?? 0;
                return dateB - dateA;
            })
            .slice(0, 5);
    }, [transactions]);

    console.log(recentPaidTransactions)
    return (
        <section className="w-full">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-16 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl" />

                <div className="relative mb-3 flex items-center justify-between gap-3">
                    <p className="text-left text-lg font-medium text-white">Últimas transações</p>

                    <div className="space-x-1">
                        <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-neutral-300">{recentPaidTransactions.length}</span>
                    </div>
                </div>

                <div className="relative space-y-2">
                    {recentPaidTransactions.length < 1 ? (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-6 text-center text-sm text-neutral-400">Nenhuma transação paga registrada</div>
                    ) : (
                        <AnimatePresence initial={false} mode="popLayout">
                            {recentPaidTransactions.map((transaction) => (
                                <motion.div
                                    key={transaction.id}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                        opacity: { duration: 0.2, ease: "easeInOut" },
                                        height: { duration: 0.2, ease: "easeInOut" },
                                        layout: { duration: 0.2, ease: "easeInOut" },
                                    }}
                                    style={{ overflow: "hidden" }}
                                >
                                    <MiniTransactionBlock transaction={transaction} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </section>
    );
}
