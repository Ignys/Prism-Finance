export const ENTRANCE_EASE = [0.16, 1, 0.3, 1] as const;

export const PANEL_ENTRANCE_INITIAL = { opacity: 0, y: 12 };
export const PANEL_ENTRANCE_ANIMATE = { opacity: 1, y: 0 };
export const PANEL_ENTRANCE_TRANSITION = { duration: 0.42, ease: ENTRANCE_EASE };

const FIRST_ITEM_DELAY_SECONDS = 0.1;
const ITEM_STAGGER_SECONDS = 0.035;
const MAX_STAGGERED_ITEM_INDEX = 14;

export function getItemEntranceDelay(index: number): number {
    return FIRST_ITEM_DELAY_SECONDS + Math.min(index, MAX_STAGGERED_ITEM_INDEX) * ITEM_STAGGER_SECONDS;
}
