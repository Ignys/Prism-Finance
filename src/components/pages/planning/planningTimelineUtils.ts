import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
    CreditCard,
    CreditCardInvoice,
    LedgerEntry,
    PlanningSimulatedExpense,
    PlanningSimulatedIncome,
    PlanningState,
    Transaction,
    Wallet,
    WishItem,
} from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { parseAppDate } from "../../../lib/localDate";
import { transactionSettlementDate } from "../../../lib/transactionSettlementDate";
import {
    DEFAULT_TIMELINE_MONTHS,
    TIMELINE_MONTH_OPTIONS,
    type BalanceTone,
    type InheritedExpenseItem,
    type MonthReality,
    type SimulatedExpenseItem,
    type SimulatedIncomeItem,
    type TimelineProjection,
    type WishlistProjectionItem,
} from "./planningTimelineTypes";

const MONTH_KEY_FORMAT = "yyyy-MM";
const TRANSFER_ICON_NAME = "arrow-right-left";
const INHERITED_EXPENSE_SOURCE_ORDER: Record<InheritedExpenseItem["source"], number> = {
    transaction: 0,
    transfer: 1,
    invoice: 2,
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMonthKey(monthKey: string): Date | null {
    const parsedDate = parse(monthKey.trim(), MONTH_KEY_FORMAT, new Date());
    if (!isValid(parsedDate)) {
        return null;
    }

    return startOfMonth(parsedDate);
}

export function getCurrentMonthKey(referenceDate = new Date()): string {
    return format(startOfMonth(referenceDate), MONTH_KEY_FORMAT);
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    return format(addMonths(parsedMonth, offset), MONTH_KEY_FORMAT);
}

function getMonthOffset(fromMonthKey: string, toMonthKey: string): number | null {
    const fromMonth = parseMonthKey(fromMonthKey);
    const toMonth = parseMonthKey(toMonthKey);

    if (!fromMonth || !toMonth) {
        return null;
    }

    return (toMonth.getFullYear() - fromMonth.getFullYear()) * 12 + (toMonth.getMonth() - fromMonth.getMonth());
}

function formatMonthLabel(monthKey: string, pattern = "MMMM 'de' yyyy"): string {
    const parsedMonth = parseMonthKey(monthKey);
    return parsedMonth ? capitalizeLabel(format(parsedMonth, pattern, { locale: ptBR }).replace(".", "")) : monthKey;
}

export function formatCurrency(value: number): string {
    return currencyFormatter.format(roundToCents(value));
}

export function parseCurrencyInput(input: string): number {
    const compact = input.trim().replace(/[^\d,.-]/g, "");
    if (!compact) {
        return 0;
    }

    const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return roundToCents(Math.max(0, Math.abs(parsed)));
}

function isIncludedStatus(status: Transaction["status"]): boolean {
    return status === "paid" || status === "pending";
}

function getTransactionDisplayName(transaction: Transaction): string {
    return transaction.description.trim() || "Sem descrição";
}

function getMonthStartTime(monthKey: string): number {
    return parseMonthKey(monthKey)?.getTime() ?? Date.now();
}

function getOpeningBalance(monthKey: string, wallets: Wallet[], ledgerEntries: LedgerEntry[]): number {
    const activeWallets = wallets.filter((wallet) => wallet.isActive);
    const activeWalletIds = new Set(activeWallets.map((wallet) => wallet.id));
    const monthStartTime = getMonthStartTime(monthKey);
    const initialBalance = activeWallets.reduce((sum, wallet) => sum + wallet.initialBalance, 0);
    const ledgerBeforeMonth = ledgerEntries.reduce((sum, entry) => {
        if (!activeWalletIds.has(entry.walletId)) {
            return sum;
        }

        const entryDate = parseAppDate(entry.createdAt);
        if (!entryDate || entryDate.getTime() >= monthStartTime) {
            return sum;
        }

        return sum + entry.amount;
    }, 0);

    return roundToCents(initialBalance + ledgerBeforeMonth);
}

function sumAmounts<T extends { amount: number }>(items: T[]): number {
    return roundToCents(items.reduce((sum, item) => sum + item.amount, 0));
}

export function getAmountClassName(tone: "income" | "expense" | "simulation", amount: number): string {
    if (tone === "income") {
        return amount < 0 ? "text-red-200" : "text-emerald-200";
    }

    if (tone === "expense") {
        return "text-red-200";
    }

    return "text-orange-200";
}

export function getProjectionNetClassName(amount: number): string {
    if (amount > 0) {
        return "text-emerald-200";
    }

    if (amount < 0) {
        return "text-red-200";
    }

    return "text-white/60";
}

export function getProjectionBgClassName(amount: number): string {
        if (amount > 0) {
        return "bg-emerald-400/10";
    }

    if (amount < 0) {
        return "bg-red-400/10";
    }

    return "bg-white/10";
}

export function getNextTimelineMonthCount(currentCount: number): number {
    const currentIndex = TIMELINE_MONTH_OPTIONS.findIndex((option) => option === currentCount);
    if (currentIndex === -1) {
        return DEFAULT_TIMELINE_MONTHS;
    }

    return TIMELINE_MONTH_OPTIONS[(currentIndex + 1) % TIMELINE_MONTH_OPTIONS.length];
}

function pushPlanningItemByMonth<T extends { monthKey: string }>(map: Map<string, T[]>, item: T) {
    const items = map.get(item.monthKey) ?? [];
    items.push(item);
    map.set(item.monthKey, items);
}

function getMonthReality(params: {
    monthKey: string;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    disabledInheritedExpenseIds: Set<string>;
    disabledIncomeIds: Set<string>;
}): MonthReality {
    const { monthKey, wallets, creditCards, creditCardInvoices, transactions, disabledInheritedExpenseIds, disabledIncomeIds } = params;
    const activeWalletIds = new Set(wallets.filter((wallet) => wallet.isActive).map((wallet) => wallet.id));
    const activeCardIds = new Set(creditCards.filter((card) => card.isActive).map((card) => card.id));
    const cardNameById = new Map(creditCards.map((card) => [card.id, card.name]));

    let income = 0;
    let walletSpendings = 0;
    const incomeItems: MonthReality["incomeItems"] = [];
    const inheritedItems: MonthReality["inheritedItems"] = [];

    for (const transaction of transactions) {
        const cashDate = transaction.status === "paid" ? transactionSettlementDate(transaction) : parseAppDate(transaction.date);
        if (transaction.isNonCashSettlement || !isIncludedStatus(transaction.status) || !cashDate || format(cashDate, MONTH_KEY_FORMAT) !== monthKey) {
            continue;
        }

        if (transaction.type === "income") {
            if (activeWalletIds.has(transaction.inWallet)) {
                income += transaction.value;
                incomeItems.push({
                    id: `income-transaction:${transaction.id}`,
                    source: "transaction",
                    transactionId: transaction.id,
                    label: getTransactionDisplayName(transaction),
                    amount: roundToCents(transaction.value),
                    iconName: transaction.category.icon,
                    isDisabled: disabledIncomeIds.has(`income-transaction:${transaction.id}`),
                });
            }
            continue;
        }

        if (transaction.type === "transfer") {
            if (transaction.destinationWalletId !== null && activeWalletIds.has(transaction.destinationWalletId)) {
                income += transaction.value;
                incomeItems.push({
                    id: `income-transfer:${transaction.id}`,
                    source: "transfer",
                    transactionId: transaction.id,
                    label: getTransactionDisplayName(transaction),
                    amount: roundToCents(transaction.value),
                    iconName: TRANSFER_ICON_NAME,
                    isDisabled: disabledIncomeIds.has(`income-transfer:${transaction.id}`),
                });
            }

            if (activeWalletIds.has(transaction.inWallet)) {
                walletSpendings += transaction.value;
                inheritedItems.push({
                    id: `transfer:${transaction.id}`,
                    source: "transfer",
                    transactionId: transaction.id,
                    label: getTransactionDisplayName(transaction),
                    amount: roundToCents(transaction.value),
                    iconName: TRANSFER_ICON_NAME,
                    isDisabled: disabledInheritedExpenseIds.has(`transfer:${transaction.id}`),
                });
            }
            continue;
        }

        if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card" && activeWalletIds.has(transaction.inWallet)) {
            walletSpendings += transaction.value;
            inheritedItems.push({
                id: `transaction:${transaction.id}`,
                source: "transaction",
                transactionId: transaction.id,
                label: getTransactionDisplayName(transaction),
                amount: roundToCents(transaction.value),
                iconName: transaction.category.icon,
                isDisabled: disabledInheritedExpenseIds.has(`transaction:${transaction.id}`),
            });
        }
    }

    let invoiceSpendings = 0;
    for (const invoice of creditCardInvoices) {
        if (!activeCardIds.has(invoice.creditCardId) || getMonthKeyFromDateValue(invoice.dueDate) !== monthKey) {
            continue;
        }

        const forecastAmount = invoice.forecastAmount ?? 0;
        const openAmount = roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount) + forecastAmount);
        if (openAmount <= 0) {
            continue;
        }

        invoiceSpendings += openAmount;
        inheritedItems.push({
            id: `invoice:${invoice.id}`,
            source: "invoice",
            invoiceId: invoice.id,
            label: `Fatura ${cardNameById.get(invoice.creditCardId) ?? "cartao"}${forecastAmount > 0 ? " (inclui previsões)" : ""}`,
            amount: openAmount,
            iconName: null,
            isDisabled: disabledInheritedExpenseIds.has(`invoice:${invoice.id}`),
        });
    }

    incomeItems.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
    inheritedItems.sort((a, b) => {
        if (a.source !== b.source) {
            return INHERITED_EXPENSE_SOURCE_ORDER[a.source] - INHERITED_EXPENSE_SOURCE_ORDER[b.source];
        }
        return a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
    });

    const inheritedExpenses = roundToCents(walletSpendings + invoiceSpendings);
    const disabledIncome = roundToCents(incomeItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0));
    const disabledInheritedExpenses = roundToCents(inheritedItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0));

    return {
        originalIncome: roundToCents(income),
        activeIncome: roundToCents(income - disabledIncome),
        originalIncomeCount: incomeItems.length,
        activeIncomeCount: incomeItems.filter((item) => !item.isDisabled).length,
        incomeItems,
        walletSpendings: roundToCents(walletSpendings),
        invoiceSpendings: roundToCents(invoiceSpendings),
        inheritedExpenses,
        activeInheritedExpenses: roundToCents(inheritedExpenses - disabledInheritedExpenses),
        disabledInheritedExpenses,
        inheritedItems,
    };
}

