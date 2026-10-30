import type { Beneficiary, CreditCard, CreditCardInvoice, LedgerEntry, ReportPeriod, Transaction, Wallet } from "../../../context/FinanceContext";
import { addMonths, format, parse } from "date-fns";
import { buildReportsDataset, formatMonthLabel, getInvoiceMonthKey, isScopedCardPurchase, roundToCents, type MonthReport } from "./planningReportsUtils";

export interface AccountReportRow {
    id: string;
    account: Pick<Wallet, "icon" | "name" | "color">;
    income: number;
    spending: number;
    net: number;
    /** Carteira: saldo atual. Cartão: fatura em aberto. */
    position: number;
    limit: number | null;
}

export interface BalancePoint {
    monthKey: string;
    label: string;
    shortLabel: string;
    balance: number;
}

export type InvoiceMonthState = "paid" | "closed" | "open" | "future" | "empty";

export interface InvoiceMonth {
    monthKey: string;
    label: string;
    shortLabel: string;
    total: number;
    state: InvoiceMonthState;
}

export interface CardSummary {
    currentInvoice: number;
    nextInvoice: number;
    limit: number;
    used: number;
    available: number;
}

export interface UpcomingInstallmentMonth {
    monthKey: string;
    amount: number;
    count: number;
}

function openAmount(invoice: CreditCardInvoice): number {
    return invoice.status === "open" ? Math.max(0, roundToCents(invoice.totalAmount - invoice.paidAmount)) : 0;
}

function sum(values: number[]): number {
    return roundToCents(values.reduce((total, value) => total + value, 0));
}

export function buildWalletRows(period: ReportPeriod, transactions: Transaction[], invoices: CreditCardInvoice[], wallets: Wallet[], beneficiaries: Beneficiary[]): AccountReportRow[] {
    return wallets.map((wallet) => {
        const { summary } = buildReportsDataset(period, transactions, invoices, { walletIds: [wallet.id], creditCardIds: [] }, beneficiaries);
        return { id: wallet.id, account: wallet, income: summary.income, spending: summary.spending, net: summary.net, position: wallet.balance, limit: null };
    });
}

export function buildCardRows(period: ReportPeriod, transactions: Transaction[], invoices: CreditCardInvoice[], creditCards: CreditCard[], beneficiaries: Beneficiary[]): AccountReportRow[] {
    return creditCards.map((creditCard) => {
        const { summary } = buildReportsDataset(period, transactions, invoices, { walletIds: [], creditCardIds: [creditCard.id] }, beneficiaries);
        const position = sum(invoices.filter((invoice) => invoice.creditCardId === creditCard.id).map(openAmount));
        return { id: creditCard.id, account: creditCard, income: 0, spending: summary.spending, net: -summary.spending, position, limit: creditCard.limit };
    });
}

/** Saldo no fim de cada mês, a partir do último lançamento do razão (createdAt = data do pagamento). */
export function buildBalanceTimeline(monthReports: MonthReport[], wallets: Wallet[], ledgerEntries: LedgerEntry[]): BalancePoint[] {
    const entriesByWallet = new Map<string, LedgerEntry[]>(wallets.map((wallet) => [wallet.id, []]));
    ledgerEntries.forEach((entry) => entriesByWallet.get(entry.walletId)?.push(entry));

    // Contexto: até 3 meses antes do período, sem recuar além do primeiro lançamento das carteiras.
    const firstMonth = monthReports[0]?.monthKey;
    const firstEntryMonth = ledgerEntries
        .filter((entry) => entriesByWallet.has(entry.walletId))
        .reduce<string | null>((min, entry) => (min === null || entry.createdAt.slice(0, 7) < min ? entry.createdAt.slice(0, 7) : min), null);
    const leadMonths = firstMonth
        ? [3, 2, 1]
              .map((offset) => format(addMonths(parse(firstMonth, "yyyy-MM", new Date()), -offset), "yyyy-MM"))
              .filter((monthKey) => firstEntryMonth !== null && monthKey >= firstEntryMonth)
              .map((monthKey) => ({ monthKey, label: formatMonthLabel(monthKey, "MMMM 'de' yyyy"), shortLabel: formatMonthLabel(monthKey) }))
        : [];

    return [...leadMonths, ...monthReports].map((report) => ({
        monthKey: report.monthKey,
        label: report.label,
        shortLabel: report.shortLabel,
        balance: sum(
            wallets.map((wallet) => {
                const entries = entriesByWallet.get(wallet.id) ?? [];
                let balance = wallet.initialBalance;
                entries.forEach((entry) => {
                    if (entry.createdAt.slice(0, 7) <= report.monthKey) balance = entry.balanceAfter;
                });
                return balance;
            }),
        ),
    }));
}

