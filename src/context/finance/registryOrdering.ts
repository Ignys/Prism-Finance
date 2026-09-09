import type { Category } from "./domainTypes";

export function getNextSortOrder<T extends { sortOrder: number }>(items: T[]): number {
    if (items.length < 1) {
        return 0;
    }
    const maxSortOrder = Math.max(...items.map((item) => item.sortOrder));
    return Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : items.length;
}

export function compareBySortOrderNameAndId<T extends { sortOrder: number; name: string; id: string }>(a: T, b: T): number {
    if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
    }

    const nameComparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    if (nameComparison !== 0) {
        return nameComparison;
    }

    return a.id.localeCompare(b.id);
}

export function compareCategoriesByTypeParentSort(a: Category, b: Category): number {
    if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
    }

    if (a.parentId === b.parentId) {
        return compareBySortOrderNameAndId(a, b);
    }

    if (a.parentId === null) {
        return -1;
    }
    if (b.parentId === null) {
        return 1;
    }

    return a.parentId.localeCompare(b.parentId);
}

