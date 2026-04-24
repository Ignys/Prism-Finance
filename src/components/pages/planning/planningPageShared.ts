import type { CreditCard, CreditCardInvoice, Transaction, Wallet } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue, resolveCreditCardInvoiceCycle, type LedgerEntry } from "../../../context/financeTypes";
import { formatLocalDateInput, getLocalTodayDate, parseAppDate } from "../../../lib/localDate";

export type PlanningAlertTone = "neutral" | "success" | "warning" | "danger";

export interface PlanningProjectionBreakdown {
    selectedMonth: string;
    monthStartDate: string;
    startBalance: number;
    incomesInMonth: number;
    walletSpendingsInMonth: number;
    openInvoicesDueInMonth: number;
    projectedEndBalance: number;
    incomeCount: number;
    spendingCount: number;
    invoiceCount: number;
}

export interface PlanningSimulationInput {
    amount: number;
    paymentMethod: "wallet" | "credit_card";
    purchaseDate: string;
    installments: number;
    walletId: string | null;
    creditCardId: string | null;
}

export interface PlanningSimulationInstallment {
    id: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: number;
    impactDate: string;
    impactMonth: string;
    label: string;
}

export interface PlanningSimulationResult {
    isValid: boolean;
    reason: string | null;
    impactInSelectedMonth: number;
    projectedEndBalance: number;
    deltaVsBase: number;
    deltaPercentVsBase: number | null;
    installments: PlanningSimulationInstallment[];
}

export interface PlanningCashEvent {
    id: string;
    date: string;
    amount: number;
    label: string;
    source: "income" | "spending" | "invoice_due" | "simulation";
}

export interface PlanningAlert {
    id: string;
    tone: PlanningAlertTone;
    title: string;
    description: string;
}

export interface PlanningSummary {
    selectedMonth: string;
    projection: PlanningProjectionBreakdown;
    simulation: PlanningSimulationResult;
    projectedEndBalanceWithSimulation: number;
    minBalanceInMonth: number;
    minBalanceDate: string;
    events: PlanningCashEvent[];
    alerts: PlanningAlert[];
}

interface MonthBounds {
    selectedMonth: string;
    monthStartDate: string;
    monthStartTime: number;
}

interface BuildPlanningProjectionParams {
    selectedMonth: string;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    ledgerEntries: LedgerEntry[];
}

interface BuildPlanningSimulationParams {
    selectedMonth: string;
    projection: PlanningProjectionBreakdown;
    wallets: Wallet[];
    creditCards: CreditCard[];
    simulationInput: PlanningSimulationInput;
}

interface BuildPlanningCashEventsParams {
    selectedMonth: string;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    simulation: PlanningSimulationResult;
}

interface BuildPlanningSummaryParams extends BuildPlanningProjectionParams {
    simulationInput: PlanningSimulationInput;
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

const dateLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
});

function roundToCents(value: number): number {
    return Number(value.toFixed(2));
}

function padMonthPart(value: number): string {
    return String(value).padStart(2, "0");
}

function getDayCountInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function parseMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        year,
        monthIndex: month - 1,
    };
}

function resolveMonthBounds(monthKey: string, referenceDate = new Date()): MonthBounds {
    const parsedMonth = parseMonthKey(monthKey);
    const fallback = getCurrentMonthKey(referenceDate);
    const safeMonth = parsedMonth ?? parseMonthKey(fallback);

    if (!safeMonth) {
        const fallbackDate = getLocalTodayDate(referenceDate);
        return {
            selectedMonth: fallback,
            monthStartDate: `${fallback}-01`,
            monthStartTime: parseAppDate(fallbackDate)?.getTime() ?? Date.now(),
        };
    }

    const monthStart = new Date(safeMonth.year, safeMonth.monthIndex, 1);

    return {
        selectedMonth: `${safeMonth.year}-${padMonthPart(safeMonth.monthIndex + 1)}`,
        monthStartDate: `${safeMonth.year}-${padMonthPart(safeMonth.monthIndex + 1)}-01`,
        monthStartTime: monthStart.getTime(),
    };
}

