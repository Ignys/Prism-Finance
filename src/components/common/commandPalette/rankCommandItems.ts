import { normalizeComparisonText } from "../../../context/finance/helpers";

export interface SearchableCommand {
    label: string;
    keywords: string;
}

/** Rótulo que começa com a busca > rótulo que contém > só palavras-chave contêm. Mantém a ordem original no empate. */
export function rankCommandItems<T extends SearchableCommand>(items: T[], query: string, limit: number): T[] {
    const needle = normalizeComparisonText(query.trim());
    if (!needle) {
        return items.slice(0, limit);
    }

    const scored: Array<{ item: T; score: number; index: number }> = [];
    items.forEach((item, index) => {
        const label = normalizeComparisonText(item.label);
        const score = label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : normalizeComparisonText(item.keywords).includes(needle) ? 2 : -1;
        if (score >= 0) {
            scored.push({ item, score, index });
        }
    });

    return scored
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, limit)
        .map((entry) => entry.item);
}
