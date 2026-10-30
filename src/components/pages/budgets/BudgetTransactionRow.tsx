import { CreditCard, Layers, Wallet } from "lucide-react";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { getTransactionCategoryDisplay } from "../../../lib/transactionCategory";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import type { BudgetTransactionEntry } from "./budgetUtils";

interface BudgetTransactionRowProps {
    entry: BudgetTransactionEntry;
    /** Nome da carteira ou do cartão usado. */
    sourceLabel: string | null;
    /** Nomes dos outros orçamentos em que a despesa também entra. */
    alsoInLabels?: string[];
    /** Ausente para ocorrências projetadas, que ainda não existem como transação. */
    onOpen?: () => void;
}

const FALLBACK_COLOR = "#737373";

function parseDay(date: string): Date {
    const [year, month, day] = date.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
}

function daysFromToday(day: Date): number {
    const now = new Date();
    return Math.round((day.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
}

function describeCountdown(diff: number): string {
    if (diff <= 0) return "Vence hoje";
    if (diff === 1) return "Amanhã";
    return `Em ${diff} dias`;
}

/** Linha de despesa: ícone e nome da categoria, carteira, valor. Pendentes ficam vazadas. */
export function BudgetTransactionRow({ entry, sourceLabel, alsoInLabels = [], onOpen }: BudgetTransactionRowProps) {
    const { transaction, isForecast } = entry;
    const category = getTransactionCategoryDisplay(transaction.category);
    const color = category.color ?? FALLBACK_COLOR;
    const SourceIcon = transaction.paymentMethod === "credit_card" ? CreditCard : Wallet;
    const day = parseDay(transaction.date);
    const CategoryIcon = getCategoryIconComponent(category.icon, "expense");

    const content = (
        <>
            <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isForecast ? "border border-dashed" : ""}`}
                style={isForecast ? { color: `${color}a6`, borderColor: `${color}59` } : { color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
            >
                <CategoryIcon size={18} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate text-sm ${isForecast ? "text-white/70" : "font-medium text-white"}`}>{transaction.description || category.displayLabel}</span>
                    {alsoInLabels.length > 0 ? (
                        <span className="shrink-0 text-amber-200/70" title={`Também em ${alsoInLabels.join(", ")}`} aria-label={`Também em ${alsoInLabels.join(", ")}`}>
                            <Layers size={12} />
                        </span>
                    ) : null}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-3 text-xs text-white/45">
                    <span className="min-w-0 truncate">{category.displayLabel}</span>
                    {sourceLabel ? (
                        <span className="hidden min-w-0 items-center gap-1 text-white/35 sm:flex">
                            <SourceIcon size={11} className="shrink-0" />
                            <span className="truncate">{sourceLabel}</span>
                        </span>
                    ) : null}
                </span>
            </span>

            <span className="flex w-24 shrink-0 flex-col items-end gap-1.5">
                <span className={`text-sm tabular-nums ${isForecast ? "text-white/55" : "font-semibold text-white"}`}>{formatReportCurrency(transaction.value)}</span>
            </span>
        </>
    );
    const rowClassName = "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left";

    if (!onOpen) {
        return <li className={rowClassName}>{content}</li>;
    }

    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className={`${rowClassName} outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sky-400/60`}
                title="Abrir em Transações"
            >
                {content}
            </button>
        </li>
    );
}