export function getBalanceTone(value: number, income: number): BalanceTone {
    if (value < 0) {
        return "negative";
    }

    if (value <= Math.max(300, income * 0.1)) {
        return "tight";
    }

    return "positive";
}

export function buildTimelineProjection(params: {
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    ledgerEntries: LedgerEntry[];
    wishItems: WishItem[];
    planning: PlanningState;
    monthsToShow: number;
    pinnedMonthKey?: string | null;
}): TimelineProjection {
    const currentMonth = getCurrentMonthKey();
    const safeMonthsToShow = TIMELINE_MONTH_OPTIONS.includes(params.monthsToShow as (typeof TIMELINE_MONTH_OPTIONS)[number]) ? params.monthsToShow : DEFAULT_TIMELINE_MONTHS;
    const pinnedMonthOffset = params.pinnedMonthKey ? getMonthOffset(currentMonth, params.pinnedMonthKey) : null;
    const monthsToBuild = pinnedMonthOffset !== null && pinnedMonthOffset >= 0 ? Math.max(safeMonthsToShow, pinnedMonthOffset + 1) : safeMonthsToShow;
    const monthKeys = Array.from({ length: monthsToBuild }, (_, index) => shiftMonth(currentMonth, index));
    const openingBalance = getOpeningBalance(currentMonth, params.wallets, params.ledgerEntries);
    const disabledInheritedExpenseIds = new Set(params.planning.disabledInheritedExpenseIds ?? []);
    const disabledIncomeIds = new Set(params.planning.disabledIncomeIds ?? []);
    const disabledSimulatedExpenseIds = new Set(params.planning.disabledSimulatedExpenseIds ?? []);
    const disabledSimulatedIncomeIds = new Set(params.planning.disabledSimulatedIncomeIds ?? []);
    const revenueOverridesByMonth = new Map(params.planning.revenueOverrides.map((override) => [override.monthKey, override]));
    const simulatedExpensesByMonth = new Map<string, PlanningSimulatedExpense[]>();
    const simulatedIncomesByMonth = new Map<string, PlanningSimulatedIncome[]>();
    const activeWishItemsById = new Map(params.wishItems.filter((item) => item.isActive).map((item) => [item.id, item]));
    const wishlistSelectionsByMonth = new Map<string, WishlistProjectionItem[]>();

    params.planning.simulatedExpenses.forEach((expense) => {
        pushPlanningItemByMonth(simulatedExpensesByMonth, expense);
    });

    params.planning.simulatedIncomes.forEach((income) => {
        pushPlanningItemByMonth(simulatedIncomesByMonth, income);
    });

    params.planning.wishlistSelections.forEach((selection) => {
        const wishItem = activeWishItemsById.get(selection.wishItemId);
        if (!wishItem) {
            return;
        }

        pushPlanningItemByMonth(wishlistSelectionsByMonth, {
            id: selection.id,
            wishItemId: selection.wishItemId,
            monthKey: selection.monthKey,
            label: wishItem.description.trim() || "Desejo",
            amount: roundToCents(wishItem.value),
            createdAt: selection.createdAt,
        });
    });

    let originalAccumulated = openingBalance;
    let currentAccumulated = openingBalance;

    return {
        openingBalance,
        months: monthKeys.map((monthKey, index) => {
            const openingMonthBalance = currentAccumulated;
            const reality = getMonthReality({
                monthKey,
                wallets: params.wallets,
                creditCards: params.creditCards,
                creditCardInvoices: params.creditCardInvoices,
                transactions: params.transactions,
                disabledInheritedExpenseIds,
                disabledIncomeIds,
            });
            const simulatedExpenseItems: SimulatedExpenseItem[] = (simulatedExpensesByMonth.get(monthKey) ?? []).map((expense) => ({
                ...expense,
                isDisabled: disabledSimulatedExpenseIds.has(expense.id),
            }));
            const wishlistExpenseItems = wishlistSelectionsByMonth.get(monthKey) ?? [];
            const simulatedIncomeItems: SimulatedIncomeItem[] = (simulatedIncomesByMonth.get(monthKey) ?? []).map((income) => ({
                id: income.id,
                label: income.description.trim() || "Receita simulada",
                amount: income.amount,
                iconName: null,
                source: "simulated_income",
                isDisabled: disabledSimulatedIncomeIds.has(income.id),
            }));
            const legacyRevenueOverride = revenueOverridesByMonth.get(monthKey);

            if (legacyRevenueOverride) {
                const legacyDelta = roundToCents(legacyRevenueOverride.amount - reality.originalIncome);
                if (Math.abs(legacyDelta) > 0.009) {
                    simulatedIncomeItems.push({
                        id: `legacy-override:${monthKey}`,
                        label: "Ajuste legado de receita",
                        amount: legacyDelta,
                        iconName: null,
                        source: "legacy_override",
                        isDisabled: false,
                        overrideMonthKey: monthKey,
                    });
                }
            }

            const simulatedIncome = roundToCents(sumAmounts(simulatedIncomeItems.filter((item) => !item.isDisabled)));
            const simulatedExpenses = roundToCents(sumAmounts(simulatedExpenseItems.filter((item) => !item.isDisabled)) + sumAmounts(wishlistExpenseItems));
            const currentIncome = roundToCents(reality.activeIncome + simulatedIncome);
            const originalMonthBalance = roundToCents(reality.originalIncome - reality.inheritedExpenses);
            const currentMonthBalance = roundToCents(currentIncome - reality.activeInheritedExpenses - simulatedExpenses);

            originalAccumulated = roundToCents(originalAccumulated + originalMonthBalance);
            currentAccumulated = roundToCents(currentAccumulated + currentMonthBalance);

            return {
                ...reality,
                monthKey,
                monthLabel: formatMonthLabel(monthKey),
                shortMonthLabel: formatMonthLabel(monthKey, "MMMM"),
                year: formatMonthLabel(monthKey, "yyyy"),
                isCurrentMonth: index === 0,
                openingMonthBalance,
                simulatedIncome,
                simulatedIncomeItems,
                currentIncome,
                simulatedExpenses,
                simulatedExpenseItems,
                wishlistExpenseItems,
                originalMonthBalance,
                currentMonthBalance,
                originalAccumulated,
                currentAccumulated,
            };
        }),
    };
}

