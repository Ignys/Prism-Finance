import type { FinanceSnapshot } from "../domainTypes";
import { monthPeriod } from "./period";
import { projectOccurrences } from "./projectOccurrences";

/** Matches the longest planning timeline, so every planned month has stored occurrences. */
export const MATERIALIZED_MONTHS_AHEAD = 12;

/**
 * Stores every occurrence of the given series (all series when omitted) up to the horizon.
 * Ids are the deterministic projection ids, so two devices materializing the same month converge.
 */
export function materializeSeriesHorizon(snapshot: FinanceSnapshot, today: string, seriesIds?: ReadonlySet<string>): FinanceSnapshot {
    const groups = snapshot.transactionGroups.filter((group) => group.transactionMode === "recurring" && group.recurrenceRule
        && (!seriesIds || seriesIds.has(group.recurrenceRule.seriesId ?? group.id)));
    if (groups.length === 0) return snapshot;
    const startDate = groups.map((group) => group.recurrenceRule!.anchorDate).sort()[0];
    const { endDate } = monthPeriod(today.slice(0, 7), 0, MATERIALIZED_MONTHS_AHEAD);
    if (startDate > endDate) return snapshot;
    const paidInvoiceIds = new Set(snapshot.creditCardInvoices.filter((invoice) => invoice.paidAmount > 0).map((invoice) => invoice.id));
    const projection = projectOccurrences({
        groups, transactions: snapshot.transactions, transactionTags: [], creditCards: snapshot.creditCards,
        creditCardInvoices: snapshot.creditCardInvoices, period: { startDate, endDate },
    });
    // A closed-and-paid invoice cannot receive new rows; those stay projected.
    const created = projection.transactions
        .filter((item) => item.isProjected && !(item.invoiceId && paidInvoiceIds.has(item.invoiceId)))
        .map(({ isProjected: _isProjected, ...transaction }) => transaction);
    if (created.length === 0) return snapshot;
    const createdIds = new Set(created.map((item) => item.id));
    return {
        ...snapshot,
        transactions: snapshot.transactions.concat(created),
        transactionTags: snapshot.transactionTags.concat(projection.transactionTags.filter((link) => createdIds.has(link.transactionId))),
    };
}

export function recurringSeriesIdsOf(snapshot: FinanceSnapshot, transactionIds: Iterable<string>): Set<string> {
    const ids = new Set(transactionIds);
    const groupIds = new Set(snapshot.transactions.filter((item) => ids.has(item.id)).map((item) => item.groupId));
    return new Set(snapshot.transactionGroups.filter((group) => group.transactionMode === "recurring" && groupIds.has(group.id))
        .map((group) => group.recurrenceRule?.seriesId ?? group.id));
}
