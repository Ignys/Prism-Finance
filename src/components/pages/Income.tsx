import { AnimatePresence, motion } from "framer-motion";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";
import { TransactionBlock } from "../home/TransactionBlock";
import { useFinanceTransactions } from "../../context/FinanceContext";

export function IncomePage() {
    const transactions = useFinanceTransactions();
    const incomes = transactions.filter((transaction) => transaction.type === "income");

    return (
        <>
            <DisplayModal />
            <main className="justify-center text-center text-white p-5 ">
                <Header />
                <div className="flex justify-center gap-2 mt-5">
                    <section className="w-6/10 space-y-2">
                        <div className="py-4 bg-neutral-900 rounded-lg">
                            {incomes.length < 1 ? <p className="text-white/50">Nenhuma receita esse mes.</p> : <p className="text-white/50">Suas ultimas receitas - {incomes.length}</p>}
                        </div>
                        <AnimatePresence initial={false}>
                            {incomes.map((transaction) => (
                                <motion.div
                                    key={transaction.id}
                                    layout="position"
                                    initial={{ scaleY: 0.7, opacity: 0 }}
                                    animate={{ scaleY: 1, opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 50 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
                                    <TransactionBlock transaction={transaction} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </section>
                    <section className="flex flex-col gap-2">
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Pendencias</p>
                            <span>R$0.00</span>
                        </div>
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Efetuadas</p>
                            <span>R$0.00</span>
                        </div>
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Total</p>
                            <span>R$0.00</span>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
