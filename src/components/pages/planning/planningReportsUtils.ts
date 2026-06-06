import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CreditCardInvoice, ReportPeriod, Transaction } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { getTransactionCategoryDisplay } from "../../../lib/transactionCategory";

export type { ReportPeriod } from "../../../context/FinanceContext";

export interface MonthReport {
    monthKey: string;
    label: string;
    shortLabel: string;
    income: number;
    spending: number;
    walletSpending: number;
    invoiceSpending: number;
    net: number;
    transactionCount: number;
}

export interface CategoryReport {
    key: string;
    label: string;
    icon: string;
    color: string;
    type: "expense";
    totalAmount: number;
    walletAmount: number;
    invoiceAmount: number;
    count: number;
    percent: number;
}

export interface MethodReport {
    key: "wallet" | "invoice_payment";
    label: string;
    amount: number;
    count: number;
    colorClassName: string;
    iconClassName: string;
}

export interface ReportsSummary {
    income: number;
    spending: number;
    net: number;
    savingsRate: number | null;
    transactionCount: number;
    biggestCategory: CategoryReport | null;
    mostFrequentCategory: CategoryReport | null;
    averageTicket: number;
    bestMonth: MonthReport | null;
    worstMonth: MonthReport | null;
    methodReports: MethodReport[];
}

export interface ReportsDataset {
    monthReports: MonthReport[];
    categoryReports: CategoryReport[];
    summary: ReportsSummary;
}

interface CategoryAccumulator {
    key: string;
    label: string;
    icon: string;
    color: string;
    type: "expense";
    totalAmount: number;
    walletAmount: number;
    invoiceAmount: number;
    count: number;
}

interface ExpenseCounters {
    walletCount: number;
    invoicePaymentCount: number;
}

const MONTH_KEY_FORMAT = "yyyy-MM";
const CATEGORY_FALLBACK_COLOR = "#737373";

export function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function parseMonthKey(monthKey: string): Date | null {
    const parsedDate = parse(monthKey.trim(), MONTH_KEY_FORMAT, new Date());
    return isValid(parsedDate) ? startOfMonth(parsedDate) : null;
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return format(startOfMonth(referenceDate), MONTH_KEY_FORMAT);
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    return format(addMonths(parsedMonth ?? startOfMonth(new Date()), offset), MONTH_KEY_FORMAT);
}

function formatMonthLabel(monthKey: string, pattern = "MMM/yy"): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    return format(parsedMonth, pattern, { locale: ptBR }).replace(".", "");
}

function isIncludedStatus(status: Transaction["status"]): boolean {
    return status === "paid" || status === "pending";
}

function isIncludedType(transaction: Transaction): boolean {
    return transaction.type === "income" || transaction.type === "spending";
}

function isIncludedTransaction(transaction: Transaction): boolean {
    return isIncludedStatus(transaction.status) && isIncludedType(transaction);
}

function isWalletSpendingTransaction(transaction: Transaction): boolean {
    return isIncludedTransaction(transaction) && transaction.type === "spending" && transaction.paymentMethod !== "credit_card" && transaction.systemKind !== "invoice_payment";
}

function isIncomeTransaction(transaction: Transaction): boolean {
    return isIncludedTransaction(transaction) && transaction.type === "income";
}

function isInvoicePaymentTransaction(transaction: Transaction): boolean {
    return isIncludedTransaction(transaction) && transaction.type === "spending" && transaction.systemKind === "invoice_payment";
}

function buildMonthReports(period: ReportPeriod): MonthReport[] {
    const startMonth = parseMonthKey(period.startMonth) ? period.startMonth : getCurrentMonthKey();
    const endMonth = parseMonthKey(period.endMonth) ? period.endMonth : startMonth;
    const orderedStartMonth = startMonth <= endMonth ? startMonth : endMonth;
    const orderedEndMonth = startMonth <= endMonth ? endMonth : startMonth;
    const monthKeys: string[] = [];

    for (let monthKey = orderedStartMonth; monthKey <= orderedEndMonth; monthKey = shiftMonth(monthKey, 1)) {
        monthKeys.push(monthKey);
    }

    return monthKeys.map((monthKey) => ({
        monthKey,
        label: formatMonthLabel(monthKey, "MMMM 'de' yyyy"),
        shortLabel: formatMonthLabel(monthKey),
        income: 0,
        spending: 0,
        walletSpending: 0,
        invoiceSpending: 0,
        net: 0,
        transactionCount: 0,
    }));
}

