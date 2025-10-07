// src/App.jsx
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import { Header } from "./components/home/Header";
import prismLogo from "./assets/pngFinal.png";
import "./App.css";
import { CreateTransaction } from "./components/home/Form";
import { useEffect } from "react";
import { format } from "date-fns";
import { CircleUserRound } from "lucide-react";

function App() {
    return (
        <FinanceProvider>
            <MainApp />
        </FinanceProvider>
    );
}

function MainApp() {
    const { user, finance, addTransaction, loading, clearTransactions } = useFinance();

    useEffect(() => {
        console.log(finance);
    }, [finance]);

    if (loading) return <p className="text-white">Carregando...</p>;
    if (!user) return <p className="text-white">Por favor, faça login.</p>;

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
        <main className="justify-center text-center text-white">
            <div className="flex items-center justify-center">
                <img src={prismLogo} className="logo" alt="Prism logo" />
                <h1 className="font-medium">Prism Finance</h1>
            </div>
            <Header />
            <div className="flex gap-3 justify-center">
                <button onClick={exampleSubmit}>Transação Exemplo</button>
                <button onClick={clearTransactions}>Limpar Transações</button>
                {/* <button onClick={console.log("Receita")} className="px-4 py-2 rounded-lg">
                    Adicionar Receita
                </button>
                <button onClick={console.log("Despesa")} className="px-4 py-2 rounded-lg">
                    Adicionar Despesa
                </button> */}
            </div>
            <div className="flex justify-center gap-2 mt-5">
                <div>
                    <CreateTransaction />
                </div>
                <section className="w-300 space-y-2">{finance.transactions.length ? finance.transactions.map((t) => TransactionBlock(t)) : <p>Nenhuma transação.</p>}</section>
            </div>
        </main>
    );
}

function TransactionBlock(transaction) {
    return (
        <div className=" bg-[#1e1e1e] rounded-2xl p-4 flex items-center justify-between">
            <img className="w-18 rounded-full" src={`src/assets/${transaction.fonte.origem}.png`} alt="Logo do banco" />
            <div className="w-45 text-left">
                <h2 className="text-xl font-medium">{transaction.fonte.plataforma}</h2>
                <p className="text-lg">{transaction.descricao}</p>
                <p className="text-lg/1 flex items-center gap-1 text-neutral-300">
                    <CircleUserRound width={20} /> {transaction.beneficiario.para}
                </p>
            </div>
            <div className="w-45 text-right">
                <p className="text-xl font-medium">
                    <span className={transaction.tipo === "receita" ? "text-green-400" : "text-[#c44b4b]"}>R${transaction.valor.quantia.toFixed(2)}</span>
                </p>
                <p className="text-lg">{transaction.categoria.principal}</p>
                <p className="text-lg text-neutral-300">{format(new Date(transaction.data), "dd/MM/yyyy")}</p>
            </div>
            <div className="w-30 text-right">
                <p className="text-xl">{transaction.status}</p>
            </div>
        </div>
    );
}

export default App;
