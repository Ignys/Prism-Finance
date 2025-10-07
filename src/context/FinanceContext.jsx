// src/context/FinanceContext.jsx
import { createContext, useContext } from "react";
import { useAuthListener } from "../hooks/useAuthListener";
import { setUserField } from "../firebase/userService";

const FinanceContext = createContext();

export function FinanceProvider({ children }) {
    const { user, finance, setFinance, loading } = useAuthListener();

    // 🔹 Atualiza Firestore sempre que finance mudar
    const updateFinance = async (newFinance) => {
        if (user) {
            setFinance(newFinance);
            await setUserField(user.uid, "finance", newFinance);
        }
    };

    const clearTransactions = async () => {
        const clearedFinance = { despesas: 0, receitas: 0, balance: 0, transactions: [] };
        updateFinance(clearedFinance);
    };

    const addTransaction = async (newTransaction) => {
        updateFinance({
            despesas: finance.despesas + (newTransaction.tipo === "despesa" ? newTransaction.valor.quantia : 0),
            receitas: finance.receitas + (newTransaction.tipo === "receita" ? newTransaction.valor.quantia : 0),
            balance: newTransaction.tipo === "receita" ? finance.balance + newTransaction.valor.quantia : finance.balance - newTransaction.valor.quantia,
            transactions: [...finance.transactions, newTransaction],
        });
    };

    return <FinanceContext.Provider value={{ user, finance, updateFinance, addTransaction, clearTransactions, loading }}>{children}</FinanceContext.Provider>;
}

// Hook de conveniência
export function useFinance() {
    return useContext(FinanceContext);
}
