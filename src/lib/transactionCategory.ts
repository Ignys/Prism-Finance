import type { ResolvedTransactionCategory } from "../context/FinanceContext";

export interface TransactionCategoryDisplay {
    displayLabel: string;
    icon: string;
    color: string | null;
    type: ResolvedTransactionCategory["type"];
}

export function getTransactionCategoryDisplayLabel(category: Pick<ResolvedTransactionCategory, "label" | "parentLabel">): string {
    if (!category.parentLabel) {
        return category.label;
    }

    const parts = category.label.split("/");
    const subcategoryLabel = parts[parts.length - 1]?.trim();
    return subcategoryLabel || category.label;
}

export function getTransactionCategoryDisplay(category: ResolvedTransactionCategory): TransactionCategoryDisplay {
    return {
        displayLabel: getTransactionCategoryDisplayLabel(category),
        icon: category.icon,
        color: category.color,
        type: category.type,
    };
}
