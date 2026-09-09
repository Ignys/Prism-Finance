import { parseDateOnlyToLocalDate } from "../../../lib/localDate";
import type { RecurrenceEnd, RecurrenceRule } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
    if (!isRecord(value)) return null;
    if (value.frequency !== undefined && value.frequency !== "monthly") return null;
    if (typeof value.anchorDate !== "string" || !parseDateOnlyToLocalDate(value.anchorDate)) return null;
    const interval = Number(value.interval ?? 1);
    const amount = Number(value.amount);
    if (!Number.isInteger(interval) || interval < 1 || !Number.isFinite(amount) || Math.round(amount * 100) < 1) return null;
    if (value.startNumber !== undefined && (!Number.isInteger(value.startNumber) || Number(value.startNumber) < 1)) return null;
    if (value.stopNumber !== undefined && (!Number.isInteger(value.stopNumber) || Number(value.stopNumber) < 0)) return null;
    let end: RecurrenceEnd = { type: "never" };
    if (value.end !== undefined) {
        if (!isRecord(value.end)) return null;
        if (value.end.type === "count" && Number.isInteger(value.end.count) && Number(value.end.count) > 0) {
            end = { type: "count", count: Number(value.end.count) };
        } else if (value.end.type === "until" && typeof value.end.date === "string" && parseDateOnlyToLocalDate(value.end.date)) {
            end = { type: "until", date: value.end.date };
        } else if (value.end.type !== "never") return null;
    }
    return {
        ...(typeof value.seriesId === "string" ? { seriesId: value.seriesId } : {}),
        ...(value.startNumber !== undefined ? { startNumber: Number(value.startNumber) } : {}),
        ...(value.stopNumber !== undefined ? { stopNumber: Number(value.stopNumber) } : {}),
        frequency: "monthly", interval, anchorDate: value.anchorDate, amount: Math.round(amount * 100) / 100, end,
        tagIds: stringArray(value.tagIds), excludedDates: stringArray(value.excludedDates).filter((date) => parseDateOnlyToLocalDate(date)),
        notes: typeof value.notes === "string" ? value.notes : null,
        ...(Object.prototype.hasOwnProperty.call(value, "sourceWalletId") ? { sourceWalletId: typeof value.sourceWalletId === "string" ? value.sourceWalletId : null } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "destinationWalletId") ? { destinationWalletId: typeof value.destinationWalletId === "string" ? value.destinationWalletId : null } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "creditCardId") ? { creditCardId: typeof value.creditCardId === "string" ? value.creditCardId : null } : {}),
    };
}

export function requireRecurrenceRule(value: unknown): RecurrenceRule {
    const rule = parseRecurrenceRule(value);
    if (!rule) throw new Error("Regra recorrente inválida: informe data, valor e término válidos.");
    return rule;
}
