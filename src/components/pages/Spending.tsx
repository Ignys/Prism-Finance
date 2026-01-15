import { AnimatePresence, motion } from "framer-motion";
import { TransactionBlock } from "../home/TransactionBlock";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";
import { useFinance } from "../../context/FinanceContext";

export function SpendingPage() {

    const { finance } = useFinance();
    const spendings = finance?.transactions.filter(t => t.type === "spending") || [];

    if (!finance) {
        return <p>Carregando despesas...</p>;
    }

    return (
        <>
            <DisplayModal />
            <main className="justify-center text-center text-white p-5 ">
                <Header />
                <div className="flex justify-center gap-2 mt-5">
                    <section className="w-6/10 space-y-2">
                        <div className="py-4 bg-neutral-900 rounded-lg">
                            {spendings.length < 1 ? (
                                <p className="text-white/50">Nenhuma despesa esse mês.</p>
                            ) : (
                                <p className="text-white/50">Suas últimas despesas — {finance.transactions.length}</p>
                            )}
                        </div>
                        <AnimatePresence initial={false}>
                            {spendings.map((t) => (
                                <motion.div
                                    key={t.id}
                                    layout="position"
                                    // initial={{ opacity: 0, x: 50 }}
                                    // animate={{ opacity: 1, x: 0 }}
                                    // exit={{ opacity: 0, x: 50 }}
                                    initial={{ scaleY: 0.7, opacity: 0 }}
                                    animate={{ scaleY: 1, opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 50 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
                                    <TransactionBlock key={t.id} transaction={t} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </section>
                    <section className="flex flex-col gap-2">
                        {/* Placeholder for future content or sidebar */}
                        
                            <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                                <p className="font-light text-white/50">Pendências</p>    
                                <span>R$0.00</span>                            
                            </div>
                            <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                                <p className="font-light text-white/50">Efetuadas</p>    
                                <span>R$0.00</span>                            
                            </div>
                            <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                                <p className="font-light text-white/50">Gastos total</p>    
                                <span>R$0.00</span>                            
                            </div>
                            <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                                <p className="font-light text-white/50">Projeção de saldo</p>    
                                <span>R$0.00</span>                            
                            </div>
                            
                    </section>
                </div>
            </main>
        </>
    );
}

