import { useEffect, useMemo, useState } from "react";
import {
    type CreditCard,
    type CreditCardInvoice,
    useFinanceFavoriteCreditCard,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceActions,
    useFinanceTransactions,
} from "../../context/FinanceContext";
import { buildCreditCardInvoiceId, getMonthKeyFromDateValue, resolveCreditCardInvoiceCycleFromCycleKey } from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { AuthShell } from "../layout/AuthShell";
import { AddCardSpending } from "../modal/AddCardSpending";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { EditTransaction } from "../modal/EditTransaction";
import { PayCreditCardInvoiceModal } from "../modal/PayCreditCardInvoiceModal";
import { StatementContentPanel } from "./statement/StatementContentPanel";
import { StatementFiltersPanel } from "./statement/StatementFiltersPanel";
import {
    buildStatementSummary,
    compareInvoicesByDueDate,
    INITIAL_STATEMENT_FILTER_STATE,
    shiftMonth,
    type StatementFilterState,
} from "./statement/statementPageShared";
import { StatementSummaryCards } from "./statement/StatementSummaryCards";

export function StatementPage() {
    const transactions = useFinanceTransactions();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { deleteTransaction } = useFinanceActions();
    const { openModal } = useModal();
    const { consumePendingNavigation } = usePage();
    const [filters, setFilters] = useState<StatementFilterState>(INITIAL_STATEMENT_FILTER_STATE);

    useEffect(() => {
        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page !== "statement") {
            return;
        }

        setFilters((current) => ({
            ...current,
            selectedCardId: pendingNavigation.selectedCardId,
            selectedMonth: pendingNavigation.selectedMonth,
        }));
    }, [consumePendingNavigation]);

    const { selectedMonth: selectedDueMonth, selectedCardId } = filters;

    const setFilter = <K extends keyof StatementFilterState>(key: K, value: StatementFilterState[K]) => {
        setFilters((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const cardById = useMemo(() => {
        const map = new Map<string, CreditCard>();
        creditCards.forEach((creditCard) => {
            map.set(creditCard.id, creditCard);
        });
        return map;
    }, [creditCards]);

    const cardNameById = useMemo(() => {
        const map = new Map<string, string>();
        creditCards.forEach((creditCard) => {
            map.set(creditCard.id, creditCard.name);
        });
        return map;
    }, [creditCards]);

    const invoiceById = useMemo(() => {
        const map = new Map<string, CreditCardInvoice>();
        creditCardInvoices.forEach((invoice) => {
            map.set(invoice.id, invoice);
        });
        return map;
    }, [creditCardInvoices]);

    const selectedCardName = useMemo(() => {
        if (selectedCardId === "all") {
            return "Todos os cartoes";
        }

        return cardById.get(selectedCardId)?.name ?? "Cartao removido";
    }, [cardById, selectedCardId]);

    const scopedCards = useMemo(() => {
        if (selectedCardId === "all") {
            return creditCards;
        }

        return creditCards.filter((creditCard) => creditCard.id === selectedCardId);
    }, [creditCards, selectedCardId]);

    const scopedInvoices = useMemo(() => {
        return creditCardInvoices.filter((invoice) => selectedCardId === "all" || invoice.creditCardId === selectedCardId);
    }, [creditCardInvoices, selectedCardId]);

    const monthInvoices = useMemo(() => {
        return scopedInvoices.filter((invoice) => getMonthKeyFromDateValue(invoice.dueDate) === selectedDueMonth).sort(compareInvoicesByDueDate);
    }, [scopedInvoices, selectedDueMonth]);

    const monthInvoiceIds = useMemo(() => new Set(monthInvoices.map((invoice) => invoice.id)), [monthInvoices]);

    const monthTransactions = useMemo(() => {
        return transactions
            .filter(
                (transaction) =>
                    transaction.paymentMethod === "credit_card" &&
                    transaction.type === "spending" &&
                    transaction.status !== "cancelled" &&
                    Boolean(transaction.invoiceId),
            )
            .filter((transaction) => {
                if (selectedCardId !== "all" && transaction.creditCardId !== selectedCardId) {
                    return false;
                }

                if (!transaction.invoiceId) {
                    return false;
                }

                return monthInvoiceIds.has(transaction.invoiceId);
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [monthInvoiceIds, selectedCardId, transactions]);

    const summary = useMemo(
        () =>
            buildStatementSummary({
                selectedMonth: selectedDueMonth,
                selectedCardName,
                scopedCards,
                scopedInvoices,
                monthInvoices,
                monthTransactions,
                cardNameById,
            }),
        [selectedDueMonth, selectedCardName, scopedCards, scopedInvoices, monthInvoices, monthTransactions, cardNameById],
    );

    const handlePayInvoice = (invoice: CreditCardInvoice, creditCard: CreditCard) => {
        openModal(<PayCreditCardInvoiceModal invoice={invoice} creditCard={creditCard} />);
    };

    const handleEditTransaction = (transaction: (typeof transactions)[number]) => {
        openModal(<EditTransaction transaction={transaction} />);
    };

    const handleDeleteTransaction = (transaction: (typeof transactions)[number]) => {
        const transactionLabel = transaction.description.trim() || transaction.category.label;

        openModal(
            <ConfirmActionModal
                title="Excluir transacao?"
                description={`Essa acao remove "${transactionLabel}" em definitivo.`}
                confirmLabel="Excluir"
                tone="danger"
                onConfirm={() => deleteTransaction(transaction)}
            />,
        );
    };

    const handleCreateCardSpendingFromStatement = () => {
        const activeCards = creditCards.filter((card) => card.isActive);
        const favoriteCard = favoriteCreditCardId ? creditCards.find((card) => card.id === favoriteCreditCardId) ?? null : null;
        const fallbackCard = activeCards[0] ?? creditCards[0] ?? null;

        const selectedCard =
            selectedCardId === "all"
                ? (favoriteCard && favoriteCard.isActive ? favoriteCard : fallbackCard)
                : (creditCards.find((card) => card.id === selectedCardId) ?? favoriteCard ?? fallbackCard);

        if (!selectedCard) {
            return;
        }

        const prefillCycleKey = shiftMonth(selectedDueMonth, -1);
        const prefillInvoiceId = buildCreditCardInvoiceId(selectedCard.id, prefillCycleKey);
        const prefillDate = resolveCreditCardInvoiceCycleFromCycleKey(prefillCycleKey, selectedCard.closingDay, selectedCard.dueDay).dueDate;

        openModal(
            <AddCardSpending
                prefill={{
                    initialCreditCardId: selectedCard.id,
                    initialCycleKey: prefillCycleKey,
                    initialInvoiceId: prefillInvoiceId,
                    initialDate: prefillDate,
                }}
            />,
        );
    };

    return (
        <AuthShell mainClassName="text-white">
            <div className="w-full flex justify-center space-y-3">
                <div className="flex flex-col gap-3 2xl:flex-row w-[90%]">
                    <div className="min-w-0 flex-1 space-y-3">
                        <StatementFiltersPanel
                            selectedMonth={selectedDueMonth}
                            selectedCardId={selectedCardId}
                            selectedCardName={selectedCardName}
                            creditCards={creditCards}
                            openInMonth={summary.openInMonth}
                            onMonthChange={(value) => setFilter("selectedMonth", value)}
                            onCardChange={(value) => setFilter("selectedCardId", value)}
                        />

                        <StatementContentPanel
                            selectedMonth={selectedDueMonth}
                            allCardsSelected={selectedCardId === "all"}
                            invoices={monthInvoices}
                            transactions={monthTransactions}
                            cardById={cardById}
                            invoiceById={invoiceById}
                            onPayInvoice={handlePayInvoice}
                            onCreateCardSpending={handleCreateCardSpendingFromStatement}
                            onEdit={handleEditTransaction}
                            onDelete={handleDeleteTransaction}
                        />
                    </div>

                    <div className="w-full 2xl:w-[230px]">
                        <StatementSummaryCards summary={summary} />
                    </div>
                </div>
            </div>
        </AuthShell>
    );
}
