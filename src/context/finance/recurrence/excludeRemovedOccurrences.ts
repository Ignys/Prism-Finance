import type { StoredTransaction, TransactionGroup } from "../domainTypes";
import { occurrenceDate } from "./projectOccurrences";

/** Preserve deletion intent when an account override is removed but its series survives. */
export function excludeRemovedOccurrences(groups: TransactionGroup[], removed: StoredTransaction[], originalGroups: TransactionGroup[]): TransactionGroup[] {
    const originals = new Map(originalGroups.map((group) => [group.id, group]));
    return groups.map((group) => {
        const rule = group.recurrenceRule;
        if (group.transactionMode !== "recurring" || !rule) return group;
        const dates = removed.flatMap((transaction) => {
            const original = originals.get(transaction.groupId);
            if (!transaction.occurrenceNumber || !original?.recurrenceRule ||
                (original.recurrenceRule.seriesId ?? original.id) !== (rule.seriesId ?? group.id)) return [];
            return [occurrenceDate(rule, transaction.occurrenceNumber)];
        });
        if (dates.length === 0) return group;
        return { ...group, recurrenceRule: { ...rule, excludedDates: [...new Set([...rule.excludedDates, ...dates])] } };
    });
}
