import { useEffect, useMemo, useRef, useState } from "react";
import { type CreditCard, type CreditCardInvoice, useFinanceFavoriteCreditCard, useFinanceCreditCardInvoices, useFinanceCreditCards, useFinanceActions, useFinanceSession, useFinanceTransactions } from "../../context/FinanceContext";
import {
    buildCreditCardInvoiceId,
    getMonthKeyFromDateValue,
    resolveCreditCardInvoiceCycleFromCycleKey,
} from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { AuthShell } from "../layout/AuthShell";
import { AddCardSpending } from "../modal/AddCardSpending";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { PayCreditCardInvoiceModal } from "../modal/PayCreditCardInvoiceModal";
import { useTransactionContextActionHandler } from "../transactions/useTransactionContextActionHandler";
import { StatementContentPanel } from "./statement/StatementContentPanel";
import { StatementFiltersPanel } from "./statement/StatementFiltersPanel";
import {
    buildStatementSummary,
    compareInvoicesByDueDate,
    INITIAL_STATEMENT_FILTER_STATE,
    resolveDefaultStatementFilters,
    type StatementFilterState,
} from "./statement/statementPageShared";
import { StatementSummaryCards } from "./statement/StatementSummaryCards";

export function StatementPage() {
    const transactions = useFinanceTransactions();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { loading: sessionLoading } = useFinanceSession();
    const { setCreditCardInvoicesPaidState } = useFinanceActions();
    const { openModal } = useModal();
    const handleTransactionContextAction = useTransactionContextActionHandler();
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
        const defaultFilters = resolveDefaultStatementFilters({
            creditCards,
            creditCardInvoices,
            favoriteCreditCardId,
            fallbackMonth: INITIAL_STATEMENT_FILTER_STATE.selectedMonth,
        });

        setFilters(defaultFilters);
    }, [consumePendingNavigation, creditCardInvoices, creditCards, favoriteCreditCardId, sessionLoading]);

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
        if (!selectedCardId) {
            return "Nenhum cartao";
        }

        return cardById.get(selectedCardId)?.name ?? "Cartao removido";
    }, [cardById, selectedCardId]);

    const scopedCards = useMemo(() => {
        if (!selectedCardId) {
            return [];
        }

        return creditCards.filter((creditCard) => creditCard.id === selectedCardId);
    }, [creditCards, selectedCardId]);

    const scopedInvoices = useMemo(() => {
        if (!selectedCardId) {
            return [];
        }

        return creditCardInvoices.filter((invoice) => invoice.creditCardId === selectedCardId);
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
                if (transaction.creditCardId !== selectedCardId) {
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

        const selectedCard = creditCards.find((card) => card.id === selectedCardId) ?? (favoriteCard && favoriteCard.isActive ? favoriteCard : fallbackCard);

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
            <div className="flex">
                <div className="flex flex-col gap-3 2xl:flex-row w-full">
                    <div className="min-w-0 flex-1 space-y-3">
                        <StatementFiltersPanel
                            selectedMonth={selectedDueMonth}
                            selectedCardId={selectedCardId}
                            creditCards={creditCards}
                            onMonthChange={(value) => setFilter("selectedMonth", value)}
                            onCardChange={(value) => setFilter("selectedCardId", value)}
                        />

                        <StatementContentPanel
                            selectedMonth={selectedDueMonth}
                            invoices={monthInvoices}
                            transactions={monthTransactions}
                            cardById={cardById}
                            invoiceById={invoiceById}
                            onPayInvoice={handlePayInvoice}
                            onInvoiceStateAdjustment={handleInvoiceStateAdjustment}
                            onCreateCardSpending={handleCreateCardSpendingFromStatement}
                            onAction={handleTransactionContextAction}
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
