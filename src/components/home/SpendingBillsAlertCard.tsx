import { Check, CircleAlert, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { type Transaction, type TransactionDraft, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { parseAppDate } from "../../lib/localDate";
import { formatCurrencyBRL, formatTransactionDate, resolveTransactionWallet } from "../transactions/transactionView";

interface SpendingBillsAlertCardProps {
    transactions: Transaction[];
}

type AlertState = "clear" | "pending" | "overdue";

interface AlertTheme {
    borderClass: string;
    glowTopClass: string;
    glowBottomClass: string;
    titleClass: string;
    badgeClass: string;
    iconContainerClass: string;
    iconClass: string;
    itemBorderClass: string;
    itemDateClass: string;
}

interface AlertContent {
    state: AlertState;
    icon: LucideIcon;
    title: string;
    items: Transaction[];
}

const LIST_LIMIT = 5;

const THEMES: Record<AlertState, AlertTheme> = {
    clear: {
        borderClass: "border-emerald-400/22",
        glowTopClass: "bg-emerald-500/14",
        glowBottomClass: "bg-emerald-400/10",
        titleClass: "text-emerald-100",
        badgeClass: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
        iconContainerClass: "border-emerald-300/25 bg-emerald-500/16",
        iconClass: "text-emerald-100",
        itemBorderClass: "border-emerald-300/18 bg-emerald-500/[0.05]",
        itemDateClass: "text-emerald-100/70",
    },
    pending: {
        borderClass: "border-amber-400/25",
        glowTopClass: "bg-amber-500/15",
        glowBottomClass: "bg-yellow-400/10",
        titleClass: "text-amber-100",
        badgeClass: "border-amber-300/30 bg-amber-500/15 text-amber-100",
        iconContainerClass: "border-amber-300/25 bg-amber-500/16",
        iconClass: "text-amber-100",
        itemBorderClass: "border-amber-300/20 bg-amber-500/[0.05]",
        itemDateClass: "text-amber-100/70",
    },
    overdue: {
        borderClass: "border-red-400/28",
        glowTopClass: "bg-red-500/14",
        glowBottomClass: "bg-rose-500/11",
        titleClass: "text-red-100",
        badgeClass: "border-red-300/30 bg-red-500/16 text-red-100",
        iconContainerClass: "border-red-300/30 bg-red-500/18",
        iconClass: "text-red-100",
        itemBorderClass: "border-red-300/22 bg-red-500/[0.05]",
        itemDateClass: "text-red-100/72",
    },
};

function sortByDateAsc(a: Transaction, b: Transaction): number {
    const dateA = parseAppDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dateB = parseAppDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
}

export function SpendingBillsAlertCard({ transactions }: SpendingBillsAlertCardProps) {
    const { addTransaction, deleteTransaction, markTransactionAsPaid } = useFinanceActions();
    const [processingIds, setProcessingIds] = useState<string[]>([]);
    const [processingBulk, setProcessingBulk] = useState<"pay" | "cancel" | null>(null);
    const wallets = useFinanceWallets();

    const alertContent = useMemo<AlertContent>(() => {
        const todayReference = new Date();
        const today = new Date(todayReference.getFullYear(), todayReference.getMonth(), todayReference.getDate());
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const pendingSpendings = transactions.filter((transaction) => transaction.type === "spending" && transaction.status === "pending");
        const overdue: Transaction[] = [];
        const upcomingThisMonth: Transaction[] = [];

        pendingSpendings.forEach((transaction) => {
            const parsedDate = parseAppDate(transaction.date);
            if (!parsedDate) {
                return;
            }

            const transactionDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

            if (transactionDate.getTime() < today.getTime()) {
                overdue.push(transaction);
                return;
            }

            if (transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
                upcomingThisMonth.push(transaction);
            }
        });

        overdue.sort(sortByDateAsc);
        upcomingThisMonth.sort(sortByDateAsc);

        if (overdue.length > 0) {
            return {
                state: "overdue",
                icon: TriangleAlert,
                title: "Atenção! Você tem contas atrasadas.",
                items: overdue,
            };
        }

        if (upcomingThisMonth.length > 0) {
            return {
                state: "pending",
                icon: CircleAlert,
                title: "Você tem contas pendentes neste mês.",
                items: upcomingThisMonth,
            };
        }

        return {
            state: "clear",
            icon: Check,
            title: "Bom trabalho! Suas contas estão em dia.",
            items: [],
        };
    }, [transactions]);

    const theme = THEMES[alertContent.state];
    const AlertIcon = alertContent.icon;
    const visibleItems = alertContent.items.slice(0, LIST_LIMIT);
    const hasItems = alertContent.items.length > 0;

    const trackProcessing = (transactionId: string, active: boolean) => {
        setProcessingIds((current) => {
            if (active && !current.includes(transactionId)) {
                return [...current, transactionId];
            }

            if (!active) {
                return current.filter((id) => id !== transactionId);
            }

            return current;
        });
    };

    const toCancelledDraft = (transaction: Transaction): TransactionDraft => ({
        type: transaction.type,
        value: transaction.value,
        date: transaction.date,
        inWallet: transaction.inWallet,
        categoryId: transaction.category.id ?? null,
        beneficiaryId: transaction.beneficiaryId ?? null,
        tagIds: transaction.tagIds,
        description: transaction.description,
        status: "cancelled",
        notes: transaction.description || undefined,
    });

    const handlePayTransaction = async (transaction: Transaction) => {
        if (processingBulk !== null) {
            return;
        }

        trackProcessing(transaction.id, true);
        try {
            await markTransactionAsPaid(transaction);
        } catch (error) {
            console.error("Failed to mark transaction as paid:", error);
        } finally {
            trackProcessing(transaction.id, false);
        }
    };

    const handleCancelTransaction = async (transaction: Transaction) => {
        if (processingBulk !== null) {
            return;
        }

        trackProcessing(transaction.id, true);
        try {
            await addTransaction(toCancelledDraft(transaction));
            await deleteTransaction(transaction);
        } catch (error) {
            console.error("Failed to cancel transaction:", error);
        } finally {
            trackProcessing(transaction.id, false);
        }
    };

    const runBulkAction = async (type: "pay" | "cancel") => {
        if (processingBulk !== null || !hasItems) {
            return;
        }

        setProcessingBulk(type);
        const targetTransactions = [...alertContent.items];

        for (const transaction of targetTransactions) {
            trackProcessing(transaction.id, true);
            try {
                if (type === "pay") {
                    await markTransactionAsPaid(transaction);
                } else {
                    await addTransaction(toCancelledDraft(transaction));
                    await deleteTransaction(transaction);
                }
            } catch (error) {
                console.error(`Failed to process ${type} for transaction:`, error);
            } finally {
                trackProcessing(transaction.id, false);
            }
        }

        setProcessingBulk(null);
    };

    return (
        <section className="w-full">
            <div className={`relative overflow-hidden rounded-2xl border ${theme.borderClass} bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]`}>
                <div className={`pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full ${theme.glowTopClass} blur-3xl`} />
                <div className={`pointer-events-none absolute -bottom-24 -right-16 h-36 w-36 rounded-full ${theme.glowBottomClass} blur-3xl`} />

                <div className="relative mb-3 flex items-center justify-between gap-3">
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${theme.iconContainerClass}`}>
                                <AlertIcon size={15} className={theme.iconClass} />
                            </span>
                            <p className={`text-lg font-medium ${theme.titleClass}`}>{alertContent.title}</p>
                        </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${theme.badgeClass}`}>{alertContent.items.length}</span>
                </div>

                <div className="relative space-y-2 text-left">
                    {visibleItems.length > 0 && (
                        <div className="space-y-2 pt-1.5">
                            {visibleItems.map((transaction) => (
                                <article key={transaction.id} className={`rounded-xl border px-3 py-2.5 ${theme.itemBorderClass}`}>
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex flex-col">
                                            <p className="line-clamp-1 text-sm font-semibold text-white">{transaction.description || "Sem descricao"}</p>
                                            <p className={`truncate text-[14px] ${theme.itemDateClass}`}>{resolveTransactionWallet(wallets, transaction.inWallet)?.name ?? ""}</p>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <div className="flex flex-col text-right">
                                                <span className="text-[15px] font-semibold text-white">R$ {formatCurrencyBRL(transaction.value)}</span>
                                                <p className={`truncate text-[14px] ${theme.itemDateClass}`}>{formatTransactionDate(transaction.date, "dd/MM")}</p>
                                            </div>
                                            <div className="flex flex-row-reverse gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => void handlePayTransaction(transaction)}
                                                    disabled={processingBulk !== null || processingIds.includes(transaction.id)}
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-500/12 text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label="Marcar como pago"
                                                    title="Marcar como pago"
                                                >
                                                    <Check size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleCancelTransaction(transaction)}
                                                    disabled={processingBulk !== null || processingIds.includes(transaction.id)}
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-300/30 bg-red-500/12 text-red-100 transition-colors hover:border-red-300/45 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label="Cancelar transacao"
                                                    title="Cancelar transacao"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                            {alertContent.items.length > LIST_LIMIT && (
                                <p className={`text-[11px] ${theme.itemDateClass}`}>
                                    Mostrando {LIST_LIMIT} de {alertContent.items.length} despesas.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <footer className="w-full flex flex-row-reverse gap-1 mt-3">
                    <button
                        type="button"
                        onClick={() => void runBulkAction("pay")}
                        disabled={!hasItems || processingBulk !== null}
                        className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processingBulk === "pay" ? "Pagando..." : "Pagar todos"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void runBulkAction("cancel")}
                        disabled={!hasItems || processingBulk !== null}
                        className="rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-100 transition-colors hover:border-red-300/45 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processingBulk === "cancel" ? "Cancelando..." : "Cancelar todos"}
                    </button>
                </footer>
            </div>
        </section>
    );
}
