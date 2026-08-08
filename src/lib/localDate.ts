const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function padDatePart(value: number): string {
    return String(value).padStart(2, "0");
}

export function formatLocalDateInput(date: Date): string {
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function getLocalTodayDate(referenceDate = new Date()): string {
    return formatLocalDateInput(referenceDate);
}

export function parseDateOnlyToLocalDate(value: string): Date | null {
    const match = DATE_ONLY_PATTERN.exec(value.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return null;
    }

    return parsed;
}

export function parseAppDate(value: string): Date | null {
    const dateOnly = parseDateOnlyToLocalDate(value);
    if (dateOnly) {
        return dateOnly;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function getLocalDateFromOffset(offsetInDays: number, referenceDate = new Date()): string {
    const targetDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    targetDate.setDate(targetDate.getDate() + offsetInDays);
    return formatLocalDateInput(targetDate);
}

export function addMonthsToLocalDate(value: string, months: number): string {
    const parsed = parseAppDate(value);
    if (!parsed || !Number.isFinite(months)) {
        return value;
    }

    const shiftedMonth = new Date(parsed.getFullYear(), parsed.getMonth() + Math.trunc(months), 1);
    const lastDayOfShiftedMonth = new Date(shiftedMonth.getFullYear(), shiftedMonth.getMonth() + 1, 0).getDate();
    const shiftedDate = new Date(shiftedMonth.getFullYear(), shiftedMonth.getMonth(), Math.min(parsed.getDate(), lastDayOfShiftedMonth));
    return formatLocalDateInput(shiftedDate);
}
