import { formatReportCurrency, formatReportPercent } from "./planningReportFormatting";
import type { CategoryReport, ReportsSummary } from "./planningReportsUtils";

const SPECTRUM_CATEGORY_LIMIT = 7;
// Segmentos menores que isso não têm espaço para o rótulo dentro da faixa.
const SPECTRUM_LABEL_MIN_PERCENT = 9;

export interface OverviewFact {
    label: string;
    value: string;
    className: string;
}

export interface OverviewHeadline {
    label: string;
    value: number;
}

interface PlanningReportsOverviewSectionProps {
    summary: ReportsSummary;
    categoryReports: CategoryReport[];
    /** Sem headline, o destaque é o resultado do período. */
    headline?: OverviewHeadline;
    facts?: OverviewFact[];
}

export function PlanningReportsOverviewSection({ summary, categoryReports, headline, facts }: PlanningReportsOverviewSectionProps) {
    const isPositive = summary.net >= 0;
    const headlineValue = headline?.value ?? summary.net;
    const visibleFacts = facts ?? [
        { label: "Entrou", value: formatReportCurrency(summary.income), className: "text-emerald-200" },
        { label: "Saiu", value: formatReportCurrency(summary.spending), className: "text-rose-200" },
        { label: "Guardado", value: formatReportPercent(summary.savingsRate), className: "text-white" },
    ];
    // A régua é a receita; se as despesas passarem dela, a régua vira a despesa e o limite da receita fica marcado.
    const scale = Math.max(summary.income, summary.spending, 1);
    const ordered = [...categoryReports].sort((a, b) => b.totalAmount - a.totalAmount);
    const top = ordered.slice(0, SPECTRUM_CATEGORY_LIMIT);
    const restAmount = ordered.slice(SPECTRUM_CATEGORY_LIMIT).reduce((sum, category) => sum + category.totalAmount, 0);
    const savedPercent = isPositive ? (summary.net / scale) * 100 : 0;
    const incomeMarker = summary.spending > summary.income && summary.income > 0 ? (summary.income / scale) * 100 : null;
    const segments = [
        ...top.map((category) => ({ key: category.key, label: category.label, amount: category.totalAmount, color: category.color })),
        ...(restAmount > 0 ? [{ key: "rest", label: "Outras", amount: restAmount, color: "rgba(255,255,255,0.28)" }] : []),
    ];

    return (
        <section className="px-1 pb-2 pt-1">
            {/* Saldo de hoje e fatos do período no mesmo peso, todos sobre a faixa. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-x-6">
                <HeadlineFact
                    label={headline?.label ?? "Balanço"}
                    value={`${headlineValue < 0 ? "−" : ""}${formatReportCurrency(Math.abs(headlineValue))}`}
                    className={headlineValue >= 0 ? "text-white" : "text-rose-300"}
                />
                {visibleFacts.map((fact) => (
                    <HeadlineFact key={fact.label} {...fact} />
                ))}
            </dl>

            <div className="mt-6">
                <div
                    className="relative flex h-12 gap-[3px] overflow-hidden rounded-xl"
                    role="img"
                    aria-label={`Despesas de ${formatReportCurrency(summary.spending)} sobre receitas de ${formatReportCurrency(summary.income)}`}
                >
                    {segments.map((segment) => {
                        const width = (segment.amount / scale) * 100;
                        return (
                            <span
                                key={segment.key}
                                className="relative flex h-full min-w-[3px] items-end overflow-hidden px-2.5 pb-2 first:rounded-l-xl"
                                style={{ width: `${width}%`, backgroundColor: segment.color }}
                                title={`${segment.label}: ${formatReportCurrency(segment.amount)}`}
                            >
                                {width >= SPECTRUM_LABEL_MIN_PERCENT ? (
                                    <span className="truncate text-xs font-medium text-black/75">{segment.label}</span>
                                ) : null}
                            </span>
                        );
                    })}
                    {savedPercent > 0 ? (
                        <span
                            className="flex h-full grow items-end rounded-r-xl px-2.5 pb-2"
                            style={{ background: "repeating-linear-gradient(135deg, rgba(110,231,183,0.14) 0 6px, rgba(110,231,183,0.06) 6px 12px)" }}
                            title={`Guardado: ${formatReportCurrency(summary.net)}`}
                        >
                            {savedPercent >= SPECTRUM_LABEL_MIN_PERCENT ? <span className="truncate text-xs font-medium text-emerald-200">Guardado</span> : null}
                        </span>
                    ) : null}
                    {incomeMarker !== null ? (
                        <span className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_2px_#0a0a0a]" style={{ left: `${incomeMarker}%` }} title="Limite da receita" />
                    ) : null}
                </div>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
                    {segments.map((segment) => (
                        <li key={segment.key} className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                            {segment.label}
                            <span className="text-white/35">{formatReportCurrency(segment.amount)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function HeadlineFact({ label, value, className }: { label: string; value: string; className: string }) {
    return (
        <div className="min-w-0 border-l-2 border-white/15 pl-3">
            <dt className="text-xs text-white/45">{label}</dt>
            <dd className={`mt-0.5 truncate text-base font-medium tabular-nums sm:text-lg ${className}`} title={value}>
                {value}
            </dd>
        </div>
    );
}