function addMonthsToDateValue(dateValue: string, monthsToAdd: number): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate || !Number.isFinite(monthsToAdd)) {
        return getLocalTodayDate();
    }

    const day = parsedDate.getDate();
    const shiftedBase = new Date(parsedDate.getFullYear(), parsedDate.getMonth() + monthsToAdd, 1);
    const targetDay = Math.min(day, getDayCountInMonth(shiftedBase.getFullYear(), shiftedBase.getMonth()));
    const shiftedDate = new Date(shiftedBase.getFullYear(), shiftedBase.getMonth(), targetDay);
    return formatLocalDateInput(shiftedDate);
}

function splitAmountAcrossInstallments(amount: number, installments: number): number[] {
    const safeInstallments = Math.max(1, Math.min(60, Math.floor(installments)));
    const totalCents = Math.round(Math.abs(amount) * 100);
    const baseInstallment = Math.floor(totalCents / safeInstallments);
    const remainder = totalCents % safeInstallments;

    const values: number[] = [];
    for (let index = 0; index < safeInstallments; index += 1) {
        const cents = baseInstallment + (index < remainder ? 1 : 0);
        values.push(cents / 100);
    }

    return values;
}

function createInvalidSimulationResult(baseProjectedEndBalance: number, reason: string | null): PlanningSimulationResult {
    return {
        isValid: false,
        reason,
        impactInSelectedMonth: 0,
        projectedEndBalance: baseProjectedEndBalance,
        deltaVsBase: 0,
        deltaPercentVsBase: null,
        installments: [],
    };
}

function isIncludedStatus(status: Transaction["status"]): boolean {
    return status === "paid" || status === "pending";
}

function compareEventsByDateAndAmount(a: PlanningCashEvent, b: PlanningCashEvent): number {
    if (a.date === b.date) {
        if (a.amount === b.amount) {
            return a.id.localeCompare(b.id);
        }
        return a.amount - b.amount;
    }
    return a.date.localeCompare(b.date);
}

function calculateMonthlyMinimumBalance(monthStartDate: string, startBalance: number, events: PlanningCashEvent[]): { minBalance: number; minBalanceDate: string } {
    let runningBalance = roundToCents(startBalance);
    let minBalance = runningBalance;
    let minBalanceDate = monthStartDate;

    for (const event of events) {
        runningBalance = roundToCents(runningBalance + event.amount);
        if (runningBalance < minBalance) {
            minBalance = runningBalance;
            minBalanceDate = event.date;
        }
    }

    return {
        minBalance,
        minBalanceDate,
    };
}

function buildPlanningAlerts(params: {
    selectedMonth: string;
    projection: PlanningProjectionBreakdown;
    simulation: PlanningSimulationResult;
    minBalanceInMonth: number;
    minBalanceDate: string;
    projectedEndBalanceWithSimulation: number;
}): PlanningAlert[] {
    const { selectedMonth, projection, simulation, minBalanceInMonth, minBalanceDate, projectedEndBalanceWithSimulation } = params;
    const monthLabel = formatMonthLabel(selectedMonth);
    const alerts: PlanningAlert[] = [];

    if (projectedEndBalanceWithSimulation < 0) {
        alerts.push({
            id: "end-balance-negative",
            tone: "danger",
            title: "Risco de fechamento negativo",
            description: `A projecao de ${monthLabel} termina em ${formatCurrency(projectedEndBalanceWithSimulation)}.`,
        });
    }

    if (minBalanceInMonth < 0) {
        alerts.push({
            id: "critical-day",
            tone: "warning",
            title: "Dia critico de caixa",
            description: `O menor saldo projetado e ${formatCurrency(minBalanceInMonth)} em ${formatDateLabel(minBalanceDate)}.`,
        });
    }

    if (simulation.isValid && simulation.impactInSelectedMonth > 0) {
        const simulationTone: PlanningAlertTone = projectedEndBalanceWithSimulation < 0 ? "danger" : "warning";
        alerts.push({
            id: "simulation-impact",
            tone: simulationTone,
            title: "Simulacao reduz o saldo final",
            description: `O impacto no mes selecionado e ${formatCurrency(simulation.impactInSelectedMonth)} (base: ${formatCurrency(projection.projectedEndBalance)}).`,
        });
    }

    if (alerts.length < 1) {
        alerts.push({
            id: "healthy-scenario",
            tone: "success",
            title: "Cenario projetado saudavel",
            description: `A previsao para ${monthLabel} permanece positiva, fechando em ${formatCurrency(projectedEndBalanceWithSimulation)}.`,
        });
    }

    return alerts;
}

