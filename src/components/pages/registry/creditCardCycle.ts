/** Days from `today` until the next occurrence of `day` (clamped to the month's length); 0 means today. */
export function daysUntilMonthDay(day: number, today: Date = new Date()): number {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let monthOffset = 0; ; monthOffset += 1) {
        const lastDay = new Date(start.getFullYear(), start.getMonth() + monthOffset + 1, 0).getDate();
        const candidate = new Date(start.getFullYear(), start.getMonth() + monthOffset, Math.min(day, lastDay));
        if (candidate >= start) {
            return Math.round((candidate.getTime() - start.getTime()) / 86_400_000);
        }
    }
}
