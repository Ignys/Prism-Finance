// src/App.jsx
import { Header } from "../../components/home/Header";
import prismLogo from "../../assets/pngFinal.png";
import { CreateTransaction } from "../../components/home/Form";
import { useFinance } from "../../context/FinanceContext";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionBlock } from "../home/TransactionBlock";

export function HomePage() {
    const { user, finance, addTransaction, loading, clearTransactions } = useFinance();

    useEffect(() => {
        console.log(finance);
    }, [finance]);

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
        <main className="justify-center text-center text-white p-5">
            <div className="flex items-center justify-center">
                <img src={prismLogo} className="logo" alt="Prism logo" />
                <h1 className="font-medium">Prism Finance</h1>
            </div>
            <Header />
            <div className="flex gap-3 justify-center">
                <button className="default-button" onClick={exampleSubmit}>Transação Exemplo</button>
                <button className="default-button" onClick={clearTransactions}>Limpar Transações</button>
            </div>
            <div className="flex justify-center gap-2 mt-5">
                <div>
                    <CreateTransaction />
                </div>
                <section className="w-300 space-y-2">
                    <div className="py-4 bg-[#1e1e1e] rounded-2xl">
                        {finance.transactions.length === 0 ? <p className="text-white/50">Nenhuma transação.</p> : <p className="text-white/50">Suas últimas transações — {finance.transactions.length}</p>}
                    </div>
                    <AnimatePresence initial={false}>
                        {finance.transactions.map((t) => (
                            <motion.div
                                key={t.id}
                                layout="position"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 30 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                            >
                                <TransactionBlock key={t.id} transaction={t} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </section>
            </div>
        </main>
    );
}