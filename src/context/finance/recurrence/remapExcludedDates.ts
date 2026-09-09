import type { RecurrenceRule } from "./types";
import { monthDistance } from "../transactionSeries/helpers";
import { occurrenceDate } from "./projectOccurrences";

export function remapExcludedDates(rule: RecurrenceRule, anchorDate: string, startNumber: number): string[] {
    const revised = { ...rule, anchorDate, startNumber };
    return rule.excludedDates.map((date) => {
        const number = (rule.startNumber ?? 1) + monthDistance(rule.anchorDate, date) / rule.interval;
        return Number.isInteger(number) && occurrenceDate(rule, number) === date ? occurrenceDate(revised, number) : date;
    });
}
