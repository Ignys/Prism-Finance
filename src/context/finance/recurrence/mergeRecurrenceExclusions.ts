import type { TransactionGroup } from "../domainTypes";
import { monthDistance } from "../transactionSeries/helpers";
import { occurrenceDate } from "./projectOccurrences";

/** Exclusions are deletion intent, so a concurrent rule edit must retain their slots. */
export function mergeRecurrenceExclusions(groups: TransactionGroup[], sources: TransactionGroup[]): TransactionGroup[] {
    const excludedBySeries = new Map<string, Set<number>>();
    for (const group of sources) {
        const rule = group.recurrenceRule;
        if (group.transactionMode !== "recurring" || !rule) continue;
        const seriesId = rule.seriesId ?? group.id;
        const numbers = excludedBySeries.get(seriesId) ?? new Set<number>();
        for (const date of rule.excludedDates) {
            const number = (rule.startNumber ?? 1) + monthDistance(rule.anchorDate, date) / rule.interval;
            if (Number.isInteger(number) && number > 0 && occurrenceDate(rule, number) === date) numbers.add(number);
        }
        excludedBySeries.set(seriesId, numbers);
    }
    return groups.map((group) => {
        const rule = group.recurrenceRule;
        if (!rule) return group;
        const numbers = excludedBySeries.get(rule.seriesId ?? group.id);
        if (!numbers?.size) return group;
        const excludedDates = [...new Set([...rule.excludedDates, ...[...numbers].map((number) => occurrenceDate(rule, number))])];
        return { ...group, recurrenceRule: { ...rule, excludedDates } };
    });
}
