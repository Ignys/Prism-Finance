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

    const deleteTransaction = async (transaction) => {
        const updatedTransactions = finance.transactions.filter((t) => t !== transaction);
        const updatedDespesas = updatedTransactions.reduce((sum, t) => sum + (t.tipo === "despesa" ? t.valor.quantia : 0), 0);
        const updatedReceitas = updatedTransactions.reduce((sum, t) => sum + (t.tipo === "receita" ? t.valor.quantia : 0), 0);
        const updatedBalance = updatedReceitas - updatedDespesas;

        updateFinance({
            despesas: updatedDespesas,
            receitas: updatedReceitas,
            balance: updatedBalance,
            transactions: updatedTransactions,
        })
    }

    const addTransaction = async (newTransaction) => {
        updateFinance({
            despesas: finance.despesas + (newTransaction.tipo === "despesa" ? newTransaction.valor.quantia : 0),
            receitas: finance.receitas + (newTransaction.tipo === "receita" ? newTransaction.valor.quantia : 0),
            balance: newTransaction.tipo === "receita" ? finance.balance + newTransaction.valor.quantia : finance.balance - newTransaction.valor.quantia,
            transactions: [...finance.transactions, newTransaction],
        });
    };

    const value = {
        user,
        finance,
        updateFinance,
        addTransaction,
        deleteTransaction,
        clearTransactions,
        loading,
    };

    return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

// Hook de conveniência
export function useFinance() {
    return useContext(FinanceContext);
}
