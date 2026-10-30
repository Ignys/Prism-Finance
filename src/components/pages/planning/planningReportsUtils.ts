import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Beneficiary, CreditCardInvoice, ReportPeriod, Tag, Transaction } from "../../../context/FinanceContext";
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
    /** Compras de cartões selecionados, no mês da fatura. */
    cardSpending: number;
    /** Pagamentos de fatura de cartões fora da seleção. */
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
    key: "wallet" | "credit_card" | "invoice_payment";
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
    /** Despesas por tag; uma transação com várias tags entra em todas, então a soma pode passar de 100%. */
    tagReports: CategoryReport[];
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
    cardCount: number;
    invoicePaymentCount: number;
}

export interface ReportScope {
    walletIds: string[];
    creditCardIds: string[];
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

export function formatMonthLabel(monthKey: string, pattern = "MMM/yy"): string {
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
        cardSpending: 0,
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

const UNCOLORED_TAG = "#a3a3a3";

function ensureTagAccumulators(accumulators: Map<string, CategoryAccumulator>, transaction: Transaction, tagsById: Map<string, Tag>): CategoryAccumulator[] {
    return (transaction.tagIds ?? []).flatMap((tagId) => {
        const tag = tagsById.get(tagId);
        if (!tag) return [];
        const accumulator = accumulators.get(tag.id) ?? {
            key: tag.id,
            label: tag.name,
            icon: "tag",
            color: tag.color ?? UNCOLORED_TAG,
            type: "expense" as const,
            totalAmount: 0,
            walletAmount: 0,
            invoiceAmount: 0,
            count: 0,
        };
        accumulators.set(tag.id, accumulator);
        return [accumulator];
    });
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

function buildSummary(monthReports: MonthReport[], categoryReports: CategoryReport[], counters: ExpenseCounters): ReportsSummary {
    const income = roundToCents(monthReports.reduce((sum, report) => sum + report.income, 0));
    const spending = roundToCents(monthReports.reduce((sum, report) => sum + report.spending, 0));
    const walletSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.walletSpending, 0));
    const cardSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.cardSpending, 0));
    const invoiceSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.invoiceSpending, 0));
    const transactionCount = monthReports.reduce((sum, report) => sum + report.transactionCount, 0);
    const net = roundToCents(income - spending);
    const savingsRate = income > 0 ? (net / income) * 100 : null;
    const bestMonth = monthReports.reduce<MonthReport | null>((best, report) => (!best || report.net > best.net ? report : best), null);
    const worstMonth = monthReports.reduce<MonthReport | null>((worst, report) => (!worst || report.net < worst.net ? report : worst), null);
    const mostFrequentCategory = categoryReports.reduce<CategoryReport | null>((current, report) => (!current || report.count > current.count ? report : current), null);
    const expenseEventCount = counters.walletCount + counters.cardCount + counters.invoicePaymentCount;

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
        methodReports: ([
            {
                key: "wallet",
                label: "Carteira",
                amount: walletSpending,
                count: counters.walletCount,
                colorClassName: "bg-amber-500",
                iconClassName: "text-amber-300 bg-amber-500/12",
            },
            {
                key: "credit_card",
                label: "Cartão",
                amount: cardSpending,
                count: counters.cardCount,
                colorClassName: "bg-violet-400",
                iconClassName: "text-violet-200 bg-violet-500/12",
            },
            {
                key: "invoice_payment",
                label: "Fatura",
                amount: invoiceSpending,
                count: counters.invoicePaymentCount,
                colorClassName: "bg-stone-400",
                iconClassName: "text-stone-200 bg-stone-500/12",
            },
        ] satisfies MethodReport[]).filter((method) => method.count > 0),
    };
}

const INVOICE_PAYMENT_CATEGORY: Transaction["category"] = {
    id: null,
    label: "Pagamento de cartão",
    parentLabel: null,
    icon: "credit-card",
    color: "#d6d3d1",
    type: "expense",
};

function isCardPurchaseTransaction(transaction: Transaction): boolean {
    return isIncludedTransaction(transaction) && transaction.type === "spending" && transaction.paymentMethod === "credit_card" && transaction.commitment !== "forecast";
}

function getInvoicePaymentCardId(transaction: Transaction, invoicesById: Map<string, CreditCardInvoice>): string | null {
    const invoiceId = transaction.paymentForInvoiceId ?? transaction.invoicePaymentMeta?.invoiceId ?? null;
    return transaction.invoicePaymentMeta?.creditCardId ?? (invoiceId ? invoicesById.get(invoiceId)?.creditCardId ?? null : null);
}

export function getInvoiceMonthKey(transaction: Transaction, invoicesById: Map<string, CreditCardInvoice>): string {
    return (transaction.invoiceId ? invoicesById.get(transaction.invoiceId)?.cycleKey : undefined) ?? getMonthKeyFromDateValue(transaction.date);
}

