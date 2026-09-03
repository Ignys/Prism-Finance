import type { Transaction, TransactionType } from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";

interface TransactionDescriptionSuggestionParams {
    allowedCategoryIds: string[];
    excludeTransactionId?: string;
    limit?: number;
    query: string;
    transactions: Transaction[];
    type: TransactionType;
}

export const MIN_DESCRIPTION_SUGGESTION_QUERY_LENGTH = 2;

function normalizeSearchValue(value: string): string {
    return normalizeComparisonText(value).replace(/\s+/g, " ");
}

function getMatchScore(description: string, query: string): number {
    if (description === query) {
        return 500;
    }
    if (description.startsWith(query)) {
        return 400;
    }

    const descriptionWords = description.split(" ");
    if (descriptionWords.some((word) => word.startsWith(query))) {
        return 320;
    }
    if (description.includes(query)) {
        return 260;
    }

    const queryTokens = query.split(" ").filter(Boolean);
    if (queryTokens.length > 1 && queryTokens.every((token) => description.includes(token))) {
        return 180;
    }

    return 0;
}

export function getTransactionDescriptionSuggestions({
    allowedCategoryIds,
    excludeTransactionId,
    limit = 5,
    query,
    transactions,
    type,
}: TransactionDescriptionSuggestionParams): Transaction[] {
    const normalizedQuery = normalizeSearchValue(query);
    if (normalizedQuery.length < MIN_DESCRIPTION_SUGGESTION_QUERY_LENGTH) {
        return [];
    }

    const allowedCategoryIdSet = new Set(allowedCategoryIds);
    const rankedTransactions = transactions
        .filter((transaction) => {
            const categoryId = transaction.category.id;
            return (
                transaction.id !== excludeTransactionId &&
                transaction.type === type &&
                transaction.systemKind === null &&
                transaction.status !== "cancelled" &&
                transaction.status !== "skipped" &&
                Boolean(categoryId && allowedCategoryIdSet.has(categoryId)) &&
                Boolean(transaction.description.trim())
            );
        })
        .map((transaction) => ({
            transaction,
            normalizedDescription: normalizeSearchValue(transaction.description),
        }))
        .map((candidate) => ({
            ...candidate,
            score: getMatchScore(candidate.normalizedDescription, normalizedQuery),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            if (a.transaction.date !== b.transaction.date) {
                return b.transaction.date.localeCompare(a.transaction.date);
            }
            return b.transaction.meta.criado_em.localeCompare(a.transaction.meta.criado_em);
        });

    const seenDescriptions = new Set<string>();
    const suggestions: Transaction[] = [];

    for (const candidate of rankedTransactions) {
        if (seenDescriptions.has(candidate.normalizedDescription)) {
            continue;
        }

        seenDescriptions.add(candidate.normalizedDescription);
        suggestions.push(candidate.transaction);
        if (suggestions.length >= limit) {
            break;
        }
    }

    return suggestions;
}
