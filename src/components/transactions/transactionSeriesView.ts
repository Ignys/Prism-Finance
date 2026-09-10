import { addMonthsToLocalDate, getLocalTodayDate } from "../../lib/localDate";
import { isOccurrenceInRule, projectOccurrences } from "../../context/finance/recurrence/projectOccurrences";
import type { CreditCard, CreditCardInvoice, StoredTransaction, TransactionGroup, TransactionMode, TransactionStatus } from "../../context/finance/domainTypes";

/** Quantas ocorrências futuras projetar para uma série sem fim definido. */
export const SERIES_PROJECTION_WINDOW = 12;

export interface TransactionSeriesRow {
    id: string;
    number: number | null;
    date: string;
    amount: number;
    status: TransactionStatus;
    projected: boolean;
    commitment: "forecast" | "posted";
    paidAt: string | null;
    title: string | null;
    groupId: string;
    sourceWalletId: string | null;
    destinationWalletId: string | null;
    creditCardId: string | null;
    invoiceId: string | null;
}

export interface TransactionSeriesView {
    mode: TransactionMode;
    group: TransactionGroup;
    /** Segmentos da série recorrente (edições "essa e as próximas" criam novos grupos). */
    segments: TransactionGroup[];
    rows: TransactionSeriesRow[];
    /** Verdadeiro quando a série continua além da janela projetada. */
    hasMore: boolean;
    windowEndDate: string | null;
    totals: {
        count: number;
        materializedCount: number;
        projectedCount: number;
        paidAmount: number;
        pendingAmount: number;
        skippedCount: number;
        totalAmount: number;
    };
}

interface BuildTransactionSeriesViewParams {
    groupId: string;
    groups: TransactionGroup[];
    storedTransactions: StoredTransaction[];
    creditCards: CreditCard[];
    creditCardInvoices?: CreditCardInvoice[];
    today?: string;
    projectionWindow?: number;
}

function toRow(transaction: StoredTransaction): TransactionSeriesRow {
    return {
        id: transaction.id,
        number: transaction.installmentNumber ?? transaction.occurrenceNumber ?? null,
        date: transaction.scheduledDate,
        amount: transaction.amount,
        status: transaction.status,
        projected: transaction.isProjected === true,
        commitment: transaction.commitment ?? "posted",
        paidAt: transaction.paidAt,
        title: transaction.title,
        groupId: transaction.groupId,
        sourceWalletId: transaction.sourceWalletId,
        destinationWalletId: transaction.destinationWalletId,
        creditCardId: transaction.creditCardId,
        invoiceId: transaction.invoiceId,
    };
}

export function buildTransactionSeriesView({
    groupId,
    groups,
    storedTransactions,
    creditCards,
    creditCardInvoices = [],
    today = getLocalTodayDate(),
    projectionWindow = SERIES_PROJECTION_WINDOW,
}: BuildTransactionSeriesViewParams): TransactionSeriesView | null {
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
        return null;
    }

    const seriesId = group.recurrenceRule?.seriesId ?? group.id;
    const segments = group.transactionMode === "recurring" ? groups.filter((item) => item.transactionMode === "recurring" && (item.recurrenceRule?.seriesId ?? item.id) === seriesId) : [group];
    const segmentIds = new Set(segments.map((item) => item.id));
    const materialized = storedTransactions.filter((transaction) => segmentIds.has(transaction.groupId));

    let projected: StoredTransaction[] = [];
    let windowEndDate: string | null = null;
    let hasMore = false;

    if (group.transactionMode === "recurring") {
        const maxInterval = Math.max(1, ...segments.map((item) => item.recurrenceRule?.interval ?? 1));
        const anchors = segments.map((item) => item.recurrenceRule?.anchorDate).filter((date): date is string => Boolean(date));
        const startDate = [...anchors, ...materialized.map((transaction) => transaction.scheduledDate)].sort()[0] ?? today;
        windowEndDate = addMonthsToLocalDate(today > startDate ? today : startDate, projectionWindow * maxInterval);
        projected = projectOccurrences({
            groups: segments,
            transactions: materialized,
            transactionTags: [],
            creditCards,
            creditCardInvoices,
            period: { startDate, endDate: windowEndDate },
        }).transactions.filter((transaction) => transaction.isProjected);

        hasMore = segments.some((segment) => {
            const lastNumber = Math.max(0, ...[...materialized, ...projected].filter((transaction) => transaction.groupId === segment.id).map((transaction) => transaction.occurrenceNumber ?? 0));
            return [1, 2, 3].some((offset) => isOccurrenceInRule(segment, lastNumber + offset));
        });
    }

    const rows = [...materialized, ...projected].map(toRow).sort((first, second) => first.date.localeCompare(second.date) || (first.number ?? 0) - (second.number ?? 0));
    const active = rows.filter((row) => row.status !== "skipped" && row.status !== "cancelled");

    return {
        mode: group.transactionMode,
        group,
        segments,
        rows,
        hasMore,
        windowEndDate,
        totals: {
            count: rows.length,
            materializedCount: rows.filter((row) => !row.projected).length,
            projectedCount: rows.filter((row) => row.projected).length,
            paidAmount: active.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount, 0),
            pendingAmount: active.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.amount, 0),
            skippedCount: rows.filter((row) => row.status === "skipped" || row.status === "cancelled").length,
            totalAmount: active.reduce((sum, row) => sum + row.amount, 0),
        },
    };
}
