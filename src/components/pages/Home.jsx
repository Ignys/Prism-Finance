// src/App.jsx
import { Header } from "../../components/home/Header";
import prismLogo from "../../assets/pngFinal.png";
import { CreateTransaction } from "../../components/home/Form";
import { useFinance } from "../../context/FinanceContext";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionBlock } from "../home/TransactionBlock";
import { DisplayModal } from "../modal/DisplayModal";
import { useModal } from "../../context/ModalContext";

export function HomePage() {
    const { finance, addTransaction, clearTransactions } = useFinance();

    const exampleSubmit = () => {
        const transaction = {
            id: Date.now().toString(),
            tipo: "despesa",
            valor: { quantia: 50, moeda: "BRL" },
            data: new Date().toISOString().split("T")[0],
            fonte: { plataforma: "Uber", origem: "Nubank" },
            categoria: { principal: "Transporte", subcategoria: null },
            beneficiario: { para: "Xuxu" },
            descricao: "Corrida",
            status: "Efetuado",
            meta: { criado_em: new Date().toISOString(), atualizado_em: null, observacoes: [] },
        };
        addTransaction(transaction);
    };

    return (
        <>
            <DisplayModal />
            <main className="justify-center text-center text-white p-5 ">
                <div className="flex items-center justify-center">
                    <img src={prismLogo} className="logo h-[8em]" alt="Prism logo" />
                    <h1 className="font-medium text-4xl">Prism Finance</h1>
                </div>
                <Header />
                <div className="flex gap-3 justify-center">
                    <button className="default-button py-2 px-6" onClick={exampleSubmit}>Transação Exemplo</button>
                    <button className="default-button py-2 px-6" onClick={clearTransactions}>Limpar Transações</button>
                </div>
                <div className="flex justify-center gap-2 mt-5">
                    <div className="w-1/4">
                        <CreateTransaction />
                    </div>
                    <section className="w-3/6 space-y-2">
                        <div className="py-4 bg-[#1e1e1e] rounded-2xl">
                            {finance.transactions.length < 1 ? <p className="text-white/50">Nenhuma transação.</p> : <p className="text-white/50">Suas últimas transações — {finance.transactions.length}</p>}
                        </div>
                        <AnimatePresence initial={false}>
                            {finance.transactions.map((t) => (
                                <motion.div
                                    key={t.id}
                                    layout="position"
                                    // initial={{ opacity: 0, x: 50 }}
                                    // animate={{ opacity: 1, x: 0 }}
                                    // exit={{ opacity: 0, x: 50 }}
                                    initial={{scaleY: 0.7, opacity: 0}}
                                    animate={{scaleY: 1, opacity: 1, x: 0}}
                                    exit={{ opacity: 0, x: 50}}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
                                    <TransactionBlock key={t.id} transaction={t} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </section>
                </div>
            </main>
        </>
    );
}