import { AlertTriangle, CircleCheck, ShieldAlert } from "lucide-react";
import type { PlanningAlert, PlanningSummary } from "./planningPageShared";
import { formatCurrency, formatDateLabel } from "./planningPageShared";

interface PlanningAlertsPanelProps {
    summary: PlanningSummary;
}

const ALERT_STYLE_BY_TONE: Record<PlanningAlert["tone"], { cardClassName: string; icon: JSX.Element }> = {
    neutral: {
        cardClassName: "border-white/[0.12] bg-white/[0.02] text-white/85",
        icon: <ShieldAlert size={14} />,
    },
    success: {
        cardClassName: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
        icon: <CircleCheck size={14} />,
    },
    warning: {
        cardClassName: "border-amber-400/35 bg-amber-500/10 text-amber-100",
        icon: <AlertTriangle size={14} />,
    },
    danger: {
        cardClassName: "border-red-400/35 bg-red-500/10 text-red-100",
        icon: <ShieldAlert size={14} />,
    },
};

export function PlanningAlertsPanel({ summary }: PlanningAlertsPanelProps) {
    const visibleEvents = summary.events.slice(0, 12);
    const hasHiddenEvents = summary.events.length > visibleEvents.length;

    return (
        <section className="space-y-2">
            <article className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <p className="text-lg font-medium text-white">Alertas inteligentes</p>
                <div className="mt-3 space-y-2">
                    {summary.alerts.map((alert) => {
                        const style = ALERT_STYLE_BY_TONE[alert.tone];
                        return (
                            <div key={alert.id} className={`rounded-xl border p-3 ${style.cardClassName}`}>
                                <div className="flex items-start gap-2">
                                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">{style.icon}</span>
                                    <div>
                                        <p className="text-sm font-medium">{alert.title}</p>
                                        <p className="mt-1 text-xs opacity-90">{alert.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </article>

            <article className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-medium text-white">Linha do tempo de caixa</p>
                    <p className={`text-sm font-medium ${summary.minBalanceInMonth < 0 ? "text-red-300" : "text-emerald-300"}`}>
                        Menor saldo: {formatCurrency(summary.minBalanceInMonth)}
                    </p>
                </div>
                <p className="mt-1 text-xs text-white/45">Data critica: {formatDateLabel(summary.minBalanceDate)}</p>

                <div className="mt-3 space-y-1.5">
                    {visibleEvents.length < 1 && <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-white/55">Nenhum evento de caixa no mes selecionado.</p>}
                    {visibleEvents.map((event) => (
                        <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                            <div>
                                <p className="text-sm text-white/85">{event.label}</p>
                                <p className="text-xs text-white/45">{formatDateLabel(event.date)}</p>
                            </div>
                            <p className={`text-sm font-medium ${event.amount < 0 ? "text-red-300" : "text-emerald-300"}`}>
                                {event.amount < 0 ? "-" : "+"}
                                {formatCurrency(Math.abs(event.amount))}
                            </p>
                        </div>
                    ))}
                </div>

                {hasHiddenEvents && <p className="mt-2 text-xs text-white/45">Exibindo 12 de {summary.events.length} eventos.</p>}
            </article>
        </section>
    );
}
