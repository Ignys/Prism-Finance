import { useId, useState } from "react";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { formatReportCurrency } from "./planningReportFormatting";

const GRID_LINES = 4;
// Acima disso os rótulos dos meses se sobrepõem; mostra um a cada N.
const MAX_MONTH_LABELS = 8;
// Até aqui cabe o valor escrito sobre cada ponto; acima disso, só no foco.
const MAX_VALUE_LABELS = 6;
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export interface LinePoint {
    monthKey: string;
    label: string;
    shortLabel: string;
    value: number;
    /** Classe do ponto; sem ela, o ponto usa a cor da linha. */
    dotClassName?: string;
    /** Texto curto ao lado do valor em foco, como o estado da fatura. */
    note?: string;
}

interface PlanningReportsLineSectionProps {
    title: string;
    points: LinePoint[];
    color: string;
}

/** Linha mês a mês com valor sobre cada ponto e leitura do mês em foco no topo do card. */
export function PlanningReportsLineSection({ title, points, color }: PlanningReportsLineSectionProps) {
    const gradientId = useId();
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const values = points.map((point) => point.value);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const range = max - min || 1;
    const x = (index: number) => (points.length > 1 ? (index / (points.length - 1)) * 100 : 50);
    const y = (value: number) => 100 - ((value - min) / range) * 100;
    const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    const activeIndex = Math.max(0, points.findIndex((point) => point.monthKey === activeKey));
    const focusIndex = activeKey ? activeIndex : points.length - 1;
    const focus = points[focusIndex];
    const previous = points[focusIndex - 1];
    // Sem foco, compara com o início do período; com foco, com o mês anterior.
    const change = !focus ? 0 : activeKey ? (previous ? focus.value - previous.value : null) : first ? focus.value - first.value : null;
    const changeLabel = activeKey ? "vs. mês anterior" : "no período";
    const showValues = points.length <= MAX_VALUE_LABELS;
    const labelStep = Math.ceil(points.length / MAX_MONTH_LABELS);
    const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => min + (range / GRID_LINES) * index);

    return (
        <PlanningReportsPanel
            title={title}
            aside={
                focus ? (
                    <div className="text-right" aria-live="polite">
                        <p className="text-lg text-white" style={REPORT_MONO_STYLE}>
                            {focus.note ? <span className="mr-2 font-sans text-xs text-white/50">{focus.note}</span> : null}
                            {formatReportCurrency(focus.value)}
                        </p>
                        {/* Sempre presente para o card não mudar de altura no primeiro mês, que não tem anterior. */}
                        {points.length > 1 ? (
                            <p className={`text-xs ${change === null ? "text-white/30" : change >= 0 ? "text-emerald-300/80" : "text-orange-300/90"}`} style={REPORT_MONO_STYLE}>
                                {change === null ? "— sem mês anterior" : `${change >= 0 ? "+" : "−"}${formatReportCurrency(Math.abs(change))} ${changeLabel}`}
                            </p>
                        ) : null}
                    </div>
                ) : null
            }
        >
            <div className="mt-6 flex flex-1 gap-3" onMouseLeave={() => setActiveKey(null)}>
                <ol className="flex h-48 w-9 shrink-0 flex-col-reverse justify-between text-right text-[10px] text-white/30" style={REPORT_MONO_STYLE} aria-hidden>
                    {ticks.map((tick) => (
                        <li key={tick} className="-my-1.5 leading-3">{compactFormatter.format(tick)}</li>
                    ))}
                </ol>
                <div className="relative h-48 flex-1">
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full overflow-visible"
                        role="img"
                        aria-label={points.map((point) => `${point.label}: ${formatReportCurrency(point.value)}`).join("; ")}
                    >
                        <defs>
                            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {ticks.map((tick) => (
                            <line key={tick} x1="0" x2="100" y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,0.06)" vectorEffect="non-scaling-stroke" />
                        ))}
                        {min < 0 ? <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
                        <polygon points={`0,${y(min)} ${line} 100,${y(min)}`} fill={`url(#${gradientId})`} />
                        <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    {/* Pontos em HTML para não deformarem com o preserveAspectRatio="none". */}
                    {points.map((point, index) => {
                        const isActive = point.monthKey === activeKey;
                        const isEdgeStart = index === 0 && points.length > 1;
                        const isEdgeEnd = index === points.length - 1 && points.length > 1;
                        return (
                            <button
                                key={point.monthKey}
                                type="button"
                                aria-pressed={isActive}
                                aria-label={`${point.label}: ${formatReportCurrency(point.value)}${point.note ? ` (${point.note.toLowerCase()})` : ""}`}
                                onMouseEnter={() => setActiveKey(point.monthKey)}
                                onFocus={() => setActiveKey(point.monthKey)}
                                onBlur={() => setActiveKey(null)}
                                onClick={() => setActiveKey(isActive ? null : point.monthKey)}
                                className="absolute top-0 flex h-full -translate-x-1/2 justify-center focus-visible:outline-none"
                                style={{ left: `${x(index)}%`, width: points.length > 1 ? `${100 / points.length}%` : "2rem" }}
                            >
                                <span className={`absolute inset-y-0 w-px transition-colors ${isActive ? "bg-white/20" : "bg-transparent"}`} />
                                {showValues || isActive ? (
                                    <span
                                        className={`absolute z-10 whitespace-nowrap rounded-md transition-all duration-150 ${
                                            isActive
                                                ? "bg-white/[0.08] px-1.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-sm"
                                                : `text-[10px] ${activeKey ? "text-white/25" : "text-white/55"}`
                                        } ${isEdgeStart ? "left-1/2" : isEdgeEnd ? "right-1/2" : ""}`}
                                        style={{ ...REPORT_MONO_STYLE, top: `calc(${y(point.value)}% - ${isActive ? "1.9rem" : "1.4rem"})` }}
                                    >
                                        {formatReportCurrency(point.value)}
                                    </span>
                                ) : null}
                                <span
                                    className={`absolute h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[#111111] transition-transform ${point.dotClassName ?? ""} ${isActive || (!activeKey && point === last) ? "scale-150" : ""}`}
                                    style={{ top: `${y(point.value)}%`, backgroundColor: point.dotClassName ? undefined : color }}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="mt-2 flex gap-3">
                <span className="w-9 shrink-0" />
                <ol className="relative h-4 flex-1">
                    {points.map((point, index) => (index % labelStep === 0 || point === last) && (
                        <li key={point.monthKey} className="absolute -translate-x-1/2 text-[11px] capitalize text-white/40" style={{ left: `${x(index)}%` }}>
                            {point.shortLabel}
                        </li>
                    ))}
                </ol>
            </div>
        </PlanningReportsPanel>
    );
}
