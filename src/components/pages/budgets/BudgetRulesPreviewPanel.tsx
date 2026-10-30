import { useState } from "react";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import { BudgetTransactionRow } from "./BudgetTransactionRow";
import type { BudgetRulesPreview } from "./budgetUtils";

interface BudgetRulesPreviewPanelProps {
    preview: BudgetRulesPreview;
    monthLabel: string;
    budgetNameById: Map<string, string>;
}

const COLLAPSED_ROWS = 5;

export function BudgetRulesPreviewPanel({ preview, monthLabel, budgetNameById }: BudgetRulesPreviewPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { entries, spent, forecast } = preview;
    const visibleEntries = isExpanded ? entries : entries.slice(0, COLLAPSED_ROWS);
    const sharedCount = entries.filter((entry) => entry.alsoInBudgetIds.length > 0).length;

    return (
        <section className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-white">Prévia de {monthLabel}</p>
                <p className="text-xs text-white/55">
                    {entries.length} despesa(s) · <span className="font-medium text-white">{formatReportCurrency(spent)}</span>
                    {forecast > 0 ? ` + ${formatReportCurrency(forecast)} previsto` : ""}
                </p>
            </header>

            {sharedCount > 0 ? <p className="text-xs text-amber-200/80">{sharedCount} despesa(s) também entram em outro orçamento. Use “Deixar de fora” para separar.</p> : null}

            {entries.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/45">As regras ainda não puxam nenhuma despesa neste mês.</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {visibleEntries.map((entry) => (
                        <BudgetTransactionRow
                            key={entry.transaction.id}
                            entry={entry}
                            sourceLabel={null}
                            alsoInLabels={entry.alsoInBudgetIds.map((id) => budgetNameById.get(id) ?? "outro orçamento")}
                        />
                    ))}
                </ul>
            )}

            {entries.length > COLLAPSED_ROWS ? (
                <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="self-start text-xs text-white/55 underline-offset-2 hover:text-white hover:underline"
                >
                    {isExpanded ? "Mostrar menos" : `Ver todas as ${entries.length}`}
                </button>
            ) : null}
        </section>
    );
}
