export type WishItemPriority = 1 | 2 | 3;

export const DEFAULT_WISH_ITEM_PRIORITY: WishItemPriority = 2;

export const WISH_ITEM_PRIORITY_OPTIONS = [
    {
        value: 1 as WishItemPriority,
        label: "Baixa",
        description: "Pode esperar um pouco mais.",
        color: "#38BDF8",
    },
    {
        value: 2 as WishItemPriority,
        label: "Média",
        description: "Importante, mas sem urgencia imediata.",
        color: "#F59E0B",
    },
    {
        value: 3 as WishItemPriority,
        label: "Alta",
        description: "Esse desejo esta no topo da lista.",
        color: "#EF4444",
    },
] as const;

export function normalizeWishItemPriority(value: unknown): WishItemPriority {
    const parsedValue = Number(value);

    if (parsedValue === 1 || parsedValue === 2 || parsedValue === 3) {
        return parsedValue;
    }

    return DEFAULT_WISH_ITEM_PRIORITY;
}

export function getWishItemPriorityMeta(priority: unknown) {
    const normalizedPriority = normalizeWishItemPriority(priority);
    return WISH_ITEM_PRIORITY_OPTIONS.find((option) => option.value === normalizedPriority) ?? WISH_ITEM_PRIORITY_OPTIONS[1];
}
