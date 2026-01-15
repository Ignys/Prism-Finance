// src/context/FinanceContext.jsx
import { createContext, useContext, ReactNode } from "react";
import { useAuthListener } from "../hooks/useAuthListener";
import { setUserField } from "../firebase/userService";

export interface Transaction {
  id: string;
  type: string;
  value: number;
  date: string;
  source: {
    platform: string;
    bank: string;
  };
  category: {
    principal: string;
    sub: string | null;
  };
  beneficiary: string;
  description: string;
  status: boolean;
  meta: {
    criado_em: string;
    atualizado_em: string | null;
    observacoes?: unknown[];
  };
}

interface Finance {
  despesas: number;
  receitas: number;
  balance: number;
  transactions: Transaction[];
}

interface FinanceContextType {
  user: any;
  finance: Finance | null;
  updateFinance: (newFinance: Finance) => Promise<void>;
  addTransaction: (newTransaction: Transaction) => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
  clearTransactions: () => Promise<void>;
  loading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
    const { user, finance, setFinance, loading } = useAuthListener();

    // 🔹 Atualiza Firestore sempre que finance mudar
    const updateFinance = async (newFinance: Finance) => {
        if (user) {
            setFinance(newFinance);
            await setUserField(user.uid, "finance", newFinance);
        }
    };

    const clearTransactions = async () => {
        const clearedFinance: Finance = { despesas: 0, receitas: 0, balance: 0, transactions: [] };
        await updateFinance(clearedFinance);
    };

    const deleteTransaction = async (transaction: Transaction) => {
        if (!finance) return;
        const updatedTransactions = finance.transactions.filter((t) => t !== transaction);
        const updatedDespesas = updatedTransactions.reduce((sum, t) => sum + (t.tipo === "despesa" ? t.valor.quantia : 0), 0);
        const updatedReceitas = updatedTransactions.reduce((sum, t) => sum + (t.tipo === "receita" ? t.valor.quantia : 0), 0);
        const updatedBalance = updatedReceitas - updatedDespesas;

        await updateFinance({
            despesas: updatedDespesas,
            receitas: updatedReceitas,
            balance: updatedBalance,
            transactions: updatedTransactions,
        });
    };

    const addTransaction = async (newTransaction: Transaction) => {
        if (!finance) return;
        const newDespesas = finance.despesas + (newTransaction.type === "despesa" ? newTransaction.value : 0);
        const newReceitas = finance.receitas + (newTransaction.type === "receita" ? newTransaction.value : 0);
        const newBalance = newReceitas - newDespesas;

        await updateFinance({
            despesas: newDespesas,
            receitas: newReceitas,
            balance: newBalance,
            transactions: [...finance.transactions, newTransaction],
        });
    };

    const value: FinanceContextType = {
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
    const context = useContext(FinanceContext);
    if (!context) {
        throw new Error("useFinance must be used within a FinanceProvider");
    }
    return context;
}
