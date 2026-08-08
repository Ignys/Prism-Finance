import { addMonthsToLocalDate, parseAppDate } from "../../lib/localDate";
import { normalizeStoredTransaction, type StoredTransaction, type Tag, type TransactionGroup, type TransactionTag } from "../financeTypes";
import { createId, getTodayDate, roundToCents } from "./helpers";

const RECURRING_MONTHS_HORIZON = 12;

interface RecurrenceRuleView {
    interval: number;
    anchorDate: string;
    amount: number;
    tagIds: string[];
    excludedDates: Set<string>;
    notes: string | null;
    sourceWalletId: string | null;
    destinationWalletId: string | null;
    creditCardId: string | null;
}

function recalculateGroupTotals(groups: TransactionGroup[], transactions: StoredTransaction[]): TransactionGroup[] {
    const amountsByGroupId = new Map<string, number>();
    transactions.forEach((transaction) => {
        amountsByGroupId.set(transaction.groupId, roundToCents((amountsByGroupId.get(transaction.groupId) ?? 0) + Math.abs(transaction.amount)));
    });
    return groups.map((group) => ({ ...group, totalAmount: amountsByGroupId.get(group.id) ?? 0 }));
}

function readRecurrenceRule(group: TransactionGroup, transactions: StoredTransaction[], transactionTags: TransactionTag[], validTagIds: Set<string>): RecurrenceRuleView | null {
    if (group.transactionMode !== "recurring") {
        return null;
    }
    const firstTransaction = [...transactions].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id))[0];
    if (!firstTransaction) {
        return null;
    }

    const rule = group.recurrenceRule && typeof group.recurrenceRule === "object" ? group.recurrenceRule : null;
    const rawInterval = rule && "interval" in rule ? Number(rule.interval) : Number.NaN;
    const interval = Number.isInteger(rawInterval) && rawInterval > 0 ? rawInterval : 1;
    const anchorDate = rule && typeof rule.anchorDate === "string" && parseAppDate(rule.anchorDate) ? rule.anchorDate : firstTransaction.scheduledDate;
    const rawAmount = rule && "amount" in rule ? Number(rule.amount) : Number.NaN;
    const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? roundToCents(Math.abs(rawAmount)) : roundToCents(Math.abs(firstTransaction.amount));
    const notes = rule && "notes" in rule && typeof rule.notes === "string" ? rule.notes : firstTransaction.notes ?? null;
    const excludedDates = new Set<string>();
    if (rule && "excludedDates" in rule && Array.isArray(rule.excludedDates)) {
        rule.excludedDates.forEach((value) => {
            if (typeof value === "string" && parseAppDate(value)) {
                excludedDates.add(value);
            }
        });
    }

    const explicitTagIds = rule && "tagIds" in rule && Array.isArray(rule.tagIds)
        ? rule.tagIds.filter((value): value is string => typeof value === "string" && validTagIds.has(value))
        : [];
    const fallbackTagIds = transactionTags
        .filter((link) => link.transactionId === firstTransaction.id && validTagIds.has(link.tagId))
        .map((link) => link.tagId);

    return {
        interval,
        anchorDate,
        amount,
        tagIds: Array.from(new Set(explicitTagIds.length > 0 ? explicitTagIds : fallbackTagIds)),
        excludedDates,
        notes,
        sourceWalletId: rule && "sourceWalletId" in rule && typeof rule.sourceWalletId === "string" ? rule.sourceWalletId : null,
        destinationWalletId: rule && "destinationWalletId" in rule && typeof rule.destinationWalletId === "string" ? rule.destinationWalletId : null,
        creditCardId: rule && "creditCardId" in rule && typeof rule.creditCardId === "string" ? rule.creditCardId : null,
    };
}

export function ensureRecurringTransactionsHorizon(params: {
    groups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    tags: Tag[];
    today?: string;
    now?: string;
    createTransactionId?: () => string;
}): { groups: TransactionGroup[]; transactions: StoredTransaction[]; transactionTags: TransactionTag[]; changed: boolean } {
    const today = params.today ?? getTodayDate();
    const now = params.now ?? new Date().toISOString();
    const horizonEndDate = addMonthsToLocalDate(today, RECURRING_MONTHS_HORIZON - 1);
    const validTagIds = new Set(params.tags.map((tag) => tag.id));
    const nextTransactions = [...params.transactions];
    const nextTransactionTags = [...params.transactionTags];
    const transactionsByGroupId = new Map<string, StoredTransaction[]>();
    nextTransactions.forEach((transaction) => {
        transactionsByGroupId.set(transaction.groupId, [...(transactionsByGroupId.get(transaction.groupId) ?? []), transaction]);
    });
    let changed = false;

    params.groups.forEach((group) => {
        const groupTransactions = transactionsByGroupId.get(group.id) ?? [];
        const recurrence = readRecurrenceRule(group, groupTransactions, nextTransactionTags, validTagIds);
        if (!recurrence) {
            return;
        }
        const effectiveEndDate = group.recurrenceEndDate && parseAppDate(group.recurrenceEndDate) && group.recurrenceEndDate < horizonEndDate
            ? group.recurrenceEndDate
            : horizonEndDate;
        if (recurrence.anchorDate > effectiveEndDate) {
            return;
        }

        const existingDates = new Set(groupTransactions.map((transaction) => transaction.scheduledDate));
        let cursor = recurrence.anchorDate;
        while (cursor <= effectiveEndDate) {
            if (!existingDates.has(cursor) && !recurrence.excludedDates.has(cursor)) {
                const transaction = normalizeStoredTransaction({
                    id: params.createTransactionId?.() ?? createId("tx-recurring"),
                    groupId: group.id,
                    installmentNumber: null,
                    amount: recurrence.amount,
                    scheduledDate: cursor,
                    status: "pending",
                    paidAt: null,
                    invoiceId: null,
                    notes: recurrence.notes,
                    sourceWalletId: recurrence.sourceWalletId,
                    destinationWalletId: recurrence.destinationWalletId,
                    creditCardId: recurrence.creditCardId,
                    createdAt: now,
                });
                nextTransactions.push(transaction);
                existingDates.add(cursor);
                recurrence.tagIds.forEach((tagId) => nextTransactionTags.push({ transactionId: transaction.id, tagId }));
                changed = true;
            }
            cursor = addMonthsToLocalDate(cursor, recurrence.interval);
        }
    });

    return {
        groups: changed ? recalculateGroupTotals(params.groups, nextTransactions) : params.groups,
        transactions: nextTransactions,
        transactionTags: nextTransactionTags,
        changed,
    };
}
