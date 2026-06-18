import {
    buildCreditCardInvoiceId,
    DEFAULT_BENEFICIARY_ID,
    DEFAULT_BENEFICIARY_NAME,
    DEFAULT_EXPENSE_CATEGORY_ID,
    DEFAULT_WALLET_ID,
    type Category,
    type CreditCard,
    type FinanceSnapshot,
    type StoredTransaction,
    type TransactionGroup,
} from "../context/financeTypes";
import { normalizeCsvHeader, parseCsvRows } from "./csv";

const REQUIRED_HEADERS = ["Fatura", "Data de Compra", "Categoria", "Descricao", "Parcela", "Valor (R$)", "Tipo"] as const;
const IMPORTED_EXPENSE_TYPES = new Set(["despesa", "encargo"]);
const FEE_CATEGORY_NAME = "Contas";

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type HeaderIndexes = Record<RequiredHeader, number>;
type ParsedInstallment = { current: number; total: number } | null;

interface CsvRow {
    rowNumber: number;
    values: string[];
}

interface ImportableInvoiceRow {
    rowNumber: number;
    invoiceDate: string;
    invoiceCycleKey: string;
    purchaseDate: string;
    rawCategory: string;
    description: string;
    installment: ParsedInstallment;
    amount: number;
    type: "despesa" | "encargo";
}

interface InstallmentSeries {
    key: string;
    purchaseDate: string;
    rawCategory: string;
    description: string;
    totalInstallments: number;
    rowsByInstallment: Map<number, ImportableInvoiceRow>;
}

export interface CreditCardInvoiceCsvImportResult {
    rows: ImportableInvoiceRow[];
    singleRows: ImportableInvoiceRow[];
    feeRows: ImportableInvoiceRow[];
    installmentSeries: InstallmentSeries[];
    ignoredRows: string[];
    skippedRows: string[];
    summary: {
        totalAmount: number;
        singleCount: number;
        feeCount: number;
        installmentSeriesCount: number;
        ignoredInstallmentsCount: number;
        totalsByInvoice: Array<{
            cycleKey: string;
            invoiceDate: string;
            amount: number;
            count: number;
        }>;
    };
}

export interface BuildCreditCardInvoiceImportSnapshotParams {
    finance: FinanceSnapshot;
    parsed: CreditCardInvoiceCsvImportResult;
    creditCard: CreditCard;
    userId: string | null;
    importedAt?: string;
}

export interface CreditCardInvoiceImportBuildResult {
    finance: FinanceSnapshot;
    createdGroups: number;
    createdTransactions: number;
}

function normalizeText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function normalizeComparisonText(value: string): string {
    return normalizeText(value)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
}

function getHeaderIndexes(headerRow: string[]): HeaderIndexes {
    const normalizedHeaders = headerRow.map(normalizeCsvHeader);

    return REQUIRED_HEADERS.reduce((indexes, header) => {
        const index = normalizedHeaders.indexOf(normalizeCsvHeader(header));
        if (index < 0) {
            throw new Error(`Coluna obrigatoria nao encontrada: ${header}.`);
        }

        return {
            ...indexes,
            [header]: index,
        };
    }, {} as HeaderIndexes);
}

function parseBrazilianDate(value: string): string | null {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) {
        return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCycleKeyFromDate(dateValue: string): string {
    return dateValue.slice(0, 7);
}

function parseCurrencyValue(value: string): number {
    const trimmed = value.trim();
    if (!trimmed) {
        return Number.NaN;
    }

    const negative = /-/.test(trimmed);
    const sanitized = trimmed.replace(/[^\d,.-]/g, "");
    const lastCommaIndex = sanitized.lastIndexOf(",");
    const lastDotIndex = sanitized.lastIndexOf(".");
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const normalized =
        decimalSeparator === ","
            ? sanitized.replace(/\./g, "").replace(",", ".")
            : sanitized.replace(/,/g, "");
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
        return Number.NaN;
    }

    return negative ? -Math.abs(parsed) : Math.abs(parsed);
}

