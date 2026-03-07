import { Context, createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuthListener } from "../hooks/useAuthListener";
import { db } from "../firebase/firebaseClient";
import { mergeFinanceFields } from "../firebase/userService";
import {
    calculateFinanceSummary,
    calculateTotalBalance,
    createFinanceSnapshot,
    DEFAULT_WALLET,
    FinanceSnapshot,
    getSignedTransactionValue,
    normalizeFinanceSnapshot,
    normalizeTransaction,
    normalizeWallet,
    normalizeWalletId,
    Transaction,
    Wallet,
} from "./financeTypes";

export type { FinanceSnapshot, Transaction, TransactionType, Wallet } from "./financeTypes";
export { DEFAULT_WALLET_ID } from "./financeTypes";

interface FinanceSessionValue {
    user: User | null;
    loading: boolean;
}

interface FinanceSummaryValue {
    despesas: number;
    receitas: number;
    balance: number;
}

interface FinanceActionsValue {
    setStartBalance: (walletId: string, balance: number) => Promise<void>;
    updateFinance: (newFinance: FinanceSnapshot) => Promise<void>;
    addTransaction: (newTransaction: Transaction) => Promise<void>;
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    clearTransactions: () => Promise<void>;
    addWallet: (newWallet: Wallet) => Promise<void>;
}

interface FinanceContextType extends FinanceActionsValue {
    user: User | null;
    loading: boolean;
    finance: FinanceSnapshot | null;
    wallets: Wallet[];
    transactions: Transaction[];
    despesas: number;
    receitas: number;
    balance: number;
}

const FinanceSessionContext = createContext<FinanceSessionValue | undefined>(undefined);
const FinanceWalletsContext = createContext<Wallet[] | undefined>(undefined);
const FinanceTransactionsContext = createContext<Transaction[] | undefined>(undefined);
const FinanceSummaryContext = createContext<FinanceSummaryValue | undefined>(undefined);
const FinanceActionsContext = createContext<FinanceActionsValue | undefined>(undefined);