function ensureCategoryAccumulator(map: Map<string, CategoryAccumulator>, transaction: Transaction): CategoryAccumulator {
    const categoryDisplay = getTransactionCategoryDisplay(transaction.category);
    const key = transaction.category.id ? `id:${transaction.category.id}` : `label:${transaction.category.label}`;
    const existing = map.get(key);

    if (existing) {
        return existing;
    }

    const nextCategory: CategoryAccumulator = {
        key,
        label: categoryDisplay.displayLabel,
        icon: categoryDisplay.icon,
        color: categoryDisplay.color ?? CATEGORY_FALLBACK_COLOR,
        type: "expense",
        totalAmount: 0,
        walletAmount: 0,
        invoiceAmount: 0,
        count: 0,
    };

    map.set(key, nextCategory);
    return nextCategory;
}

function addWalletCategoryContribution(categoryReports: Map<string, CategoryAccumulator>, transaction: Transaction): void {
    const category = ensureCategoryAccumulator(categoryReports, transaction);
    category.totalAmount = roundToCents(category.totalAmount + transaction.value);
    category.walletAmount = roundToCents(category.walletAmount + transaction.value);
    category.count += 1;
}

function addInvoiceCategoryContribution(
    categoryReports: Map<string, CategoryAccumulator>,
    paymentTransaction: Transaction,
    invoice: CreditCardInvoice | undefined,
    linkedPurchases: Transaction[],
): void {
    const invoiceTotalAmount = invoice?.totalAmount ?? 0;
    if (invoiceTotalAmount <= 0 || linkedPurchases.length < 1) {
        const fallbackCategory = ensureCategoryAccumulator(categoryReports, paymentTransaction);
        fallbackCategory.totalAmount = roundToCents(fallbackCategory.totalAmount + paymentTransaction.value);
        fallbackCategory.invoiceAmount = roundToCents(fallbackCategory.invoiceAmount + paymentTransaction.value);
        fallbackCategory.count += 1;
        return;
    }

    const paymentFactor = Math.min(1, Math.max(0, paymentTransaction.value / invoiceTotalAmount));
    if (paymentFactor <= 0) {
        return;
    }

    const purchaseContributions = linkedPurchases
        .map((purchase) => ({
            purchase,
            amount: roundToCents(purchase.value * paymentFactor),
        }))
        .filter((entry) => entry.amount > 0);

    if (purchaseContributions.length < 1) {
        const fallbackCategory = ensureCategoryAccumulator(categoryReports, paymentTransaction);
        fallbackCategory.totalAmount = roundToCents(fallbackCategory.totalAmount + paymentTransaction.value);
        fallbackCategory.invoiceAmount = roundToCents(fallbackCategory.invoiceAmount + paymentTransaction.value);
        fallbackCategory.count += 1;
        return;
    }

    const distributedAmount = roundToCents(purchaseContributions.reduce((sum, entry) => sum + entry.amount, 0));
    const roundingDifference = roundToCents(paymentTransaction.value - distributedAmount);
    if (roundingDifference !== 0) {
        const lastContribution = purchaseContributions[purchaseContributions.length - 1];
        lastContribution.amount = roundToCents(lastContribution.amount + roundingDifference);
    }

    purchaseContributions.forEach(({ purchase, amount }) => {
        const proportionalAmount = roundToCents(amount);
        if (proportionalAmount <= 0) {
            return;
        }

        const category = ensureCategoryAccumulator(categoryReports, purchase);
        category.totalAmount = roundToCents(category.totalAmount + proportionalAmount);
        category.invoiceAmount = roundToCents(category.invoiceAmount + proportionalAmount);
        category.count += 1;
    });
}

