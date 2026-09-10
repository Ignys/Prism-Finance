import { monthPeriod } from "../../context/finance/recurrence/period";
import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import {
    type CreditCard,
    type CreditCardInvoice,
    useFinanceFavoriteCreditCard,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceActions,
    useFinanceSession,
    useFinanceTransactions,
} from "../../context/FinanceContext";
import { buildCreditCardInvoiceId, getMonthKeyFromDateValue, resolveCreditCardInvoiceCycle, resolveCreditCardInvoiceCycleFromCycleKey } from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { usePage } from "../../context/PageContext";
import { useLocalPreferenceSection } from "../../lib/localPreferences";
import { getLocalTodayDate } from "../../lib/localDate";
import { AddCardSpending } from "../modal/AddCardSpending";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { PayCreditCardInvoiceModal } from "../modal/PayCreditCardInvoiceModal";
import { useTransactionContextActionHandler } from "../transactions/useTransactionContextActionHandler";
import { StatementContentPanel } from "./statement/StatementContentPanel";
import {
    buildStatementSummary,
    compareInvoicesByDueDate,
    resolveCurrentInvoiceMonth,
    INITIAL_STATEMENT_FILTER_STATE,
    resolveDefaultStatementFilters,
    selectInvoicePayments,
    type StatementFilterState,
} from "./statement/statementPageShared";
import { StatementOverviewPanel } from "./statement/StatementOverviewPanel";

const STATEMENT_PAGE_PREFERENCES_SECTION = "statement";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatementFilterState(value: unknown): StatementFilterState {
    if (!isRecord(value)) {
        return INITIAL_STATEMENT_FILTER_STATE;
    }

    const selectedMonth = typeof value.selectedMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.selectedMonth) ? value.selectedMonth : INITIAL_STATEMENT_FILTER_STATE.selectedMonth;
    const selectedCardIds = Array.isArray(value.selectedCardIds)
        ? value.selectedCardIds.filter((cardId): cardId is string => typeof cardId === "string")
        : typeof value.selectedCardId === "string" && value.selectedCardId
          ? [value.selectedCardId]
          : INITIAL_STATEMENT_FILTER_STATE.selectedCardIds;

    return {
        selectedMonth,
        selectedCardIds,
    };
}

