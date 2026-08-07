export const PLANNING_ENTRANCE_EASE = [0.16, 1, 0.3, 1] as const;

const FIRST_MONTH_DELAY_SECONDS = 0.16;
const MONTH_STAGGER_SECONDS = 0.055;
const MAX_STAGGERED_MONTH_INDEX = 11;

export function getPlanningMonthEntranceDelay(index: number): number {
    return FIRST_MONTH_DELAY_SECONDS + Math.min(index, MAX_STAGGERED_MONTH_INDEX) * MONTH_STAGGER_SECONDS;
}
