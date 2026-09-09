import type { FinanceSnapshot, TransactionGroup } from "../domainTypes";
import { getLocalTodayDate } from "../../../lib/localDate";
import { isConsolidatedOccurrence } from "./updateRecurringSeries";
import { mergeRecurrenceExclusions } from "./mergeRecurrenceExclusions";

type SeriesSnapshot = Pick<FinanceSnapshot, "transactionGroups" | "transactions" | "transactionTags" | "creditCardInvoices">;
const seriesId = (group: TransactionGroup) => group.recurrenceRule?.seriesId ?? group.id;

/** Rebase explicit local series edits onto the confirmed remote prefix.
 * A rule revision is indivisible. The local retry replaces the future from its
 * edit boundary, while confirmed occurrences retain their original revisions.
 */
export function mergeSeriesRevisions(base: SeriesSnapshot, remote: SeriesSnapshot, target: SeriesSnapshot, merged: SeriesSnapshot): SeriesSnapshot {
    const baseGroups = new Map(base.transactionGroups.map((group) => [group.id, group]));
    const remoteGroups = new Map(remote.transactionGroups.map((group) => [group.id, group]));
    const targetGroups = new Map(target.transactionGroups.map((group) => [group.id, group]));
    const boundaries = new Map<string, number>();
    for (const group of target.transactionGroups) {
        const rule = group.recurrenceRule;
        if (group.transactionMode !== "recurring" || !rule) continue;
        const previous = baseGroups.get(group.id)?.recurrenceRule;
        const start = rule.startNumber ?? 1;
        let boundary = Infinity;
        if (!previous && (rule.stopNumber ?? Infinity) >= start) boundary = start;
        if (previous && (rule.stopNumber ?? Infinity) < (previous.stopNumber ?? Infinity)) boundary = rule.stopNumber! + 1;
        if (boundary !== Infinity) boundaries.set(seriesId(group), Math.min(boundaries.get(seriesId(group)) ?? Infinity, boundary));
    }
    const revisedGroups = merged.transactionGroups.map((group) => {
        const boundary = boundaries.get(seriesId(group));
        if (boundary === undefined || !group.recurrenceRule) return group;
        const local = targetGroups.get(group.id);
        if (local && !baseGroups.has(group.id)) return local;
        const confirmed = remoteGroups.get(group.id) ?? group;
        return { ...confirmed, recurrenceRule: { ...confirmed.recurrenceRule!, stopNumber: Math.min(confirmed.recurrenceRule?.stopNumber ?? Infinity, boundary - 1) } };
    });
    const transactionGroups = mergeRecurrenceExclusions(revisedGroups, [...remote.transactionGroups, ...target.transactionGroups]);
    if (boundaries.size === 0) return { ...merged, transactionGroups };
    const today = getLocalTodayDate();
    const preserved = new Map(remote.transactions.filter((transaction) => {
        const group = remoteGroups.get(transaction.groupId);
        if (!group || !boundaries.has(seriesId(group))) return false;
        const invoice = remote.creditCardInvoices.find((item) => item.id === transaction.invoiceId);
        return isConsolidatedOccurrence(transaction, group, today) || (invoice?.paidAmount ?? 0) > 0;
    }).map((transaction) => [transaction.id, transaction]));
    const transactions = merged.transactions.map((transaction) => preserved.get(transaction.id) ?? transaction);
    for (const transaction of preserved.values()) {
        if (!transactions.some((item) => item.id === transaction.id)) transactions.push(transaction);
    }
    const transactionTags = merged.transactionTags.filter((link) => !preserved.has(link.transactionId))
        .concat(remote.transactionTags.filter((link) => preserved.has(link.transactionId)));
    return { ...merged, transactionGroups, transactions, transactionTags };
}