export function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonthPart(referenceDate.getMonth() + 1)}`;
}

export function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    const shiftedDate = new Date(parsedMonth.year, parsedMonth.monthIndex + offset, 1);
    return `${shiftedDate.getFullYear()}-${padMonthPart(shiftedDate.getMonth() + 1)}`;
}

export function formatMonthLabel(monthKey: string): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    const formatted = monthLabelFormatter.format(new Date(parsedMonth.year, parsedMonth.monthIndex, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}

export function formatDateLabel(dateValue: string): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return dateValue;
    }

    return dateLabelFormatter.format(parsedDate);
}

export function parseSimulationAmount(input: string): number {
    const trimmed = input.trim();
    if (!trimmed) {
        return 0;
    }

    const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
    const parsedValue = Number(normalized);
    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return roundToCents(Math.max(0, Math.abs(parsedValue)));
}

export function buildPlanningProjection({
    selectedMonth,
    wallets,
    creditCards,
    creditCardInvoices,
    transactions,
    ledgerEntries,
}: BuildPlanningProjectionParams): PlanningProjectionBreakdown {
    const monthBounds = resolveMonthBounds(selectedMonth);
    const activeWallets = wallets.filter((wallet) => wallet.isActive);
    const activeWalletIds = new Set(activeWallets.map((wallet) => wallet.id));
    const activeCardIds = new Set(creditCards.filter((card) => card.isActive).map((card) => card.id));

    const initialBalance = activeWallets.reduce((sum, wallet) => sum + wallet.initialBalance, 0);
    const ledgerBeforeMonth = ledgerEntries.reduce((sum, entry) => {
        if (!activeWalletIds.has(entry.walletId)) {
            return sum;
        }

        const entryDate = parseAppDate(entry.createdAt);
        if (!entryDate || entryDate.getTime() >= monthBounds.monthStartTime) {
            return sum;
        }

        return sum + entry.amount;
    }, 0);

    const startBalance = roundToCents(initialBalance + ledgerBeforeMonth);

    let incomesInMonth = 0;
    let incomeCount = 0;
    let walletSpendingsInMonth = 0;
    let spendingCount = 0;

    for (const transaction of transactions) {
        if (!isIncludedStatus(transaction.status)) {
            continue;
        }

        if (!activeWalletIds.has(transaction.inWallet)) {
            continue;
        }

        if (getMonthKeyFromDateValue(transaction.date) !== monthBounds.selectedMonth) {
            continue;
        }

        if (transaction.type === "income") {
            incomesInMonth += transaction.value;
            incomeCount += 1;
            continue;
        }

        if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card") {
            walletSpendingsInMonth += transaction.value;
            spendingCount += 1;
        }
    }

    let openInvoicesDueInMonth = 0;
    let invoiceCount = 0;

    for (const invoice of creditCardInvoices) {
        if (!activeCardIds.has(invoice.creditCardId)) {
            continue;
        }

        if (getMonthKeyFromDateValue(invoice.dueDate) !== monthBounds.selectedMonth) {
            continue;
        }

        const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
        if (openAmount <= 0) {
            continue;
        }

        openInvoicesDueInMonth += openAmount;
        invoiceCount += 1;
    }

    const safeIncomes = roundToCents(incomesInMonth);
    const safeWalletSpendings = roundToCents(walletSpendingsInMonth);
    const safeOpenInvoices = roundToCents(openInvoicesDueInMonth);
    const projectedEndBalance = roundToCents(startBalance + safeIncomes - safeWalletSpendings - safeOpenInvoices);

    return {
        selectedMonth: monthBounds.selectedMonth,
        monthStartDate: monthBounds.monthStartDate,
        startBalance,
        incomesInMonth: safeIncomes,
        walletSpendingsInMonth: safeWalletSpendings,
        openInvoicesDueInMonth: safeOpenInvoices,
        projectedEndBalance,
        incomeCount,
        spendingCount,
        invoiceCount,
    };
}

export function buildPlanningSimulation({
    selectedMonth,
    projection,
    wallets,
    creditCards,
    simulationInput,
}: BuildPlanningSimulationParams): PlanningSimulationResult {
    const activeWalletIds = new Set(wallets.filter((wallet) => wallet.isActive).map((wallet) => wallet.id));
    const activeCards = creditCards.filter((card) => card.isActive);
    const selectedCard = activeCards.find((card) => card.id === simulationInput.creditCardId) ?? null;
    const normalizedMonth = resolveMonthBounds(selectedMonth).selectedMonth;
    const safeAmount = roundToCents(Math.max(0, Math.abs(simulationInput.amount)));
    const safeInstallments = Math.max(1, Math.min(60, Math.floor(simulationInput.installments)));
    const purchaseDate = parseAppDate(simulationInput.purchaseDate) ? simulationInput.purchaseDate : getLocalTodayDate();

    if (safeAmount <= 0) {
        return createInvalidSimulationResult(projection.projectedEndBalance, null);
    }

    if (simulationInput.paymentMethod === "wallet") {
        if (!simulationInput.walletId || !activeWalletIds.has(simulationInput.walletId)) {
            return createInvalidSimulationResult(projection.projectedEndBalance, "Selecione uma carteira ativa para simular.");
        }
    } else if (!selectedCard) {
        return createInvalidSimulationResult(projection.projectedEndBalance, "Selecione um cartao ativo para simular.");
    }

    const splitAmounts = splitAmountAcrossInstallments(safeAmount, safeInstallments);
    const installments: PlanningSimulationInstallment[] = splitAmounts.map((amount, index) => {
        const occurrenceDate = addMonthsToDateValue(purchaseDate, index);
        const installmentNumber = index + 1;
        const labelPrefix = safeInstallments > 1 ? `Parcela ${installmentNumber}/${safeInstallments}` : "Compra simulada";

        if (simulationInput.paymentMethod === "wallet") {
            return {
                id: `sim-wallet-${installmentNumber}`,
                installmentNumber,
                totalInstallments: safeInstallments,
                amount: roundToCents(amount),
                impactDate: occurrenceDate,
                impactMonth: getMonthKeyFromDateValue(occurrenceDate),
                label: `${labelPrefix} (carteira)`,
            };
        }

        const cycle = resolveCreditCardInvoiceCycle(occurrenceDate, selectedCard.closingDay, selectedCard.dueDay);
        return {
            id: `sim-card-${installmentNumber}`,
            installmentNumber,
            totalInstallments: safeInstallments,
            amount: roundToCents(amount),
            impactDate: cycle.dueDate,
            impactMonth: getMonthKeyFromDateValue(cycle.dueDate),
            label: `${labelPrefix} (${selectedCard.name})`,
        };
    });

    const impactInSelectedMonth = roundToCents(
        installments
            .filter((installment) => installment.impactMonth === normalizedMonth)
            .reduce((sum, installment) => sum + installment.amount, 0),
    );

    const projectedEndBalance = roundToCents(projection.projectedEndBalance - impactInSelectedMonth);
    const deltaVsBase = roundToCents(projectedEndBalance - projection.projectedEndBalance);
    const deltaPercentVsBase =
        projection.projectedEndBalance !== 0 ? roundToCents((deltaVsBase / Math.abs(projection.projectedEndBalance)) * 100) : null;

    return {
        isValid: true,
        reason: null,
        impactInSelectedMonth,
        projectedEndBalance,
        deltaVsBase,
        deltaPercentVsBase,
        installments,
    };
}

export function buildPlanningCashEvents({
    selectedMonth,
    wallets,
    creditCards,
    creditCardInvoices,
    transactions,
    simulation,
}: BuildPlanningCashEventsParams): PlanningCashEvent[] {
    const normalizedMonth = resolveMonthBounds(selectedMonth).selectedMonth;
    const activeWalletIds = new Set(wallets.filter((wallet) => wallet.isActive).map((wallet) => wallet.id));
    const activeCards = creditCards.filter((card) => card.isActive);
    const activeCardIds = new Set(activeCards.map((card) => card.id));
    const cardNameById = new Map(activeCards.map((card) => [card.id, card.name]));
    const events: PlanningCashEvent[] = [];

    for (const transaction of transactions) {
        if (!isIncludedStatus(transaction.status)) {
            continue;
        }

        if (!activeWalletIds.has(transaction.inWallet)) {
            continue;
        }

        if (getMonthKeyFromDateValue(transaction.date) !== normalizedMonth) {
            continue;
        }

        const transactionLabel = transaction.description.trim() || transaction.category.label;

        if (transaction.type === "income") {
            events.push({
                id: `tx-income-${transaction.id}`,
                date: transaction.date,
                amount: roundToCents(transaction.value),
                label: transactionLabel,
                source: "income",
            });
            continue;
        }

        if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card") {
            events.push({
                id: `tx-spending-${transaction.id}`,
                date: transaction.date,
                amount: roundToCents(-Math.abs(transaction.value)),
                label: transactionLabel,
                source: "spending",
            });
        }
    }

    for (const invoice of creditCardInvoices) {
        if (!activeCardIds.has(invoice.creditCardId)) {
            continue;
        }

        if (getMonthKeyFromDateValue(invoice.dueDate) !== normalizedMonth) {
            continue;
        }

        const openAmount = roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount));
        if (openAmount <= 0) {
            continue;
        }

        events.push({
            id: `invoice-due-${invoice.id}`,
            date: invoice.dueDate,
            amount: -openAmount,
            label: `Vencimento da fatura (${cardNameById.get(invoice.creditCardId) ?? "Cartao removido"})`,
            source: "invoice_due",
        });
    }

    for (const installment of simulation.installments) {
        if (installment.impactMonth !== normalizedMonth) {
            continue;
        }

        events.push({
            id: `sim-${installment.id}`,
            date: installment.impactDate,
            amount: roundToCents(-Math.abs(installment.amount)),
            label: installment.label,
            source: "simulation",
        });
    }

    events.sort(compareEventsByDateAndAmount);
    return events;
}

export function buildPlanningSummary({
    selectedMonth,
    wallets,
    creditCards,
    creditCardInvoices,
    transactions,
    ledgerEntries,
    simulationInput,
}: BuildPlanningSummaryParams): PlanningSummary {
    const projection = buildPlanningProjection({
        selectedMonth,
        wallets,
        creditCards,
        creditCardInvoices,
        transactions,
        ledgerEntries,
    });

    const simulation = buildPlanningSimulation({
        selectedMonth: projection.selectedMonth,
        projection,
        wallets,
        creditCards,
        simulationInput,
    });

    const events = buildPlanningCashEvents({
        selectedMonth: projection.selectedMonth,
        wallets,
        creditCards,
        creditCardInvoices,
        transactions,
        simulation,
    });

    const { minBalance, minBalanceDate } = calculateMonthlyMinimumBalance(projection.monthStartDate, projection.startBalance, events);
    const projectedEndBalanceWithSimulation = roundToCents(simulation.projectedEndBalance);
    const alerts = buildPlanningAlerts({
        selectedMonth: projection.selectedMonth,
        projection,
        simulation,
        minBalanceInMonth: minBalance,
        minBalanceDate,
        projectedEndBalanceWithSimulation,
    });

    return {
        selectedMonth: projection.selectedMonth,
        projection,
        simulation,
        projectedEndBalanceWithSimulation,
        minBalanceInMonth: minBalance,
        minBalanceDate,
        events,
        alerts,
    };
}