export function mergePlanningUpdate(planning: PlanningState, update: Partial<PlanningState>): PlanningState {
    return {
        simulatedExpenses: update.simulatedExpenses ?? planning.simulatedExpenses,
        simulatedIncomes: update.simulatedIncomes ?? planning.simulatedIncomes,
        wishlistSelections: update.wishlistSelections ?? planning.wishlistSelections,
        revenueOverrides: update.revenueOverrides ?? planning.revenueOverrides,
        disabledInheritedExpenseIds: update.disabledInheritedExpenseIds ?? planning.disabledInheritedExpenseIds ?? [],
        disabledIncomeIds: update.disabledIncomeIds ?? planning.disabledIncomeIds ?? [],
        disabledSimulatedExpenseIds: update.disabledSimulatedExpenseIds ?? planning.disabledSimulatedExpenseIds ?? [],
        disabledSimulatedIncomeIds: update.disabledSimulatedIncomeIds ?? planning.disabledSimulatedIncomeIds ?? [],
        timelineSelectedWalletIds: update.timelineSelectedWalletIds ?? planning.timelineSelectedWalletIds ?? [],
        timelineCompareMode: update.timelineCompareMode ?? planning.timelineCompareMode ?? true,
        timelineHorizontalMode: update.timelineHorizontalMode ?? planning.timelineHorizontalMode ?? false,
        timelineMonthCount: update.timelineMonthCount ?? planning.timelineMonthCount ?? DEFAULT_TIMELINE_MONTHS,
        reportsSelectedWalletIds: update.reportsSelectedWalletIds ?? planning.reportsSelectedWalletIds ?? [],
        reportsSelectedCreditCardIds: update.reportsSelectedCreditCardIds ?? planning.reportsSelectedCreditCardIds ?? [],
        reportsPeriod: update.reportsPeriod ?? planning.reportsPeriod,
    };
}