function parseInstallment(value: string): ParsedInstallment {
    const normalized = normalizeComparisonText(value);
    if (!normalized || normalized === "unica" || normalized === "unico") {
        return null;
    }

    const match = /^(\d+)\/(\d+)$/.exec(normalized);
    if (!match) {
        return null;
    }

    const current = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < 2 || current > total) {
        return null;
    }

    return { current, total };
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function shiftCycleKey(cycleKey: string, offset: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(cycleKey);
    if (!match) {
        return cycleKey;
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseImportableRow(row: CsvRow, indexes: HeaderIndexes): ImportableInvoiceRow | string | null {
    const rawType = row.values[indexes.Tipo] ?? "";
    const normalizedType = normalizeComparisonText(rawType);
    if (!normalizedType) {
        return null;
    }

    if (!IMPORTED_EXPENSE_TYPES.has(normalizedType)) {
        return `Linha ${row.rowNumber}: tipo ignorado (${normalizeText(rawType) || "vazio"}).`;
    }

    const amount = parseCurrencyValue(row.values[indexes["Valor (R$)"]] ?? "");
    if (!Number.isFinite(amount)) {
        return `Linha ${row.rowNumber}: valor invalido.`;
    }
    if (amount <= 0) {
        return `Linha ${row.rowNumber}: valor negativo ou zerado ignorado.`;
    }

    const invoiceDate = parseBrazilianDate(row.values[indexes.Fatura] ?? "");
    if (!invoiceDate) {
        return `Linha ${row.rowNumber}: data de fatura invalida.`;
    }

    const purchaseDate = parseBrazilianDate(row.values[indexes["Data de Compra"]] ?? "");
    if (!purchaseDate) {
        return `Linha ${row.rowNumber}: data de compra invalida.`;
    }

    const description = normalizeText(row.values[indexes.Descricao] ?? "");
    if (!description) {
        return `Linha ${row.rowNumber}: descricao vazia.`;
    }

    const installment = parseInstallment(row.values[indexes.Parcela] ?? "");

    return {
        rowNumber: row.rowNumber,
        invoiceDate,
        invoiceCycleKey: getCycleKeyFromDate(invoiceDate),
        purchaseDate,
        rawCategory: normalizeText(row.values[indexes.Categoria] ?? ""),
        description,
        installment,
        amount: roundToCents(amount),
        type: normalizedType === "encargo" ? "encargo" : "despesa",
    };
}

function getInstallmentSeriesKey(row: ImportableInvoiceRow): string {
    const categoryKey = normalizeComparisonText(row.rawCategory || "-");
    return [
        row.purchaseDate,
        normalizeComparisonText(row.description),
        categoryKey,
        row.installment?.total ?? 1,
    ].join("|");
}

function groupInstallmentSeries(rows: ImportableInvoiceRow[]): InstallmentSeries[] {
    const seriesByKey = new Map<string, InstallmentSeries>();

    rows.forEach((row) => {
        if (!row.installment) {
            return;
        }

        const key = getInstallmentSeriesKey(row);
        const existing = seriesByKey.get(key);
        if (existing) {
            existing.rowsByInstallment.set(row.installment.current, row);
            return;
        }

        seriesByKey.set(key, {
            key,
            purchaseDate: row.purchaseDate,
            rawCategory: row.rawCategory,
            description: row.description,
            totalInstallments: row.installment.total,
            rowsByInstallment: new Map([[row.installment.current, row]]),
        });
    });

    return Array.from(seriesByKey.values()).sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || a.description.localeCompare(b.description));
}

function buildTotalsByInvoice(rows: ImportableInvoiceRow[]): CreditCardInvoiceCsvImportResult["summary"]["totalsByInvoice"] {
    const totalsByInvoice = new Map<string, { cycleKey: string; invoiceDate: string; amount: number; count: number }>();

    rows.forEach((row) => {
        const current = totalsByInvoice.get(row.invoiceCycleKey) ?? {
            cycleKey: row.invoiceCycleKey,
            invoiceDate: row.invoiceDate,
            amount: 0,
            count: 0,
        };

        totalsByInvoice.set(row.invoiceCycleKey, {
            ...current,
            invoiceDate: row.invoiceDate < current.invoiceDate ? row.invoiceDate : current.invoiceDate,
            amount: roundToCents(current.amount + row.amount),
            count: current.count + 1,
        });
    });

    return Array.from(totalsByInvoice.values()).sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
}

export function parseCreditCardInvoiceCsv(input: string): CreditCardInvoiceCsvImportResult {
    const rows = parseCsvRows(input);
    if (rows.length < 2) {
        throw new Error("O arquivo CSV nao contem linhas de fatura.");
    }

    const indexes = getHeaderIndexes(rows[0]);
    const parsedRows = rows.slice(1).map<CsvRow>((values, index) => ({
        rowNumber: index + 2,
        values,
    }));

    const importableRows: ImportableInvoiceRow[] = [];
    const ignoredRows: string[] = [];
    const skippedRows: string[] = [];

    parsedRows.forEach((row) => {
        const parsed = parseImportableRow(row, indexes);
        if (!parsed) {
            return;
        }
        if (typeof parsed === "string") {
            if (parsed.includes("tipo ignorado")) {
                ignoredRows.push(parsed);
            } else {
                skippedRows.push(parsed);
            }
            return;
        }

        importableRows.push(parsed);
    });

    const feeRows = importableRows.filter((row) => row.type === "encargo");
    const expenseRows = importableRows.filter((row) => row.type === "despesa");
    const singleRows = expenseRows.filter((row) => !row.installment);
    const installmentSeries = groupInstallmentSeries(expenseRows.filter((row) => row.installment));
    const ignoredInstallmentsCount = installmentSeries.reduce((total, series) => {
        const firstVisibleInstallment = Math.min(...Array.from(series.rowsByInstallment.keys()));
        return total + Math.max(0, firstVisibleInstallment - 1);
    }, 0);

    return {
        rows: importableRows,
        singleRows,
        feeRows,
        installmentSeries,
        ignoredRows,
        skippedRows,
        summary: {
            totalAmount: roundToCents(importableRows.reduce((total, row) => total + row.amount, 0)),
            singleCount: singleRows.length,
            feeCount: feeRows.length,
            installmentSeriesCount: installmentSeries.length,
            ignoredInstallmentsCount,
            totalsByInvoice: buildTotalsByInvoice(importableRows),
        },
    };
}

function createImportId(prefix: string, importedAt: string, index: number): string {
    const compactTimestamp = importedAt.replace(/[^0-9]/g, "").slice(0, 14) || String(Date.now());
    return `${prefix}-${compactTimestamp}-${index}`;
}

function findExpenseCategoryByName(categories: Category[], name: string): Category | null {
    const normalizedName = normalizeComparisonText(name);
    if (!normalizedName || normalizedName === "-") {
        return null;
    }

    return categories.find((category) => category.type === "expense" && category.isActive && normalizeComparisonText(category.name) === normalizedName) ?? null;
}

function resolveCategory(categories: Category[], row: Pick<ImportableInvoiceRow, "rawCategory" | "type">): { id: string; name: string; subcategoryName: string | null } {
    const matchedCategory = row.type === "encargo" ? findExpenseCategoryByName(categories, FEE_CATEGORY_NAME) : findExpenseCategoryByName(categories, row.rawCategory);
    const fallbackCategory = categories.find((category) => category.id === DEFAULT_EXPENSE_CATEGORY_ID) ?? null;
    const category = matchedCategory ?? fallbackCategory;
    if (!category) {
        return {
            id: DEFAULT_EXPENSE_CATEGORY_ID,
            name: "Sem categoria",
            subcategoryName: null,
        };
    }

    const parentCategory = category.parentId ? categories.find((item) => item.id === category.parentId) ?? null : null;

    return {
        id: category.id,
        name: parentCategory?.name ?? category.name,
        subcategoryName: parentCategory ? category.name : null,
    };
}

function getNearestVisibleRow(series: InstallmentSeries, installmentNumber: number): ImportableInvoiceRow {
    const visibleRows = Array.from(series.rowsByInstallment.values()).sort((a, b) => {
        const distance = Math.abs((a.installment?.current ?? 0) - installmentNumber) - Math.abs((b.installment?.current ?? 0) - installmentNumber);
        if (distance !== 0) {
            return distance;
        }
        return (a.installment?.current ?? 0) - (b.installment?.current ?? 0);
    });

    return visibleRows[0];
}

function buildInvoiceTransaction(params: {
    id: string;
    groupId: string;
    installmentNumber: number | null;
    amount: number;
    scheduledDate: string;
    status: "pending" | "skipped";
    invoiceId: string;
    notes: string;
    createdAt: string;
}): StoredTransaction {
    return {
        id: params.id,
        groupId: params.groupId,
        installmentNumber: params.installmentNumber,
        amount: roundToCents(Math.abs(params.amount)),
        scheduledDate: params.scheduledDate,
        status: params.status,
        paidAt: null,
        invoiceId: params.invoiceId,
        notes: params.notes,
        title: null,
        categoryId: null,
        beneficiaryId: null,
        sourceWalletId: null,
        destinationWalletId: null,
        creditCardId: null,
        createdAt: params.createdAt,
    };
}

export function buildCreditCardInvoiceImportSnapshot(params: BuildCreditCardInvoiceImportSnapshotParams): CreditCardInvoiceImportBuildResult {
    const importedAt = params.importedAt ?? new Date().toISOString();
    const sourceWalletId = params.creditCard.bankWalletId ?? DEFAULT_WALLET_ID;
    const nextGroups: TransactionGroup[] = [...params.finance.transactionGroups];
    const nextTransactions: StoredTransaction[] = [...params.finance.transactions];
    let sequence = 0;

    const createGroup = (row: Pick<ImportableInvoiceRow, "description" | "purchaseDate" | "rawCategory" | "type">, mode: "single" | "installment", totalAmount: number, installmentCount: number | null) => {
        sequence += 1;
        const category = resolveCategory(params.finance.categories, row);
        const groupId = createImportId("group-import-invoice", importedAt, sequence);
        const group: TransactionGroup = {
            id: groupId,
            userId: params.userId,
            beneficiaryId: DEFAULT_BENEFICIARY_ID,
            beneficiaryName: DEFAULT_BENEFICIARY_NAME,
            categoryId: category.id,
            categoryName: category.name,
            subcategoryName: category.subcategoryName,
            title: row.description,
            notes: row.description,
            type: "expense",
            transactionMode: mode,
            totalAmount: roundToCents(totalAmount),
            installmentCount,
            recurrenceRule: null,
            recurrenceEndDate: null,
            sourceWalletId,
            destinationWalletId: null,
            creditCardId: params.creditCard.id,
            createdAt: importedAt,
        };
        nextGroups.push(group);
        return group;
    };

    params.parsed.singleRows.forEach((row) => {
        const group = createGroup(row, "single", row.amount, null);
        sequence += 1;
        nextTransactions.push(
            buildInvoiceTransaction({
                id: createImportId("tx-import-invoice", importedAt, sequence),
                groupId: group.id,
                installmentNumber: null,
                amount: row.amount,
                scheduledDate: row.purchaseDate,
                status: "pending",
                invoiceId: buildCreditCardInvoiceId(params.creditCard.id, row.invoiceCycleKey),
                notes: row.description,
                createdAt: importedAt,
            }),
        );
    });

    params.parsed.feeRows.forEach((row) => {
        const group = createGroup(row, "single", row.amount, null);
        sequence += 1;
        nextTransactions.push(
            buildInvoiceTransaction({
                id: createImportId("tx-import-invoice", importedAt, sequence),
                groupId: group.id,
                installmentNumber: null,
                amount: row.amount,
                scheduledDate: row.purchaseDate,
                status: "pending",
                invoiceId: buildCreditCardInvoiceId(params.creditCard.id, row.invoiceCycleKey),
                notes: row.description,
                createdAt: importedAt,
            }),
        );
    });

    params.parsed.installmentSeries.forEach((series) => {
        const transactionRows: StoredTransaction[] = [];
        for (let installmentNumber = 1; installmentNumber <= series.totalInstallments; installmentNumber += 1) {
            const visibleRow = series.rowsByInstallment.get(installmentNumber) ?? null;
            const nearestRow = visibleRow ?? getNearestVisibleRow(series, installmentNumber);
            const nearestInstallmentNumber = nearestRow.installment?.current ?? installmentNumber;
            const invoiceCycleKey = visibleRow?.invoiceCycleKey ?? shiftCycleKey(nearestRow.invoiceCycleKey, installmentNumber - nearestInstallmentNumber);
            const status = visibleRow ? "pending" : installmentNumber < Math.min(...Array.from(series.rowsByInstallment.keys())) ? "skipped" : "pending";
            sequence += 1;
            transactionRows.push(
                buildInvoiceTransaction({
                    id: createImportId("tx-import-invoice", importedAt, sequence),
                    groupId: "",
                    installmentNumber,
                    amount: nearestRow.amount,
                    scheduledDate: series.purchaseDate,
                    status,
                    invoiceId: buildCreditCardInvoiceId(params.creditCard.id, invoiceCycleKey),
                    notes: series.description,
                    createdAt: importedAt,
                }),
            );
        }

        const totalAmount = transactionRows.reduce((total, transaction) => total + transaction.amount, 0);
        const representativeRow = getNearestVisibleRow(series, 1);
        const group = createGroup(representativeRow, "installment", totalAmount, series.totalInstallments);
        transactionRows.forEach((transaction) => {
            nextTransactions.push({
                ...transaction,
                groupId: group.id,
            });
        });
    });

    return {
        finance: {
            ...params.finance,
            transactionGroups: nextGroups,
            transactions: nextTransactions,
        },
        createdGroups: nextGroups.length - params.finance.transactionGroups.length,
        createdTransactions: nextTransactions.length - params.finance.transactions.length,
    };
}
