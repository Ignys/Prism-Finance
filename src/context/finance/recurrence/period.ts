import { addMonthsToLocalDate, getLocalTodayDate, parseDateOnlyToLocalDate } from "../../../lib/localDate";
import type { OccurrencePeriod } from "./types";

export function monthPeriod(monthKey = getLocalTodayDate().slice(0, 7), precedingMonths = 0, followingMonths = 0): OccurrencePeriod {
    const monthStart = `${monthKey}-01`;
    if (!parseDateOnlyToLocalDate(monthStart)) throw new Error("Mês de consulta inválido.");
    const endMonth = addMonthsToLocalDate(monthStart, followingMonths);
    const lastDay = new Date(Number(endMonth.slice(0, 4)), Number(endMonth.slice(5, 7)), 0).getDate();
    return { startDate: addMonthsToLocalDate(monthStart, -precedingMonths), endDate: `${endMonth.slice(0, 7)}-${lastDay}` };
}
