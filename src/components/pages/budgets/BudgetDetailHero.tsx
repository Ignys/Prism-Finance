import type { CSSProperties } from "react";
import { formatReportCurrency } from "../planning/planningReportFormatting";
import type { BudgetProgress } from "./budgetUtils";

// Segmentos menores que isso não têm espaço para o rótulo dentro da faixa.
const LABEL_MIN_PERCENT = 12;
const OVER_COLOR = "#f87171";

interface BudgetDetailHeroProps {
    progress: BudgetProgress;
    color: string | null;
    /** Fração do mês já decorrida (0–1); marca onde o gasto estaria num ritmo uniforme. */
    paceRatio?: number;
}

interface Segment {
    key: string;
    label: string;
    amount: number;
    style: CSSProperties;
    labelClassName: string;
}

const hatch = (strong: string, soft: string) => `repeating-linear-gradient(135deg, ${strong} 0 6px, ${soft} 6px 12px)`;

function Fact({ label, value, className = "text-white" }: { label: string; value: string; className?: string }) {
    return (
        <div className="min-w-0 border-l-2 border-white/15 pl-3">
            <dt className="text-xs text-white/45">{label}</dt>
            <dd className={`mt-0.5 truncate text-base font-medium tabular-nums sm:text-lg ${className}`} title={value}>
                {value}
            </dd>
        </div>
    );
}

/**
 * Abertura da subpágina no formato do relatório: números sobre a faixa.
 * Dentro do teto: gasto · previsto · livre. Acima dele, a escala vira o total e o excedente fica vermelho.
 */
export function BudgetDetailHero({ progress, color, paceRatio }: BudgetDetailHeroProps) {
    const { budget, spent, forecast, projected } = progress;
    const cap = budget.amount;
    const scale = Math.max(cap, projected, 1);
    const free = cap - projected;
    const fill = color ?? "#e5e5e5";

    const spentIn = Math.min(spent, cap);
    const spentOver = Math.max(0, spent - cap);
    const forecastIn = Math.max(0, Math.min(projected, cap) - spentIn);
    const forecastOver = Math.max(0, forecast - forecastIn);
    const segments: Segment[] = [
        { key: "spent", label: "Gasto", amount: spentIn, style: { backgroundColor: fill }, labelClassName: "text-black/75" },
        { key: "forecast", label: "Previsto", amount: forecastIn, style: { background: hatch(`${fill}8c`, `${fill}40`) }, labelClassName: "text-white" },
        { key: "spent-over", label: "Passou", amount: spentOver, style: { backgroundColor: OVER_COLOR }, labelClassName: "text-black/75" },
        { key: "forecast-over", label: "Vai passar", amount: forecastOver, style: { background: hatch(`${OVER_COLOR}99`, `${OVER_COLOR}40`) }, labelClassName: "text-red-100" },
        { key: "free", label: "Livre", amount: Math.max(0, free), style: { background: hatch("rgba(255,255,255,0.07)", "rgba(255,255,255,0.03)") }, labelClassName: "text-white/60" },
    ].filter((segment) => segment.amount > 0);
    const capPercent = (cap / scale) * 100;
    const isOver = projected > cap;

    return (
        <section className="px-1 pb-2 pt-1">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-x-6">
                <Fact label={free >= 0 ? "Livre no mês" : spent > cap ? "Acima do teto" : "Deve passar do teto"} value={formatReportCurrency(Math.abs(free))} className={free >= 0 ? "text-white" : "text-rose-300"} />
                <Fact label="Gasto" value={formatReportCurrency(spent)} className={spent > cap ? "text-rose-300" : "text-white"} />
                <Fact label="Previsto" value={forecast > 0 ? formatReportCurrency(forecast) : "—"} className={forecast > 0 ? "text-white" : "text-white/35"} />
                <Fact label="Teto" value={formatReportCurrency(cap)} />
            </dl>

            <div className="mt-6">
                <div
                    className="relative flex h-12 gap-[3px] overflow-hidden rounded-xl bg-white/[0.04]"
                    role="img"
                    aria-label={`Gasto de ${formatReportCurrency(spent)} e previsto de ${formatReportCurrency(forecast)} sobre teto de ${formatReportCurrency(cap)}`}
                >
                    {segments.map((segment) => {
                        const width = (segment.amount / scale) * 100;

                        return (
                            <span
                                key={segment.key}
                                className="relative flex h-full min-w-[3px] items-end overflow-hidden px-2.5 pb-2 first:rounded-l-xl last:rounded-r-xl"
                                style={{ width: `${width}%`, ...segment.style }}
                                title={`${segment.label}: ${formatReportCurrency(segment.amount)}`}
                            >
                                {width >= LABEL_MIN_PERCENT ? <span className={`truncate text-xs font-medium ${segment.labelClassName}`}>{segment.label}</span> : null}
                            </span>
                        );
                    })}
                    {paceRatio !== undefined && !isOver ? (
                        <span
                            className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_0_2px_#0a0a0a]"
                            style={{ left: `${((cap * paceRatio) / scale) * 100}%` }}
                            title="Ritmo uniforme até hoje"
                        />
                    ) : null}
                    {isOver ? (
                        <span className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${capPercent}%` }} title="Teto">
                            <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_2px_#0a0a0a]" />
                            {/* Etiqueta no topo da faixa (os rótulos dos segmentos ficam embaixo); vira para a direita se o teto estiver muito à esquerda. */}
                            <span
                                className={`absolute top-1.5 whitespace-nowrap rounded-md bg-[#0a0a0a]/85 px-1.5 py-0.5 text-[10px] font-medium text-white ${
                                    capPercent < 25 ? "left-2.5" : "right-2.5"
                                }`}
                            >
                                Teto {formatReportCurrency(cap)}
                            </span>
                        </span>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