function useRequiredContext<T>(context: Context<T | undefined>, hookName: string): T {
    const value = useContext(context);
    if (!value) {
        throw new Error(`${hookName} must be used within a FinanceProvider`);
    }
    return value;
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuthListener();
    const [wallets, setWallets] = useState<Wallet[]>([DEFAULT_WALLET]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [financeLoading, setFinanceLoading] = useState(true);

    const walletsRef = useRef(wallets);
    const transactionsRef = useRef(transactions);

    useEffect(() => {
        walletsRef.current = wallets;
    }, [wallets]);

    useEffect(() => {
        transactionsRef.current = transactions;
    }, [transactions]);

    useEffect(() => {
        let isActive = true;

        const loadFinance = async () => {
            if (!user) {
                if (isActive) {
                    setWallets([DEFAULT_WALLET]);
                    setTransactions([]);
                    setFinanceLoading(false);
                }
                return;
            }

            setFinanceLoading(true);

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                const rawFinance = snap.exists() ? (snap.data().finance as unknown) : null;
                const { snapshot, changed } = normalizeFinanceSnapshot(rawFinance);

                if (!isActive) {
                    return;
                }

                setWallets(snapshot.wallets);
                setTransactions(snapshot.transactions);

                if (changed) {
                    void mergeFinanceFields(user.uid, {
                        wallets: snapshot.wallets,
                        transactions: snapshot.transactions,
                    });
                }
            } catch (error) {
                console.error("Failed to load finance data:", error);
                if (isActive) {
                    setWallets([DEFAULT_WALLET]);
                    setTransactions([]);
                }
            } finally {
                if (isActive) {
                    setFinanceLoading(false);
                }
            }
        };

        void loadFinance();

        return () => {
            isActive = false;
        };
    }, [user]);

    const persistFinanceFields = useCallback(
        async (fields: { wallets?: Wallet[]; transactions?: Transaction[] }) => {
            if (!user) {
                return;
            }
            await mergeFinanceFields(user.uid, fields);
        },
        [user],
    );

    const updateFinance = useCallback(
        async (newFinance: FinanceSnapshot) => {
            const normalized = normalizeFinanceSnapshot(newFinance).snapshot;
            setWallets(normalized.wallets);
            setTransactions(normalized.transactions);
            await persistFinanceFields({
                wallets: normalized.wallets,
                transactions: normalized.transactions,
            });
        },
        [persistFinanceFields],
    );

    const setStartBalance = useCallback(
        async (walletId: string, newStartBalance: number) => {
            const normalizedWalletId = normalizeWalletId(walletId);
            const safeStartBalance = roundToCents(Number(newStartBalance));
            if (!Number.isFinite(safeStartBalance)) {
                return;
            }

            const nextWallets = walletsRef.current.map((wallet) => {
                if (wallet.id !== normalizedWalletId) {
                    return wallet;
                }

                const transactionalDelta = wallet.balance - wallet.startBalance;
                return {
                    ...wallet,
                    startBalance: safeStartBalance,
                    balance: roundToCents(safeStartBalance + transactionalDelta),
                };
            });

            setWallets(nextWallets);
            await persistFinanceFields({ wallets: nextWallets });
        },
        [persistFinanceFields],
    );

    const addWallet = useCallback(
        async (newWallet: Wallet) => {
            const wallet = normalizeWallet(newWallet);
            const nextWallets = walletsRef.current.some((item) => item.id === wallet.id)
                ? walletsRef.current.map((item) => (item.id === wallet.id ? wallet : item))
                : [...walletsRef.current, wallet];

            setWallets(nextWallets);
            await persistFinanceFields({ wallets: nextWallets });
        },
        [persistFinanceFields],
    );

    const clearTransactions = useCallback(async () => {
        const nextWallets = walletsRef.current.map((wallet) => ({
            ...wallet,
            balance: wallet.startBalance,
        }));

        setTransactions([]);
        setWallets(nextWallets);
        await persistFinanceFields({
            wallets: nextWallets,
            transactions: [],
        });
    }, [persistFinanceFields]);

    const addTransaction = useCallback(
        async (newTransaction: Transaction) => {
            const normalizedTransaction = normalizeTransaction(newTransaction);
            const transactionDelta = getSignedTransactionValue(normalizedTransaction);

            const nextTransactions = [...transactionsRef.current, normalizedTransaction];
            const nextWallets = walletsRef.current.map((wallet) => {
                if (wallet.id !== normalizedTransaction.inWallet) {
                    return wallet;
                }

                return {
                    ...wallet,
                    balance: roundToCents(wallet.balance + transactionDelta),
                };
            });

            setTransactions(nextTransactions);
            setWallets(nextWallets);

            await persistFinanceFields({
                wallets: nextWallets,
                transactions: nextTransactions,
            });
        },
        [persistFinanceFields],
    );

    const deleteTransaction = useCallback(
        async (transaction: Transaction) => {
            const currentTransactions = transactionsRef.current;
            const transactionToDelete = currentTransactions.find((item) => item.id === transaction.id);
            if (!transactionToDelete) {
                return;
            }

            const transactionDelta = getSignedTransactionValue(transactionToDelete);
            const nextTransactions = currentTransactions.filter((item) => item.id !== transactionToDelete.id);
            const nextWallets = walletsRef.current.map((wallet) => {
                if (wallet.id !== transactionToDelete.inWallet) {
                    return wallet;
                }

                return {
                    ...wallet,
                    balance: roundToCents(wallet.balance - transactionDelta),
                };
            });

            setTransactions(nextTransactions);
            setWallets(nextWallets);

            await persistFinanceFields({
                wallets: nextWallets,
                transactions: nextTransactions,
            });
        },
        [persistFinanceFields],
    );

    const loading = authLoading || financeLoading;
    const summary = useMemo(() => calculateFinanceSummary(transactions), [transactions]);
    const balance = useMemo(() => roundToCents(calculateTotalBalance(wallets)), [wallets]);

    const sessionValue = useMemo<FinanceSessionValue>(
        () => ({
            user,
            loading,
        }),
        [loading, user],
    );

    const summaryValue = useMemo<FinanceSummaryValue>(
        () => ({
            despesas: roundToCents(summary.despesas),
            receitas: roundToCents(summary.receitas),
            balance,
        }),
        [balance, summary.despesas, summary.receitas],
    );

    const actionsValue = useMemo<FinanceActionsValue>(
        () => ({
            setStartBalance,
            updateFinance,
            addTransaction,
            deleteTransaction,
            clearTransactions,
            addWallet,
        }),
        [addTransaction, addWallet, clearTransactions, deleteTransaction, setStartBalance, updateFinance],
    );

    return (
        <FinanceSessionContext.Provider value={sessionValue}>
            <FinanceWalletsContext.Provider value={wallets}>
                <FinanceTransactionsContext.Provider value={transactions}>
                    <FinanceSummaryContext.Provider value={summaryValue}>
                        <FinanceActionsContext.Provider value={actionsValue}>{children}</FinanceActionsContext.Provider>
                    </FinanceSummaryContext.Provider>
                </FinanceTransactionsContext.Provider>
            </FinanceWalletsContext.Provider>
        </FinanceSessionContext.Provider>
    );
}

export function useFinanceSession() {
    return useRequiredContext(FinanceSessionContext, "useFinanceSession");
}

export function useFinanceWallets() {
    return useRequiredContext(FinanceWalletsContext, "useFinanceWallets");
}

export function useFinanceTransactions() {
    return useRequiredContext(FinanceTransactionsContext, "useFinanceTransactions");
}

export function useFinanceSummary() {
    return useRequiredContext(FinanceSummaryContext, "useFinanceSummary");
}

export function useFinanceActions() {
    return useRequiredContext(FinanceActionsContext, "useFinanceActions");
}

export function useFinance(): FinanceContextType {
    const { user, loading } = useFinanceSession();
    const wallets = useFinanceWallets();
    const transactions = useFinanceTransactions();
    const { despesas, receitas, balance } = useFinanceSummary();
    const actions = useFinanceActions();

    const finance = useMemo(() => {
        if (!user) {
            return null;
        }
        return createFinanceSnapshot(wallets, transactions);
    }, [transactions, user, wallets]);

    return useMemo(
        () => ({
            user,
            loading,
            finance,
            wallets,
            transactions,
            despesas,
            receitas,
            balance,
            ...actions,
        }),
        [actions, balance, despesas, finance, loading, receitas, transactions, user, wallets],
    );
}
