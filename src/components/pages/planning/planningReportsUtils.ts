import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Beneficiary, CreditCardInvoice, ReportPeriod, Transaction } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { invoicePaymentContributions } from "./invoicePaymentContributions";
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
    type: "income" | "expense";
    totalAmount: number;
    walletAmount: number;
    invoiceAmount: number;
    count: number;
    percent: number;
}

export interface BeneficiaryReport {
    key: string;
    name: string;
    avatarColor: string | null;
    avatarImage: string | null;
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
    incomeCategoryReports: CategoryReport[];
    beneficiaryReports: BeneficiaryReport[];
    summary: ReportsSummary;
}

interface CategoryAccumulator {
    key: string;
    label: string;
    icon: string;
    color: string;
    type: "income" | "expense";
    totalAmount: number;
    walletAmount: number;
    invoiceAmount: number;
    count: number;
}

interface BeneficiaryAccumulator {
    key: string;
    name: string;
    avatarColor: string | null;
    avatarImage: string | null;
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
    return !transaction.isNonCashSettlement && isIncludedStatus(transaction.status) && isIncludedType(transaction);
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
        type: categoryDisplay.type,
        totalAmount: 0,
        walletAmount: 0,
        invoiceAmount: 0,
        count: 0,
    };

    map.set(key, nextCategory);
    return nextCategory;
}

function ensureBeneficiaryAccumulator(
    map: Map<string, BeneficiaryAccumulator>,
    transaction: Transaction,
    beneficiariesById: Map<string, Beneficiary>,
): BeneficiaryAccumulator {
    const beneficiary = transaction.beneficiaryId ? beneficiariesById.get(transaction.beneficiaryId) : null;
    const fallbackName = transaction.beneficiary.trim() || "Sem beneficiario";
    const key = beneficiary ? `id:${beneficiary.id}` : `name:${fallbackName}`;
    const existing = map.get(key);

    if (existing) {
        return existing;
    }

    const nextBeneficiary: BeneficiaryAccumulator = {
        key,
        name: beneficiary?.name ?? fallbackName,
        avatarColor: beneficiary?.avatarColor ?? null,
        avatarImage: beneficiary?.avatarImage ?? null,
        totalAmount: 0,
        walletAmount: 0,
        invoiceAmount: 0,
        count: 0,
    };

    map.set(key, nextBeneficiary);
    return nextBeneficiary;
}

function addWalletCategoryContribution(categoryReports: Map<string, CategoryAccumulator>, transaction: Transaction): void {
    const category = ensureCategoryAccumulator(categoryReports, transaction);
    category.totalAmount = roundToCents(category.totalAmount + transaction.value);
    category.walletAmount = roundToCents(category.walletAmount + transaction.value);
    category.count += 1;
}

function addWalletBeneficiaryContribution(
    beneficiaryReports: Map<string, BeneficiaryAccumulator>,
    beneficiariesById: Map<string, Beneficiary>,
    transaction: Transaction,
): void {
    const beneficiary = ensureBeneficiaryAccumulator(beneficiaryReports, transaction, beneficiariesById);
    beneficiary.totalAmount = roundToCents(beneficiary.totalAmount + transaction.value);
    beneficiary.walletAmount = roundToCents(beneficiary.walletAmount + transaction.value);
    beneficiary.count += 1;
}

function addInvoiceCategoryContribution(
    categoryReports: Map<string, CategoryAccumulator>,
    paymentTransaction: Transaction,
    invoice: CreditCardInvoice | undefined,
    linkedPurchases: Transaction[],
): void {
    invoicePaymentContributions(paymentTransaction, invoice?.totalAmount ?? 0, linkedPurchases).forEach(({ purchase, amount }) => {
        const category = ensureCategoryAccumulator(categoryReports, purchase);
        category.totalAmount = roundToCents(category.totalAmount + amount);
        category.invoiceAmount = roundToCents(category.invoiceAmount + amount);
        category.count += 1;
    });
}

function addInvoiceBeneficiaryContribution(
    beneficiaryReports: Map<string, BeneficiaryAccumulator>,
    beneficiariesById: Map<string, Beneficiary>,
    paymentTransaction: Transaction,
    invoice: CreditCardInvoice | undefined,
    linkedPurchases: Transaction[],
): void {
    invoicePaymentContributions(paymentTransaction, invoice?.totalAmount ?? 0, linkedPurchases).forEach(({ purchase, amount }) => {
        const beneficiary = ensureBeneficiaryAccumulator(beneficiaryReports, purchase, beneficiariesById);
        beneficiary.totalAmount = roundToCents(beneficiary.totalAmount + amount);
        beneficiary.invoiceAmount = roundToCents(beneficiary.invoiceAmount + amount);
        beneficiary.count += 1;
    });
}

function getLinkedPurchasesByInvoiceId(lookupTransactions: Transaction[]): Map<string, Transaction[]> {
    const purchasesByInvoiceId = new Map<string, Transaction[]>();

    lookupTransactions.forEach((transaction) => {
        if (transaction.type !== "spending" || transaction.paymentMethod !== "credit_card" || !transaction.invoiceId) {
            return;
        }

        if (transaction.commitment === "forecast" || transaction.status === "cancelled" || transaction.status === "skipped") {
            return;
        }

        const linkedTransactions = purchasesByInvoiceId.get(transaction.invoiceId);
        if (linkedTransactions) {
            linkedTransactions.push(transaction);
            return;
        }

        purchasesByInvoiceId.set(transaction.invoiceId, [transaction]);
    });

    return purchasesByInvoiceId;
}

