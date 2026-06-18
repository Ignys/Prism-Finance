import type { TransactionDraft, TransactionType } from "../context/financeTypes";
import { normalizeCsvHeader, parseCsvRows } from "./csv";

const REQUIRED_HEADERS = ["Data Lancamento", "Data Contabil", "Titulo", "Descricao", "Entrada(R$)", "Saida(R$)"] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

export interface ParsedBankStatementTransaction {
    rowNumber: number;
    type: Extract<TransactionType, "income" | "spending">;
    amount: number;
    date: string;
    description: string;
}

export interface BankStatementCsvImportResult {
    transactions: ParsedBankStatementTransaction[];
    skippedRows: string[];
    summary: {
        incomeCount: number;
        incomeTotal: number;
        spendingCount: number;
        spendingTotal: number;
    };
}

interface CsvRow {
    rowNumber: number;
    values: string[];
}

type HeaderIndexes = Record<RequiredHeader, number>;

function normalizeText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
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

function parseStatementDate(value: string): string | null {
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

function parseCurrencyValue(value: string): number {
    const trimmed = value.trim();
    if (!trimmed) {
        return 0;
    }

    const sanitized = trimmed.replace(/[^\d,.-]/g, "");
    const lastCommaIndex = sanitized.lastIndexOf(",");
    const lastDotIndex = sanitized.lastIndexOf(".");
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const normalized =
        decimalSeparator === ","
            ? sanitized.replace(/\./g, "").replace(",", ".")
            : sanitized.replace(/,/g, "");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? Math.abs(parsed) : Number.NaN;
}

function buildDescription(title: string, description: string): string {
    const normalizedTitle = normalizeText(title);
    const normalizedDescription = normalizeText(description);

    if (normalizedTitle && normalizedDescription) {
        return `${normalizedTitle} - ${normalizedDescription}`;
    }

    return normalizedTitle || normalizedDescription || "Transacao importada";
}

function parseTransactionRow(row: CsvRow, indexes: HeaderIndexes): ParsedBankStatementTransaction | string {
    const postedDate = row.values[indexes["Data Lancamento"]] ?? "";
    const accountingDate = row.values[indexes["Data Contabil"]] ?? "";
    const date = parseStatementDate(postedDate) ?? parseStatementDate(accountingDate);
    if (!date) {
        return `Linha ${row.rowNumber}: data invalida.`;
    }

    const income = parseCurrencyValue(row.values[indexes["Entrada(R$)"]] ?? "");
    const spending = parseCurrencyValue(row.values[indexes["Saida(R$)"]] ?? "");
    if (!Number.isFinite(income) || !Number.isFinite(spending)) {
        return `Linha ${row.rowNumber}: valor invalido.`;
    }

    const hasIncome = income > 0;
    const hasSpending = spending > 0;
    if (hasIncome === hasSpending) {
        return `Linha ${row.rowNumber}: informe entrada ou saida, mas nao ambas.`;
    }

    const title = row.values[indexes["Titulo"]] ?? "";
    const description = row.values[indexes["Descricao"]] ?? "";

    return {
        rowNumber: row.rowNumber,
        type: hasIncome ? "income" : "spending",
        amount: hasIncome ? income : spending,
        date,
        description: buildDescription(title, description),
    };
}

export function parseBankStatementCsv(input: string): BankStatementCsvImportResult {
    const rows = parseCsvRows(input);
    if (rows.length < 2) {
        throw new Error("O arquivo CSV nao contem linhas de transacao.");
    }

    const indexes = getHeaderIndexes(rows[0]);
    const parsedRows = rows.slice(1).map<CsvRow>((values, index) => ({
        rowNumber: index + 2,
        values,
    }));

    const transactions: ParsedBankStatementTransaction[] = [];
    const skippedRows: string[] = [];

    parsedRows.forEach((row) => {
        const parsed = parseTransactionRow(row, indexes);
        if (typeof parsed === "string") {
            skippedRows.push(parsed);
            return;
        }

        transactions.push(parsed);
    });

    return {
        transactions,
        skippedRows,
        summary: {
            incomeCount: transactions.filter((transaction) => transaction.type === "income").length,
            incomeTotal: transactions
                .filter((transaction) => transaction.type === "income")
                .reduce((total, transaction) => total + transaction.amount, 0),
            spendingCount: transactions.filter((transaction) => transaction.type === "spending").length,
            spendingTotal: transactions
                .filter((transaction) => transaction.type === "spending")
                .reduce((total, transaction) => total + transaction.amount, 0),
        },
    };
}

export function buildBankStatementTransactionDrafts(
    transactions: ParsedBankStatementTransaction[],
    walletId: string,
): TransactionDraft[] {
    return transactions.map((transaction) => ({
        type: transaction.type,
        value: transaction.type === "income" ? transaction.amount : -transaction.amount,
        date: transaction.date,
        inWallet: walletId,
        paymentMethod: "wallet",
        creditCardId: null,
        categoryId: null,
        beneficiaryId: null,
        tagIds: [],
        description: transaction.description,
        status: "paid",
        notes: transaction.description,
        transactionMode: "single",
        installmentCount: null,
        recurrenceRule: null,
        recurrenceEndDate: null,
    }));
}
