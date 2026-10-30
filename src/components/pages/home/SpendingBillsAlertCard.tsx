import { ChevronRight, ReceiptText, TriangleAlert } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { type Transaction, useFinanceCreditCardInvoices, useFinanceCreditCards } from "../../../context/FinanceContext";
import { getCreditCardInvoiceReadState } from "../../../context/finance/invoiceStatus";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { usePage } from "../../../context/PageContext";
import { parseAppDate } from "../../../lib/localDate";
import { formatCurrencyBRL } from "../../transactions/transactionView";

interface SpendingBillsAlertCardProps {
    transactions: Transaction[];
}

interface OverdueInvoiceByCardAlert {
    cardId: string;
    cardName: string;
    // Month key (YYYY-MM) used by statement navigation, based on due date.
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

    const overdueNonCardSpendings = useMemo(() => {
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
        });
    }, [transactions]);

    const overdueInvoiceAlertsByCard = useMemo<OverdueInvoiceByCardAlert[]>(() => {
        const cardById = new Map(creditCards.map((card) => [card.id, card]));
        const cardNameById = new Map(creditCards.map((card) => [card.id, card.name]));
        const alertsByCard = new Map<string, OverdueInvoiceByCardAlert>();

        creditCardInvoices.forEach((invoice) => {
            const card = cardById.get(invoice.creditCardId) ?? null;
            const { openAmount, hasPendingBalance, visualStatus } = getCreditCardInvoiceReadState(invoice, card);
            const isOverdue = hasPendingBalance && visualStatus === "overdue";
            const invoiceDueMonth = getMonthKeyFromDateValue(invoice.dueDate);

            if (!isOverdue) {
                return;
            }

            const existing = alertsByCard.get(invoice.creditCardId);
            if (!existing) {
                alertsByCard.set(invoice.creditCardId, {
                    cardId: invoice.creditCardId,
                    cardName: cardNameById.get(invoice.creditCardId) ?? "Cartao removido",
                    selectedMonth: invoiceDueMonth,
                    selectedDueDate: invoice.dueDate,
                    openAmount,
                    overdueInvoiceCount: 1,
                });
                return;
            }

            const nextSelectedMonth = invoice.dueDate < existing.selectedDueDate ? invoiceDueMonth : existing.selectedMonth;
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

    if (overdueNonCardSpendings.length < 1 && overdueInvoiceAlertsByCard.length < 1) {
        return null;
    }

    const overdueCount = overdueNonCardSpendings.length;
    const overdueTotal = overdueNonCardSpendings.reduce((sum, transaction) => sum + transaction.value, 0);
    const alertCount = (overdueCount > 0 ? 1 : 0) + overdueInvoiceAlertsByCard.length;

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                </span>
                <p className="text-lg font-medium text-white">Precisa de atenção</p>
                <span className="ml-auto text-sm tabular-nums text-neutral-500">{alertCount}</span>
            </div>

            <div className="space-y-1.5">
                {overdueCount > 0 && (
                    <AlertRow
                        tone="rose"
                        icon={<TriangleAlert size={18} />}
                        title={overdueCount === 1 ? "1 conta atrasada" : `${overdueCount} contas atrasadas`}
                        detail="Despesas pendentes com vencimento passado"
                        amount={overdueTotal}
                        onClick={() => goToPage("transactions", { page: "transactions", tab: "spending" })}
                    />
                )}
                {overdueInvoiceAlertsByCard.map((alert) => (
                    <AlertRow
                        key={alert.cardId}
                        tone="amber"
                        icon={<ReceiptText size={18} />}
                        title={`Fatura vencida do ${alert.cardName}`}
                        detail={alert.overdueInvoiceCount > 1 ? `${alert.overdueInvoiceCount} faturas em aberto` : "Valor ainda em aberto"}
                        amount={alert.openAmount}
                        onClick={() => goToPage("statement", { page: "statement", selectedCardId: alert.cardId, selectedMonth: alert.selectedMonth })}
                    />
                ))}
            </div>
        </section>
    );
}

const ALERT_TONES = {
    rose: { tile: "border-rose-400/30 bg-rose-500/10 text-rose-200", amount: "text-rose-300" },
    amber: { tile: "border-amber-300/30 bg-amber-300/10 text-amber-200", amount: "text-amber-300" },
};

interface AlertRowProps {
    tone: keyof typeof ALERT_TONES;
    icon: ReactNode;
    title: string;
    detail: string;
    amount: number;
    onClick: () => void;
}

function AlertRow({ tone, icon, title, detail, amount, onClick }: AlertRowProps) {
    const colors = ALERT_TONES[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2 pr-2.5 text-left outline-none transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            <span className={`flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border ${colors.tile}`}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{title}</span>
                <span className="mt-1 block truncate text-xs text-neutral-500">{detail}</span>
            </span>
            <span className={`shrink-0 text-sm font-semibold tabular-nums ${colors.amount}`}>R$ {formatCurrencyBRL(amount)}</span>
            <ChevronRight size={16} className="shrink-0 text-neutral-600 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-300" />
        </button>
    );
}