export function buildInvoiceMonths(monthReports: MonthReport[], invoices: CreditCardInvoice[], creditCardIds: string[], today: string): InvoiceMonth[] {
    const selected = new Set(creditCardIds);
    const scoped = invoices.filter((invoice) => selected.has(invoice.creditCardId));
    // A fatura "aberta" é o ciclo mais próximo que ainda não fechou; os seguintes são futuros.
    const openCycle = scoped.filter((invoice) => invoice.closingDate >= today).map((invoice) => invoice.cycleKey).sort()[0] ?? "";

    return monthReports.map((report) => {
        const monthInvoices = scoped.filter((invoice) => invoice.cycleKey === report.monthKey);
        const total = sum(monthInvoices.map((invoice) => invoice.totalAmount));
        let state: InvoiceMonthState = "future";
        if (total <= 0) state = "empty";
        else if (monthInvoices.every((invoice) => invoice.status === "paid")) state = "paid";
        else if (monthInvoices.some((invoice) => invoice.closingDate < today)) state = "closed";
        else if (report.monthKey <= openCycle) state = "open";
        return { monthKey: report.monthKey, label: report.label, shortLabel: report.shortLabel, total, state };
    });
}

/** Fatura atual = a mais antiga ainda em aberto de cada cartão; próxima = a seguinte. */
export function buildCardSummary(invoices: CreditCardInvoice[], creditCards: CreditCard[]): CardSummary {
    let currentInvoice = 0;
    let nextInvoice = 0;
    let used = 0;

    creditCards.forEach((creditCard) => {
        const open = invoices
            .filter((invoice) => invoice.creditCardId === creditCard.id && openAmount(invoice) > 0)
            .sort((left, right) => left.cycleKey.localeCompare(right.cycleKey));
        currentInvoice += open[0] ? openAmount(open[0]) : 0;
        nextInvoice += open[1] ? openAmount(open[1]) : 0;
        used += sum(open.map(openAmount));
    });

    const limit = sum(creditCards.map((creditCard) => creditCard.limit));
    return { currentInvoice: roundToCents(currentInvoice), nextInvoice: roundToCents(nextInvoice), limit, used: roundToCents(used), available: roundToCents(limit - used) };
}

/** Parcelas já lançadas em faturas posteriores ao mês corrente; ignora o período do relatório. */
export function buildUpcomingInstallments(transactions: Transaction[], invoices: CreditCardInvoice[], creditCardIds: string[], today: string): UpcomingInstallmentMonth[] {
    const selected = new Set(creditCardIds);
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const currentMonth = today.slice(0, 7);
    const months = new Map<string, UpcomingInstallmentMonth>();

    transactions.forEach((transaction) => {
        if (transaction.installmentNumber === null || !isScopedCardPurchase(transaction, selected)) return;
        const monthKey = getInvoiceMonthKey(transaction, invoicesById);
        if (monthKey <= currentMonth) return;
        const month = months.get(monthKey) ?? { monthKey, amount: 0, count: 0 };
        month.amount = roundToCents(month.amount + transaction.value);
        month.count += 1;
        months.set(monthKey, month);
    });

    return [...months.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
}

export function getTopPurchases(transactions: Transaction[], invoices: CreditCardInvoice[], creditCardIds: string[], monthReports: MonthReport[], limit = 5): Transaction[] {
    const selected = new Set(creditCardIds);
    const monthKeys = new Set(monthReports.map((report) => report.monthKey));
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    return transactions
        .filter((transaction) => isScopedCardPurchase(transaction, selected) && monthKeys.has(getInvoiceMonthKey(transaction, invoicesById)))
        .sort((left, right) => right.value - left.value)
        .slice(0, limit);
}
