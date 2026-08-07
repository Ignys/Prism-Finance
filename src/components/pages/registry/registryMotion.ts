export const REGISTRY_ENTRANCE_EASE = [0.16, 1, 0.3, 1] as const;

export const REGISTRY_ITEM_INITIAL = {
    opacity: 0,
    y: 24,
    scale: 0.982,
};

export const REGISTRY_ITEM_ANIMATE = {
    opacity: 1,
    y: 0,
    scale: 1,
};

const FIRST_ITEM_DELAY_SECONDS = 0.12;
const ITEM_STAGGER_SECONDS = 0.055;
const MAX_STAGGERED_ITEM_INDEX = 10;

export function getRegistryItemEntranceDelay(index: number): number {
    return FIRST_ITEM_DELAY_SECONDS + Math.min(index, MAX_STAGGERED_ITEM_INDEX) * ITEM_STAGGER_SECONDS;
}
