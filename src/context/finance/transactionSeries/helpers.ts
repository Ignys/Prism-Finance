import { parseAppDate } from "../../../lib/localDate";
import type { Category, StoredTransaction, TransactionGroup, TransactionTag } from "../../financeTypes";

export function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

export function addDays(dateValue: string, days: number): string {
    const parsed = parseAppDate(dateValue);
    if (!parsed) {
        return dateValue;
    }
    const shifted = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

export function monthDistance(fromDate: string, toDate: string): number {
    const from = parseAppDate(fromDate);
    const to = parseAppDate(toDate);
    if (!from || !to) {
        return 0;
    }
    return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}

export function compareSeriesTransactions(a: StoredTransaction, b: StoredTransaction, mode: TransactionGroup["transactionMode"]): number {
    if (mode === "installment") {
        const aNumber = a.installmentNumber ?? Number.MAX_SAFE_INTEGER;
        const bNumber = b.installmentNumber ?? Number.MAX_SAFE_INTEGER;
        if (aNumber !== bNumber) {
            return aNumber - bNumber;
        }
    }
    return a.scheduledDate === b.scheduledDate ? a.id.localeCompare(b.id) : a.scheduledDate.localeCompare(b.scheduledDate);
}

export function isAtOrAfter(candidate: StoredTransaction, anchor: StoredTransaction, mode: TransactionGroup["transactionMode"]): boolean {
    if (mode === "installment") {
        return (candidate.installmentNumber ?? Number.MAX_SAFE_INTEGER) >= (anchor.installmentNumber ?? Number.MAX_SAFE_INTEGER);
    }
    return candidate.scheduledDate >= anchor.scheduledDate;
}

export function resolveCategoryFields(group: TransactionGroup, category: Category | null, categories: Category[]): Pick<TransactionGroup, "categoryId" | "categoryName" | "subcategoryName"> {
    if (!category) {
        return { categoryId: group.categoryId, categoryName: group.categoryName, subcategoryName: group.subcategoryName };
    }
    const parent = category.parentId ? categories.find((item) => item.id === category.parentId) ?? null : null;
    return { categoryId: category.id, categoryName: parent?.name ?? category.name, subcategoryName: parent ? category.name : null };
}

export function recalculateGroupTotals(groups: TransactionGroup[], transactions: StoredTransaction[]): TransactionGroup[] {
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    transactions.forEach((transaction) => {
        totals.set(transaction.groupId, roundToCents((totals.get(transaction.groupId) ?? 0) + Math.abs(transaction.amount)));
        counts.set(transaction.groupId, (counts.get(transaction.groupId) ?? 0) + 1);
    });
    return groups.map((group) => ({
        ...group,
        totalAmount: totals.get(group.id) ?? 0,
        installmentCount: group.transactionMode === "installment" ? counts.get(group.id) ?? null : group.installmentCount,
    }));
}

export function replaceTransactionTags(links: TransactionTag[], transactionIds: ReadonlySet<string>, tagIds: string[]): TransactionTag[] {
    const nextLinks = links.filter((link) => !transactionIds.has(link.transactionId));
    transactionIds.forEach((transactionId) => {
        tagIds.forEach((tagId) => nextLinks.push({ transactionId, tagId }));
    });
    return nextLinks;
}
