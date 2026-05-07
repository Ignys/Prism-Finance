import { useEffect, useMemo, useRef, useState } from "react";
import {
    type CreditCard,
    type CreditCardInvoice,
    type Transaction,
    useFinanceFavoriteCreditCard,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceActions,
    useFinanceSession,
    useFinanceTransactions,
} from "../../context/FinanceContext";
import {
    buildCreditCardInvoiceId,
    getMonthKeyFromDateValue,
    parseCreditCardInvoiceId,
    resolveCreditCardInvoiceCycle,
    resolveCreditCardInvoiceCycleFromCycleKey,
    resolveExpectedCreditCardInvoiceId,
} from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { AuthShell } from "../layout/AuthShell";
import { AddCardSpending } from "../modal/AddCardSpending";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { EditTransaction } from "../modal/EditTransaction";
import { PayCreditCardInvoiceModal } from "../modal/PayCreditCardInvoiceModal";
import { ReviewInvoiceAssignmentsModal, type InvoiceAssignmentReviewIssue } from "../modal/ReviewInvoiceAssignmentsModal";
import { StatementContentPanel } from "./statement/StatementContentPanel";
import { StatementFiltersPanel } from "./statement/StatementFiltersPanel";
import {
    buildStatementSummary,
    compareInvoicesByDueDate,
    formatMonthLabel,
    INITIAL_STATEMENT_FILTER_STATE,
    resolveDefaultStatementMonth,
    type StatementFilterState,
} from "./statement/statementPageShared";
import { StatementSummaryCards } from "./statement/StatementSummaryCards";

function formatInvoiceReviewLabel(invoiceId: string | null, invoiceById: Map<string, CreditCardInvoice>): string {
    if (!invoiceId) {
        return "Sem fatura";
    }

    const invoice = invoiceById.get(invoiceId);
    if (invoice) {
        return formatMonthLabel(getMonthKeyFromDateValue(invoice.dueDate));
    }

    const parsedInvoice = parseCreditCardInvoiceId(invoiceId);
    if (parsedInvoice) {
        return formatMonthLabel(parsedInvoice.cycleKey);
    }

    return "Fatura invalida";
}

export function StatementPage() {
    const transactions = useFinanceTransactions();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { loading: sessionLoading } = useFinanceSession();
    const { deleteTransaction, setCreditCardInvoicesPaidState } = useFinanceActions();
    const { openModal } = useModal();
    const { consumePendingNavigation } = usePage();
    const [filters, setFilters] = useState<StatementFilterState>(INITIAL_STATEMENT_FILTER_STATE);
    const hasResolvedEntryFiltersRef = useRef(false);

    useEffect(() => {
        if (hasResolvedEntryFiltersRef.current) {
            return;
        }

        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page === "statement") {
            hasResolvedEntryFiltersRef.current = true;

            setFilters((current) => ({
                ...current,
                selectedCardId: pendingNavigation.selectedCardId,
                selectedMonth: pendingNavigation.selectedMonth,
            }));

            return;
        }

        if (sessionLoading) {
            return;
        }

        hasResolvedEntryFiltersRef.current = true;
        const defaultOpenMonth = resolveDefaultStatementMonth(creditCardInvoices, INITIAL_STATEMENT_FILTER_STATE.selectedMonth);

        setFilters((current) => ({
            ...current,
            selectedMonth: defaultOpenMonth,
        }));
    }, [consumePendingNavigation, creditCardInvoices, sessionLoading]);

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

    const invoiceRepairIssues = useMemo<InvoiceAssignmentReviewIssue[]>(() => {
        return transactions
            .filter((transaction): transaction is Transaction & { creditCardId: string } => {
                if (transaction.paymentMethod !== "credit_card" || transaction.type !== "spending" || transaction.status === "cancelled" || !transaction.creditCardId) {
                    return false;
                }

                return selectedCardId === "all" || transaction.creditCardId === selectedCardId;
            })
            .flatMap((transaction) => {
                const creditCard = cardById.get(transaction.creditCardId);
                if (!creditCard) {
                    return [];
                }

                const expectedInvoiceId = resolveExpectedCreditCardInvoiceId({
                    creditCardId: creditCard.id,
                    transactionDate: transaction.date,
                    closingDay: creditCard.closingDay,
                    dueDay: creditCard.dueDay,
                });
                if (!expectedInvoiceId || transaction.invoiceId === expectedInvoiceId) {
                    return [];
                }

                const expectedCycle = resolveCreditCardInvoiceCycle(transaction.date, creditCard.closingDay, creditCard.dueDay);
                const description = transaction.description.trim() || transaction.category.label || "Compra sem descricao";

                return [
                    {
                        transactionId: transaction.id,
                        date: transaction.date,
                        description,
                        cardName: creditCard.name,
                        amount: transaction.value,
                        currentInvoiceLabel: formatInvoiceReviewLabel(transaction.invoiceId, invoiceById),
                        expectedInvoiceLabel: formatMonthLabel(getMonthKeyFromDateValue(expectedCycle.dueDate)),
                    },
                ];
            });
    }, [cardById, invoiceById, selectedCardId, transactions]);

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

    const handleReviewInvoiceAssignments = () => {
        if (invoiceRepairIssues.length < 1) {
            return;
        }

        openModal(<ReviewInvoiceAssignmentsModal issues={invoiceRepairIssues} />);
    };

    const handleInvoiceStateAdjustment = (targetInvoices: CreditCardInvoice[], action: "close" | "reopen") => {
        if (targetInvoices.length < 1) {
            return;
        }

        const isBulk = targetInvoices.length > 1;
        const markAsPaid = action === "close";

        openModal(
            <ConfirmActionModal
                title={markAsPaid ? (isBulk ? "Fechar faturas vencidas?" : "Fechar fatura vencida?") : isBulk ? "Reabrir faturas pagas?" : "Reabrir fatura paga?"}
                description={
                    markAsPaid
                        ? isBulk
                            ? "Essa acao vai marcar as faturas vencidas selecionadas como quitadas sem criar pagamentos."
                            : "Essa acao vai marcar esta fatura vencida como quitada sem criar pagamento."
                        : isBulk
                          ? "Essa acao vai reabrir as faturas pagas selecionadas sem criar estornos ou remover pagamentos existentes."
                          : "Essa acao vai reabrir esta fatura paga sem criar estorno nem remover pagamentos existentes."
                }
                confirmLabel={markAsPaid ? (isBulk ? "Fechar faturas" : "Fechar fatura") : isBulk ? "Reabrir faturas" : "Reabrir fatura"}
                tone="success"
                onConfirm={() =>
                    setCreditCardInvoicesPaidState({
                        invoiceIds: targetInvoices.map((invoice) => invoice.id),
                        markAsPaid,
                    })
                }
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

        const prefillCycleKey = selectedDueMonth;
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
                            onInvoiceStateAdjustment={handleInvoiceStateAdjustment}
                            onCreateCardSpending={handleCreateCardSpendingFromStatement}
                            onReviewInvoiceAssignments={handleReviewInvoiceAssignments}
                            onEdit={handleEditTransaction}
                            onDelete={handleDeleteTransaction}
                            invoiceRepairIssuesCount={invoiceRepairIssues.length}
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