function buildCategoryReports(
    transactions: Transaction[],
    creditCardInvoices: CreditCardInvoice[],
    lookupTransactions: Transaction[],
    monthKeys: Set<string>,
    counters: ExpenseCounters,
): CategoryReport[] {
    const categoryReports = new Map<string, CategoryAccumulator>();
    const invoicesById = new Map(creditCardInvoices.map((invoice) => [invoice.id, invoice]));
    const purchasesByInvoiceId = new Map<string, Transaction[]>();

    lookupTransactions.forEach((transaction) => {
        if (transaction.type !== "spending" || transaction.paymentMethod !== "credit_card" || !transaction.invoiceId) {
            return;
        }

        if (transaction.status === "cancelled" || transaction.status === "skipped") {
            return;
        }

        const linkedTransactions = purchasesByInvoiceId.get(transaction.invoiceId);
        if (linkedTransactions) {
            linkedTransactions.push(transaction);
            return;
        }

        purchasesByInvoiceId.set(transaction.invoiceId, [transaction]);
    });

    transactions.forEach((transaction) => {
        const monthKey = getMonthKeyFromDateValue(transaction.date);
        if (!monthKeys.has(monthKey)) {
            return;
        }

        if (isWalletSpendingTransaction(transaction)) {
            counters.walletCount += 1;
            addWalletCategoryContribution(categoryReports, transaction);
            return;
        }

        if (!isInvoicePaymentTransaction(transaction)) {
            return;
        }

        counters.invoicePaymentCount += 1;
        const invoiceId = transaction.invoicePaymentMeta?.invoiceId ?? null;
        const invoice = invoiceId ? invoicesById.get(invoiceId) : undefined;
        const linkedPurchases = invoiceId ? purchasesByInvoiceId.get(invoiceId) ?? [] : [];
        addInvoiceCategoryContribution(categoryReports, transaction, invoice, linkedPurchases);
    });

    const totalSpending = Array.from(categoryReports.values()).reduce((sum, category) => sum + category.totalAmount, 0);

    return Array.from(categoryReports.values())
        .map((category) => ({
            ...category,
            totalAmount: roundToCents(category.totalAmount),
            walletAmount: roundToCents(category.walletAmount),
            invoiceAmount: roundToCents(category.invoiceAmount),
            percent: totalSpending > 0 ? roundToCents((category.totalAmount / totalSpending) * 100) : 0,
        }))
        .sort((left, right) => right.totalAmount - left.totalAmount || right.count - left.count || left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
}

function buildSummary(monthReports: MonthReport[], categoryReports: CategoryReport[], counters: ExpenseCounters): ReportsSummary {
    const income = roundToCents(monthReports.reduce((sum, report) => sum + report.income, 0));
    const spending = roundToCents(monthReports.reduce((sum, report) => sum + report.spending, 0));
    const walletSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.walletSpending, 0));
    const invoiceSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.invoiceSpending, 0));
    const transactionCount = monthReports.reduce((sum, report) => sum + report.transactionCount, 0);
    const net = roundToCents(income - spending);
    const savingsRate = income > 0 ? (net / income) * 100 : null;
    const bestMonth = monthReports.reduce<MonthReport | null>((best, report) => (!best || report.net > best.net ? report : best), null);
    const worstMonth = monthReports.reduce<MonthReport | null>((worst, report) => (!worst || report.net < worst.net ? report : worst), null);
    const mostFrequentCategory = categoryReports.reduce<CategoryReport | null>((current, report) => (!current || report.count > current.count ? report : current), null);
    const expenseEventCount = counters.walletCount + counters.invoicePaymentCount;

    return {
        income,
        spending,
        net,
        savingsRate,
        transactionCount,
        biggestCategory: categoryReports[0] ?? null,
        mostFrequentCategory,
        averageTicket: expenseEventCount > 0 ? roundToCents(spending / expenseEventCount) : 0,
        bestMonth,
        worstMonth,
        methodReports: [
            {
                key: "wallet",
                label: "Carteira",
                amount: walletSpending,
                count: counters.walletCount,
                colorClassName: "bg-cyan-400",
                iconClassName: "text-cyan-200 bg-cyan-500/12",
            },
            {
                key: "invoice_payment",
                label: "Fatura paga",
                amount: invoiceSpending,
                count: counters.invoicePaymentCount,
                colorClassName: "bg-amber-400",
                iconClassName: "text-amber-200 bg-amber-500/12",
            },
        ],
    };
}

export function buildReportsDataset(period: ReportPeriod, transactions: Transaction[], creditCardInvoices: CreditCardInvoice[], lookupTransactions: Transaction[] = transactions): ReportsDataset {
    const monthReports = buildMonthReports(period);
    const monthReportsByKey = new Map(monthReports.map((report) => [report.monthKey, report]));

    transactions.forEach((transaction) => {
        const report = monthReportsByKey.get(getMonthKeyFromDateValue(transaction.date));
        if (!report) {
            return;
        }

        if (isIncomeTransaction(transaction)) {
            report.income = roundToCents(report.income + transaction.value);
            report.transactionCount += 1;
        } else if (isWalletSpendingTransaction(transaction)) {
            report.spending = roundToCents(report.spending + transaction.value);
            report.walletSpending = roundToCents(report.walletSpending + transaction.value);
            report.transactionCount += 1;
        } else if (isInvoicePaymentTransaction(transaction)) {
            report.spending = roundToCents(report.spending + transaction.value);
            report.invoiceSpending = roundToCents(report.invoiceSpending + transaction.value);
            report.transactionCount += 1;
        }

        report.net = roundToCents(report.income - report.spending);
    });

    const counters: ExpenseCounters = {
        walletCount: 0,
        invoicePaymentCount: 0,
    };
    const monthKeys = new Set(monthReports.map((report) => report.monthKey));
    const categoryReports = buildCategoryReports(transactions, creditCardInvoices, lookupTransactions, monthKeys, counters);
    const summary = buildSummary(monthReports, categoryReports, counters);

    return {
        monthReports,
        categoryReports,
        summary,
    };
}