export function isScopedCardPurchase(transaction: Transaction, creditCardIds: Set<string>): boolean {
    return isCardPurchaseTransaction(transaction) && transaction.creditCardId !== null && creditCardIds.has(transaction.creditCardId);
}

/**
 * Relatório restrito às contas selecionadas. Compras de cartão entram no mês da fatura;
 * o pagamento de fatura de um cartão também selecionado é movimento interno e não conta.
 */
export function buildReportsDataset(
    period: ReportPeriod,
    transactions: Transaction[],
    creditCardInvoices: CreditCardInvoice[],
    scope: ReportScope,
    beneficiaries: Beneficiary[] = [],
    tags: Tag[] = [],
): ReportsDataset {
    const monthReports = buildMonthReports(period);
    const monthReportsByKey = new Map(monthReports.map((report) => [report.monthKey, report]));
    const walletIds = new Set(scope.walletIds);
    const creditCardIds = new Set(scope.creditCardIds);
    const invoicesById = new Map(creditCardInvoices.map((invoice) => [invoice.id, invoice]));
    const beneficiariesById = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary]));
    const spendingCategories = new Map<string, CategoryAccumulator>();
    const incomeCategories = new Map<string, CategoryAccumulator>();
    const beneficiaryAccumulators = new Map<string, BeneficiaryAccumulator>();
    const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
    const tagAccumulators = new Map<string, CategoryAccumulator>();
    const counters: ExpenseCounters = { walletCount: 0, cardCount: 0, invoicePaymentCount: 0 };

    const addSpending = (transaction: Transaction, report: MonthReport, method: "wallet" | "card" | "invoice") => {
        report.spending = roundToCents(report.spending + transaction.value);
        if (method === "wallet") report.walletSpending = roundToCents(report.walletSpending + transaction.value);
        if (method === "card") report.cardSpending = roundToCents(report.cardSpending + transaction.value);
        if (method === "invoice") report.invoiceSpending = roundToCents(report.invoiceSpending + transaction.value);
        counters[method === "wallet" ? "walletCount" : method === "card" ? "cardCount" : "invoicePaymentCount"] += 1;

        const categorySource = method === "invoice" ? { ...transaction, category: INVOICE_PAYMENT_CATEGORY } : transaction;
        const accumulators = [
            ensureCategoryAccumulator(spendingCategories, categorySource),
            ensureBeneficiaryAccumulator(beneficiaryAccumulators, transaction, beneficiariesById),
            ...ensureTagAccumulators(tagAccumulators, transaction, tagsById),
        ];
        accumulators.forEach((accumulator) => {
            accumulator.totalAmount = roundToCents(accumulator.totalAmount + transaction.value);
            if (method === "wallet") accumulator.walletAmount = roundToCents(accumulator.walletAmount + transaction.value);
            else accumulator.invoiceAmount = roundToCents(accumulator.invoiceAmount + transaction.value);
            accumulator.count += 1;
        });
    };

    transactions.forEach((transaction) => {
        const isCardPurchase = isCardPurchaseTransaction(transaction);
        const report = isCardPurchase
            ? isScopedCardPurchase(transaction, creditCardIds) ? monthReportsByKey.get(getInvoiceMonthKey(transaction, invoicesById)) : undefined
            : walletIds.has(transaction.inWallet) ? monthReportsByKey.get(getMonthKeyFromDateValue(transaction.date)) : undefined;
        if (!report) return;

        if (isCardPurchase) {
            addSpending(transaction, report, "card");
        } else if (isIncomeTransaction(transaction)) {
            report.income = roundToCents(report.income + transaction.value);
            const category = ensureCategoryAccumulator(incomeCategories, transaction);
            category.totalAmount = roundToCents(category.totalAmount + transaction.value);
            category.walletAmount = roundToCents(category.walletAmount + transaction.value);
            category.count += 1;
        } else if (isWalletSpendingTransaction(transaction)) {
            addSpending(transaction, report, "wallet");
        } else if (isInvoicePaymentTransaction(transaction)) {
            const cardId = getInvoicePaymentCardId(transaction, invoicesById);
            if (cardId && creditCardIds.has(cardId)) return;
            addSpending(transaction, report, "invoice");
        } else {
            return;
        }

        report.transactionCount += 1;
        report.net = roundToCents(report.income - report.spending);
    });

    const totalSpending = monthReports.reduce((sum, report) => sum + report.spending, 0);
    const totalIncome = monthReports.reduce((sum, report) => sum + report.income, 0);
    const categoryReports = toCategoryReports(spendingCategories, totalSpending);

    return {
        monthReports,
        categoryReports,
        incomeCategoryReports: toCategoryReports(incomeCategories, totalIncome),
        beneficiaryReports: toBeneficiaryReports(beneficiaryAccumulators, totalSpending),
        tagReports: toCategoryReports(tagAccumulators, totalSpending),
        summary: buildSummary(monthReports, categoryReports, counters),
    };
}
