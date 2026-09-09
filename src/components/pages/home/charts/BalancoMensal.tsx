import { useFinanceTransactions } from "../../../../context/FinanceContext";
import { transactionSettlementDate } from "../../../../lib/transactionSettlementDate";

export function BalancoMensal() {
    const transactions = useFinanceTransactions();

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(currentDate);

    const currentMonthTransactions = transactions.filter((t) => {
        const transactionDate = transactionSettlementDate(t);
        if (!transactionDate) {
            return false;
        }
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const isIncludedStatus = (status: string | null | undefined) => status === "paid";
    const includedMonthTransactions = currentMonthTransactions.filter((tx) => isIncludedStatus(tx.status));

    const incomes = includedMonthTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.value, 0);

    const spendingTransactions = includedMonthTransactions.filter((tx) => tx.type === "spending").filter((tx) => tx.paymentMethod !== "credit_card");

    const spending = spendingTransactions.reduce((sum, tx) => sum + tx.value, 0);
    const invoicePaymentSpending = spendingTransactions.filter((tx) => tx.systemKind === "invoice_payment").reduce((sum, tx) => sum + tx.value, 0);
    const invoicePaymentSpendingInRange = Math.min(invoicePaymentSpending, spending);
    const monthlyRegularSpending = Math.max(0, spending - invoicePaymentSpendingInRange);

    const balance = incomes - spending;
    const maxMonthlyValue = Math.max(incomes, spending, 0);
    const incomeRelativeHeight = maxMonthlyValue > 0 ? (incomes / maxMonthlyValue) * 100 : 0;
    const spendingRelativeHeight = maxMonthlyValue > 0 ? (spending / maxMonthlyValue) * 100 : 0;
    const invoiceShareWithinSpending = spending > 0 ? (invoicePaymentSpendingInRange / spending) * 100 : 0;
    const regularShareWithinSpending = spending > 0 ? (monthlyRegularSpending / spending) * 100 : 0;
    const regularShareForDisplay = maxMonthlyValue > 0 ? (monthlyRegularSpending / maxMonthlyValue) * 100 : 0;
    const invoiceShareForDisplay = maxMonthlyValue > 0 ? (invoicePaymentSpendingInRange / maxMonthlyValue) * 100 : 0;
    const largestValue = Math.max(incomes, spending);
    const balanceDifferenceVsLargest = largestValue > 0 ? (balance / largestValue) * 100 : null;
    const balanceDifferenceVsIncome = incomes > 0 ? (balance / incomes) * 100 : null;
    const spendingVsIncome = incomes > 0 ? (spending / incomes) * 100 : null;
    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className={`pointer-events-none absolute -left-20 -top-24 h-44 w-44 rounded-full blur-3xl ${balance >= 0 ? "bg-emerald-400/[0.10]" : "bg-red-500/[0.08]"}`} />
            <div className={`pointer-events-none absolute -bottom-24 -right-20 h-44 w-44 rounded-full blur-3xl ${balance >= 0 ? "bg-emerald-400/[0.10]" : "bg-red-500/[0.08]"}`} />

            <div className="relative mb-5 flex items-center justify-between gap-3">
                <p className="text-lg font-medium text-white">Balanço do mês</p>
                <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.12em] text-neutral-300">{monthLabel}</span>
            </div>

            <div className="relative flex justify-between gap-3">
                <div className="w-[20%] rounded-xl border border-white/[0.06] bg-black/20 p-6">
                    <div className="flex h-full items-end justify-center gap-3">
                        <div className="h-full w-5 overflow-hidden rounded-full">
                            <div className="flex h-full items-end">
                                <div
                                    className="w-full rounded-full bg-gradient-to-t from-emerald-500/50 to-emerald-400 transition-all duration-700 ease-out"
                                    style={{ height: `${incomeRelativeHeight}%` }}
                                />
                            </div>
                        </div>

                        <div className="h-full w-5 overflow-hidden">
                            <div className="flex h-full items-end">
                                <div className="flex w-full flex-col-reverse gap-1 transition-all duration-700 ease-out" style={{ height: `${spendingRelativeHeight}%` }}>
                                    {monthlyRegularSpending > 0 && <div className={`${!invoiceShareWithinSpending ? "rounded-full" : "rounded-b-full"} w-full bg-gradient-to-t from-red-500/50 to-red-400`} style={{ height: `${regularShareWithinSpending}%` }} />}
                                    {invoicePaymentSpendingInRange > 0 && <div className={`${!monthlyRegularSpending ? "rounded-full" : "rounded-t-full"} w-full bg-amber-400 `} style={{ height: `${invoiceShareWithinSpending}%` }} />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-3">
                    <div className=" ">
                        <div className="border-b border-white/[0.06] p-2.5 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-emerald-400" />
                                    <span className="font-medium text-neutral-200">Receitas</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-neutral-400">{incomeRelativeHeight.toFixed(1)}%</span>
                                    <p className="font-semibold text-emerald-300">R$ {formatCurrency(incomes)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 p-2.5 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-red-400" />
                                    <span className="font-medium text-neutral-200">Despesas</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-neutral-400">{regularShareForDisplay.toFixed(1)}%</span>
                                    <p className=" font-semibold text-red-300">R$ {formatCurrency(monthlyRegularSpending)}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-amber-400" />
                                    <span className="font-medium text-neutral-200">Faturas</span>
                                </div>
                                <div className=" flex items-center gap-3 text-sm">
                                    <span className="text-neutral-400">{invoiceShareForDisplay.toFixed(1)}%</span>
                                    <p className=" font-semibold text-yellow-200">R$ {formatCurrency(invoicePaymentSpendingInRange)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-xl justify-between flex flex-col border p-3 ${balance >= 0 ? "border-emerald-500/30 bg-emerald-500/[0.08]" : "border-red-500/30 bg-red-700/[0.08]"}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-medium text-neutral-200">Total do mês</span>
                            </div>
                            <div className=" flex items-center gap-3">
                                <span className="text-neutral-400">{balanceDifferenceVsLargest !== null ? `${balanceDifferenceVsLargest.toFixed(1)}%` : "--"}</span>
                                <span className={`font-semibold ${balance >= 0 ? "text-emerald-300" : "text-red-300"}`}>R$ {formatCurrency(balance)}</span>
                            </div>
                        </div>
                        <p className="mt-1 text-sm text-right text-neutral-300">
                            {incomes <= 0 && spending <= 0 && "Sem transações neste mês"}
                            {incomes <= 0 && spending > 0 && "Você não teve ganhos no período e registrou despesas."}
                            {incomes > 0 && balance < 0 && spendingVsIncome !== null && `Você gastou ${spendingVsIncome.toFixed(1)}% da sua renda.`}
                            {incomes > 0 && balance >= 0 && balanceDifferenceVsIncome !== null && `Você economizou ${balanceDifferenceVsIncome.toFixed(1)}% da sua renda.`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