function toCategoryReports(categoryReports: Map<string, CategoryAccumulator>, totalAmount: number): CategoryReport[] {
    return Array.from(categoryReports.values())
        .map((category) => ({
            ...category,
            totalAmount: roundToCents(category.totalAmount),
            walletAmount: roundToCents(category.walletAmount),
            invoiceAmount: roundToCents(category.invoiceAmount),
            percent: totalAmount > 0 ? roundToCents((category.totalAmount / totalAmount) * 100) : 0,
        }))
        .sort((left, right) => right.totalAmount - left.totalAmount || right.count - left.count || left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
}

function toBeneficiaryReports(beneficiaryReports: Map<string, BeneficiaryAccumulator>, totalSpending: number): BeneficiaryReport[] {
    return Array.from(beneficiaryReports.values())
        .map((beneficiary) => ({
            ...beneficiary,
            totalAmount: roundToCents(beneficiary.totalAmount),
            walletAmount: roundToCents(beneficiary.walletAmount),
            invoiceAmount: roundToCents(beneficiary.invoiceAmount),
            percent: totalSpending > 0 ? roundToCents((beneficiary.totalAmount / totalSpending) * 100) : 0,
        }))
        .sort((left, right) => right.totalAmount - left.totalAmount || right.count - left.count || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
}

function buildSpendingReports(
    transactions: Transaction[],
    creditCardInvoices: CreditCardInvoice[],
    lookupTransactions: Transaction[],
    monthKeys: Set<string>,
    counters: ExpenseCounters,
    beneficiaries: Beneficiary[],
): { categoryReports: CategoryReport[]; beneficiaryReports: BeneficiaryReport[] } {
    const categoryReports = new Map<string, CategoryAccumulator>();
    const invoicesById = new Map(creditCardInvoices.map((invoice) => [invoice.id, invoice]));
    const purchasesByInvoiceId = getLinkedPurchasesByInvoiceId(lookupTransactions);
    const beneficiaryReports = new Map<string, BeneficiaryAccumulator>();
    const beneficiariesById = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary]));

    transactions.forEach((transaction) => {
        const monthKey = getMonthKeyFromDateValue(transaction.date);
        if (!monthKeys.has(monthKey)) {
            return;
        }

        if (isWalletSpendingTransaction(transaction)) {
            counters.walletCount += 1;
            addWalletCategoryContribution(categoryReports, transaction);
            addWalletBeneficiaryContribution(beneficiaryReports, beneficiariesById, transaction);
            return;
        }

        if (!isInvoicePaymentTransaction(transaction)) {
            return;
        }

        counters.invoicePaymentCount += 1;
        const invoiceId = transaction.paymentForInvoiceId ?? transaction.invoicePaymentMeta?.invoiceId ?? null;
        const invoice = invoiceId ? invoicesById.get(invoiceId) : undefined;
        const linkedPurchases = invoiceId ? purchasesByInvoiceId.get(invoiceId) ?? [] : [];
        addInvoiceCategoryContribution(categoryReports, transaction, invoice, linkedPurchases);
        addInvoiceBeneficiaryContribution(beneficiaryReports, beneficiariesById, transaction, invoice, linkedPurchases);
    });

    const totalSpending = Array.from(categoryReports.values()).reduce((sum, category) => sum + category.totalAmount, 0);

    return {
        categoryReports: toCategoryReports(categoryReports, totalSpending),
        beneficiaryReports: toBeneficiaryReports(beneficiaryReports, totalSpending),
    };
}

function buildIncomeCategoryReports(transactions: Transaction[], monthKeys: Set<string>): CategoryReport[] {
    const categoryReports = new Map<string, CategoryAccumulator>();

    transactions.forEach((transaction) => {
        const monthKey = getMonthKeyFromDateValue(transaction.date);
        if (!monthKeys.has(monthKey) || !isIncomeTransaction(transaction)) {
            return;
        }

        const category = ensureCategoryAccumulator(categoryReports, transaction);
        category.totalAmount = roundToCents(category.totalAmount + transaction.value);
        category.walletAmount = roundToCents(category.walletAmount + transaction.value);
        category.count += 1;
    });

    const totalIncome = Array.from(categoryReports.values()).reduce((sum, category) => sum + category.totalAmount, 0);
    return toCategoryReports(categoryReports, totalIncome);
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

export function buildReportsDataset(
    period: ReportPeriod,
    transactions: Transaction[],
    creditCardInvoices: CreditCardInvoice[],
    lookupTransactions: Transaction[] = transactions,
    beneficiaries: Beneficiary[] = [],
): ReportsDataset {
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
    const spendingReports = buildSpendingReports(transactions, creditCardInvoices, lookupTransactions, monthKeys, counters, beneficiaries);
    const categoryReports = spendingReports.categoryReports;
    const incomeCategoryReports = buildIncomeCategoryReports(transactions, monthKeys);
    const summary = buildSummary(monthReports, categoryReports, counters);

    return {
        monthReports,
        categoryReports,
        incomeCategoryReports,
        beneficiaryReports: spendingReports.beneficiaryReports,
        summary,
    };
}
