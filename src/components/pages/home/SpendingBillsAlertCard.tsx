import { ReceiptText, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { type Transaction, useFinanceCreditCardInvoices, useFinanceCreditCards } from "../../../context/FinanceContext";
import { usePage } from "../../../context/PageContext";
import { getLocalTodayDate, parseAppDate } from "../../../lib/localDate";
import { formatCurrencyBRL } from "../../transactions/transactionView";

interface SpendingBillsAlertCardProps {
    transactions: Transaction[];
}

interface OverdueInvoiceByCardAlert {
    cardId: string;
    cardName: string;
    selectedMonth: string;
    selectedDueDate: string;
    openAmount: number;
    overdueInvoiceCount: number;
}

function isDateBeforeToday(dateValue: string, today: Date): boolean {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return false;
    }

    const normalizedDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    return normalizedDate.getTime() < today.getTime();
}

export function SpendingBillsAlertCard({ transactions }: SpendingBillsAlertCardProps) {
    const { goToPage } = usePage();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();

    const overdueNonCardSpendingsCount = useMemo(() => {
        const todayReference = new Date();
        const today = new Date(todayReference.getFullYear(), todayReference.getMonth(), todayReference.getDate());

        return transactions.filter((transaction) => {
            if (transaction.type !== "spending") {
                return false;
            }

            if (transaction.status !== "pending") {
                return false;
            }

            if (transaction.paymentMethod === "credit_card") {
                return false;
            }

            return isDateBeforeToday(transaction.date, today);
        }).length;
    }, [transactions]);

    const overdueInvoiceAlertsByCard = useMemo<OverdueInvoiceByCardAlert[]>(() => {
        const cardNameById = new Map(creditCards.map((card) => [card.id, card.name]));
        const today = getLocalTodayDate();
        const alertsByCard = new Map<string, OverdueInvoiceByCardAlert>();

        creditCardInvoices.forEach((invoice) => {
            const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
            const isOverdue = invoice.status !== "paid" && openAmount > 0 && today > invoice.dueDate;

            if (!isOverdue) {
                return;
            }

            const existing = alertsByCard.get(invoice.creditCardId);
            if (!existing) {
                alertsByCard.set(invoice.creditCardId, {
                    cardId: invoice.creditCardId,
                    cardName: cardNameById.get(invoice.creditCardId) ?? "Cartao removido",
                    selectedMonth: invoice.cycleKey,
                    selectedDueDate: invoice.dueDate,
                    openAmount,
                    overdueInvoiceCount: 1,
                });
                return;
            }

            const nextSelectedMonth = invoice.dueDate < existing.selectedDueDate ? invoice.cycleKey : existing.selectedMonth;
            const nextSelectedDueDate = invoice.dueDate < existing.selectedDueDate ? invoice.dueDate : existing.selectedDueDate;

            alertsByCard.set(invoice.creditCardId, {
                ...existing,
                selectedMonth: nextSelectedMonth,
                selectedDueDate: nextSelectedDueDate,
                openAmount: existing.openAmount + openAmount,
                overdueInvoiceCount: existing.overdueInvoiceCount + 1,
            });
        });

        return Array.from(alertsByCard.values()).sort((a, b) => a.selectedDueDate.localeCompare(b.selectedDueDate));
    }, [creditCardInvoices, creditCards]);

    if (overdueNonCardSpendingsCount < 1 && overdueInvoiceAlertsByCard.length < 1) {
        return null;
    }

    return (
        <section className="w-full space-y-2">
            {overdueNonCardSpendingsCount > 0 && (
                <article className="relative overflow-hidden rounded-2xl border border-red-400/28 bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                    <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-red-500/14 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -right-16 h-36 w-36 rounded-full bg-rose-500/11 blur-3xl" />

                    <div className="relative flex items-start justify-between gap-3 text-left">
                        <div className="flex items-start gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-300/30 bg-red-500/18 text-red-100">
                                <TriangleAlert size={15} />
                            </span>
                            <div>
                                <p className="text-base font-medium text-red-100">Contas atrasadas</p>
                                <p className="text-sm text-red-100/72">
                                    Você tem {overdueNonCardSpendingsCount} {overdueNonCardSpendingsCount === 1 ? "conta atrasada" : "contas atrasadas"}.
                                </p>
                            </div>
                        </div>
                        <span className="rounded-full border border-red-300/30 bg-red-500/16 px-2.5 py-1 text-xs font-semibold text-red-100">
                            {overdueNonCardSpendingsCount}
                        </span>
                    </div>

                    <footer className="relative mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => goToPage("transactions", { page: "transactions", tab: "spending" })}
                            className="rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-red-100 transition-colors hover:border-red-300/45 hover:bg-red-500/20"
                        >
                            Ver despesas atrasadas
                        </button>
                    </footer>
                </article>
            )}

            {overdueInvoiceAlertsByCard.map((alert) => (
                <article key={alert.cardId} className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                    <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-amber-500/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -right-16 h-36 w-36 rounded-full bg-yellow-400/10 blur-3xl" />

                    <div className="relative text-left">
                        <div className="flex items-start gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-500/16 text-amber-100">
                                <ReceiptText size={15} />
                            </span>
                            <div>
                                <p className="text-base font-medium text-amber-100">Fatura vencida - {alert.cardName}</p>
                                <p className="text-sm text-amber-100/70">Valor em aberto: R$ {formatCurrencyBRL(alert.openAmount)}</p>
                                {alert.overdueInvoiceCount > 1 && (
                                    <p className="text-xs text-amber-100/60">Inclui {alert.overdueInvoiceCount} faturas vencidas desse cartao.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <footer className="relative mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() =>
                                goToPage("statement", {
                                    page: "statement",
                                    selectedCardId: alert.cardId,
                                    selectedMonth: alert.selectedMonth,
                                })
                            }
                            className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-amber-100 transition-colors hover:border-amber-300/45 hover:bg-amber-500/20"
                        >
                            Ver fatura
                        </button>
                    </footer>
                </article>
            ))}
        </section>
    );
}
