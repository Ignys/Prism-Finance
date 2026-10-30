import type { CSSProperties } from "react";
import type { Transaction } from "../../../context/FinanceContext";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import { BudgetTransactionRow } from "./BudgetTransactionRow";
import type { BudgetTransactionEntry } from "./budgetUtils";

interface BudgetEntriesTimelineProps {
    entries: BudgetTransactionEntry[];
    /** Teto do orçamento: cada grupo mostra quanto dele ocupa. */
    cap: number;
    color: string | null;
    resolveSourceLabel: (transaction: Transaction) => string | null;
    budgetNameById: Map<string, string>;
    onOpenTransaction: (transaction: Transaction) => void;
}

interface EntryGroup {
    key: string;
    title: string;
    isForecast: boolean;
    entries: BudgetTransactionEntry[];
}

/** Dois grupos, pago (mais recente primeiro) e pendente (próxima primeiro), cada um aberto por um resumo tingido. */
export function BudgetEntriesTimeline({ entries, cap, color, resolveSourceLabel, budgetNameById, onOpenTransaction }: BudgetEntriesTimelineProps) {
    const accent = color ?? "#e5e5e5";
    const byDate = (ascending: boolean) => (a: BudgetTransactionEntry, b: BudgetTransactionEntry) =>
        ascending ? a.transaction.date.localeCompare(b.transaction.date) : b.transaction.date.localeCompare(a.transaction.date);
    const groups: EntryGroup[] = [
        { key: "posted", title: "Pago", isForecast: false, entries: entries.filter((entry) => !entry.isForecast).sort(byDate(false)) },
        { key: "forecast", title: "Pendente", isForecast: true, entries: entries.filter((entry) => entry.isForecast).sort(byDate(true)) },
    ].filter((group) => group.entries.length > 0);

    return (
        <div className="flex flex-col gap-6">
            {groups.map((group) => {
                const total = group.entries.reduce((sum, entry) => sum + entry.transaction.value, 0);
                const capShare = cap > 0 ? Math.round((total / cap) * 100) : 0;
                const headerStyle: CSSProperties = group.isForecast
                    ? { background: "repeating-linear-gradient(135deg, rgba(125,211,252,0.07) 0 6px, rgba(125,211,252,0.025) 6px 12px)" }
                    : { background: `linear-gradient(100deg, ${accent}2e, ${accent}0a 70%)` };

                return (
                    <section key={group.key} className="flex flex-col gap-1">
                        <header
                            className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${group.isForecast ? "border border-dashed border-sky-300/20" : ""}`}
                            style={headerStyle}
                        >
                            <div className="min-w-0">
                                <h3 className={`text-sm font-medium ${group.isForecast ? "text-sky-100/90" : "text-white"}`}>{group.title}</h3>
                                <p className="mt-0.5 text-xs text-white/50">
                                    {group.entries.length} {group.entries.length === 1 ? "despesa" : "despesas"}
                                    {capShare > 0 ? `, ${capShare}% do teto` : ""}
                                </p>
                            </div>
                            <p className={`shrink-0 text-xl font-semibold tracking-tight tabular-nums ${group.isForecast ? "text-sky-100/85" : "text-white"}`}>{formatReportCurrency(total)}</p>
                        </header>
                        <ul className="flex flex-col divide-y divide-white/[0.05]">
                            {group.entries.map((entry) => (
                                <BudgetTransactionRow
                                    key={entry.transaction.id}
                                    entry={entry}
                                    sourceLabel={resolveSourceLabel(entry.transaction)}
                                    alsoInLabels={entry.alsoInBudgetIds.map((id) => budgetNameById.get(id) ?? "outro orçamento")}
                                    onOpen={entry.transaction.isProjected ? undefined : () => onOpenTransaction(entry.transaction)}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
