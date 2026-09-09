export function asString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function asNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function asDayOfMonth(value: unknown, fallback: number): number {
    const numeric = Math.round(asNumber(value, fallback));
    if (!Number.isFinite(numeric)) {
        return Math.min(31, Math.max(1, fallback));
    }
    return Math.min(31, Math.max(1, numeric));
}
