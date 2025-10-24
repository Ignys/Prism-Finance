// src/App.jsx
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import "./App.css";
import { useEffect } from "react";
import { format } from "date-fns";
import { CircleUserRound } from "lucide-react";
import { LoginPage } from "./components/pages/Login";
import { HomePage } from "./components/pages/Home";
import { LoadingPage } from "./components/pages/Loading";

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
    if (!user) return <LoginPage/>;

    return (
        <LoadingPage/>
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