export function StatementPage() {
    const creditCards = useFinanceCreditCards();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { loading: sessionLoading, user } = useFinanceSession();
    const { setCreditCardInvoicesPaidState } = useFinanceActions();
    const { openModal } = useModal();
    const handleTransactionContextAction = useTransactionContextActionHandler();
    const { consumePendingNavigation } = usePage();
    const [filters, setFilters] = useLocalPreferenceSection(user?.uid, STATEMENT_PAGE_PREFERENCES_SECTION, INITIAL_STATEMENT_FILTER_STATE, normalizeStatementFilterState);
    const hasResolvedEntryFiltersRef = useRef(false);
    const period = monthPeriod(filters.selectedMonth, 2);
    const transactions = useFinanceTransactions(period);
    const creditCardInvoices = useFinanceCreditCardInvoices(period);

    useEffect(() => {
        if (hasResolvedEntryFiltersRef.current) {
            return;
        }

        const pendingNavigation = consumePendingNavigation();
        if (pendingNavigation?.page === "statement") {
            hasResolvedEntryFiltersRef.current = true;

            setFilters((current) => ({
                ...current,
                selectedCardIds: [pendingNavigation.selectedCardId],
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

        setFilters((current) => {
            const hasValidStoredCard = current.selectedCardIds[0] && creditCards.some((card) => card.id === current.selectedCardIds[0]);
            return hasValidStoredCard ? current : defaultFilters;
        });
    }, [consumePendingNavigation, creditCardInvoices, creditCards, favoriteCreditCardId, sessionLoading, setFilters]);

    useEffect(() => {
        if (!hasResolvedEntryFiltersRef.current || sessionLoading) {
            return;
        }

        setFilters((current) => {
            if (!current.selectedCardIds[0] || creditCards.some((card) => card.id === current.selectedCardIds[0])) {
                return current;
            }

            return resolveDefaultStatementFilters({
                creditCards,
                creditCardInvoices,
                favoriteCreditCardId,
                fallbackMonth: current.selectedMonth,
            });
        });
    }, [creditCardInvoices, creditCards, favoriteCreditCardId, sessionLoading, setFilters]);

    const { selectedMonth: selectedDueMonth, selectedCardIds } = filters;
    // ponytail: só o primeiro cartão selecionado escopa fatura/resumo; o multiselect no overview é preparo para agregação futura, ainda não pedida.
    const selectedCardId = selectedCardIds[0] ?? "";

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
            .filter((transaction) => transaction.paymentMethod === "credit_card" && transaction.type === "spending" && transaction.status !== "cancelled" && Boolean(transaction.invoiceId))
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

    const monthInvoicePayments = useMemo(() => {
        return selectInvoicePayments(transactions, monthInvoiceIds);
    }, [monthInvoiceIds, transactions]);

    const monthInvoiceItems = useMemo(() => [...monthTransactions, ...monthInvoicePayments], [monthInvoicePayments, monthTransactions]);

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

    const currentInvoiceMonth = useMemo(() => resolveCurrentInvoiceMonth(scopedCards[0] ?? null, scopedInvoices, selectedDueMonth), [scopedCards, scopedInvoices, selectedDueMonth]);

    const handlePayInvoice = (invoice: CreditCardInvoice, creditCard: CreditCard, settleWithoutWallet = false) => {
        openModal(<PayCreditCardInvoiceModal invoice={invoice} creditCard={creditCard} defaultSettleWithoutWallet={settleWithoutWallet} />);
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
                            ? "Essa acao vai quitar as faturas vencidas selecionadas sem movimentar carteiras."
                            : "Essa acao vai quitar esta fatura vencida sem movimentar carteira."
                        : isBulk
                          ? "Essa acao vai reabrir as faturas selecionadas e remover suas quitacoes vinculadas."
                          : "Essa acao vai reabrir esta fatura e remover sua quitacao vinculada."
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
        const favoriteCard = favoriteCreditCardId ? (creditCards.find((card) => card.id === favoriteCreditCardId) ?? null) : null;
        const fallbackCard = activeCards[0] ?? creditCards[0] ?? null;

        const selectedCard = creditCards.find((card) => card.id === selectedCardId) ?? (favoriteCard && favoriteCard.isActive ? favoriteCard : fallbackCard);

        if (!selectedCard) {
            return;
        }

        const today = getLocalTodayDate();
        const openCycle = resolveCreditCardInvoiceCycle(today, selectedCard.closingDay, selectedCard.dueDay);
        const prefillCycleKey = selectedDueMonth;
        const prefillInvoiceId = buildCreditCardInvoiceId(selectedCard.id, prefillCycleKey);
        const prefillDate = prefillCycleKey === openCycle.cycleKey ? today : resolveCreditCardInvoiceCycleFromCycleKey(prefillCycleKey, selectedCard.closingDay, selectedCard.dueDay).dueDate;

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
        <div className="flex">
            <div className="flex flex-col gap-3 2xl:flex-row w-full">
                <div className="min-w-0 flex-1 space-y-3">
                    <StatementContentPanel
                        selectedMonth={selectedDueMonth}
                        invoices={monthInvoices}
                        transactions={monthInvoiceItems}
                        cardById={cardById}
                        invoiceById={invoiceById}
                        onAction={handleTransactionContextAction}
                        summaryAside={
                            <>
                                <StatementOverviewPanel
                                    creditCards={creditCards}
                                    selectedCardIds={selectedCardIds}
                                    onCardIdsChange={(value) => setFilter("selectedCardIds", value)}
                                    selectedMonth={selectedDueMonth}
                                    currentInvoiceMonth={currentInvoiceMonth}
                                    onMonthChange={(value) => setFilter("selectedMonth", value)}
                                    summary={summary}
                                    invoices={monthInvoices}
                                    cardById={cardById}
                                    onPayInvoice={handlePayInvoice}
                                    onInvoiceStateAdjustment={handleInvoiceStateAdjustment}
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateCardSpendingFromStatement}
                                    disabled={cardById.size < 1}
                                    className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-all hover:border-emerald-300/45 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus size={14} />
                                    Adicionar gasto
                                </button>
                            </>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
