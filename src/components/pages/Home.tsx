import { AnimatePresence, motion } from "framer-motion";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";
import { MiniTransactionBlock } from "../home/SmTransactionBlock";
import { Charts } from "../home/Charts";
import { DEFAULT_WALLET_ID, useFinanceActions, useFinanceTransactions } from "../../context/FinanceContext";

export function HomePage() {
    const transactions = useFinanceTransactions();
    const { addTransaction, clearTransactions } = useFinanceActions();

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
            meta: { criado_em: new Date().toISOString(), atualizado_em: null, observacoes: [] },
        });
    };

    return (
        <>
            <DisplayModal />
            <main className="justify-center text-center text-white p-5">
                <Header />
                <div className="flex gap-3 justify-center">
                    <button className="default-button py-2 px-6" onClick={exampleSubmit}>
                        Transacao Exemplo
                    </button>
                    <button className="default-button py-2 px-6" onClick={() => clearTransactions()}>
                        Limpar Transacoes
                    </button>
                </div>
                <div className="flex justify-center gap-2 mt-5">
                    <Charts />

                    <section className="w-1/4 space-y-2">
                        <div className="py-4 bg-[#1a1a1a] rounded-2xl">
                            {transactions.length < 1 ? <p className="text-white/50">Nenhuma transacao.</p> : <p className="text-white/50">Suas ultimas transacoes</p>}
                        </div>
                        <AnimatePresence initial={false}>
                            {transactions.slice(-5).reverse().map((transaction) => (
                                <motion.div
                                    key={transaction.id}
                                    layout="position"
                                    initial={{ scaleY: 0.7, opacity: 0 }}
                                    animate={{ scaleY: 1, opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 50 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
                                    <MiniTransactionBlock transaction={transaction} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </section>
                </div>
            </main>
        </>
    );
}
