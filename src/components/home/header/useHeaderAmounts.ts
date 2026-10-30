import { useMemo } from "react";
import { useFinanceCreditCardInvoices, useFinanceSummary, useFinanceTransactions, useFinanceWallets } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { getLocalTodayDate } from "../../../lib/localDate";

export interface HeaderAmounts {
    balance: number;
    receitas: number;
    despesas: number;
    pendingInvoices: number;
}

export function useHeaderAmounts(): HeaderAmounts {
    const summary = useFinanceSummary();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();

    const pendingInvoicesAmount = useMemo(
        () =>
            Number(
                creditCardInvoices
                    .reduce((sum, invoice) => {
                        const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
                        return sum + openAmount;
                    }, 0)
                    .toFixed(2),
            ),
        [creditCardInvoices],
    );

    const walletInclusionById = useMemo(() => new Map(wallets.map((wallet) => [wallet.id, wallet.includeInMainTotals])), [wallets]);

    const monthlySummary = useMemo(() => {
        const currentMonthKey = getMonthKeyFromDateValue(getLocalTodayDate());

        const totals = transactions.reduce(
            (acc, transaction) => {
                if (transaction.status !== "paid") {
                    return acc;
                }

                if (getMonthKeyFromDateValue(transaction.date) !== currentMonthKey) {
                    return acc;
                }

                if ((walletInclusionById.get(transaction.inWallet) ?? true) === false) {
                    return acc;
                }

                if (transaction.type === "income") {
                    acc.receitas += transaction.value;
                    return acc;
                }

                if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card") {
                    acc.despesas += transaction.value;
                }

                return acc;
            },
            { receitas: 0, despesas: 0 },
        );

        return {
            receitas: Number(totals.receitas.toFixed(2)),
            despesas: Number(totals.despesas.toFixed(2)),
        };
    }, [transactions, walletInclusionById]);

    return useMemo(
        () => ({
            balance: summary.balance,
            receitas: monthlySummary.receitas,
            despesas: monthlySummary.despesas,
            pendingInvoices: pendingInvoicesAmount,
        }),
        [monthlySummary.despesas, monthlySummary.receitas, pendingInvoicesAmount, summary.balance],
    );
}
