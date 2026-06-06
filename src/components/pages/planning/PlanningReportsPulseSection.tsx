import { Activity, CreditCard, Landmark, PieChart, ReceiptText, Sparkles, Trophy, WalletCards, type LucideIcon } from "lucide-react";
import { formatReportCurrency } from "./planningReportFormatting";
import type { MethodReport, ReportsSummary } from "./planningReportsUtils";

export function PlanningReportsPulseSection({ summary }: { summary: ReportsSummary }) {
    const totalMethodSpending = summary.methodReports.reduce((sum, method) => sum + method.amount, 0);
    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-200"><Sparkles size={17} /></span>
                <div><p className="text-base font-medium text-white">Pulso financeiro</p><p className="text-xs text-white/42">Leitura rápida do período</p></div>
            </div>
            <div className="space-y-2">
                <PulseLine icon={Trophy} label="Melhor mês" value={summary.bestMonth ? `${summary.bestMonth.shortLabel} (${formatReportCurrency(summary.bestMonth.net)})` : "--"} />
                <PulseLine icon={Activity} label="Mês mais pressionado" value={summary.worstMonth ? `${summary.worstMonth.shortLabel} (${formatReportCurrency(summary.worstMonth.net)})` : "--"} />
                <PulseLine icon={PieChart} label="Mais recorrente" value={summary.mostFrequentCategory ? `${summary.mostFrequentCategory.label} (${summary.mostFrequentCategory.count}x)` : "--"} />
                <PulseLine icon={ReceiptText} label="Ticket médio" value={formatReportCurrency(summary.averageTicket)} />
            </div>
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/68">{buildPulseText(summary)}</div>
            <div className="mt-3 space-y-2">{summary.methodReports.map((method) => <MethodLine key={method.key} method={method} total={totalMethodSpending} />)}</div>
        </section>
    );
}

function buildPulseText(summary: ReportsSummary): string {
    if (summary.transactionCount === 0) return "Ainda não há volume suficiente para ler seu padrão financeiro.";
    if (summary.income <= 0 && summary.spending > 0) return "O período tem despesas registradas sem receitas correspondentes.";
    if (summary.savingsRate !== null && summary.savingsRate >= 20) return "Seu fluxo recente está respirando bem: parte relevante da renda ficou preservada.";
    if (summary.net < 0) return "O período fechou pressionado; vale revisar as categorias que mais pesaram.";
    if (summary.biggestCategory && summary.spending > 0 && summary.biggestCategory.totalAmount / summary.spending >= 0.45) return `${summary.biggestCategory.label} concentra quase metade das despesas analisadas.`;
    return "O período está equilibrado, sem uma categoria dominando demais o resultado.";
}

function PulseLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"><div className="flex items-center gap-2 text-white/54"><Icon size={14} /><span className="text-xs uppercase tracking-[0.1em]">{label}</span></div><span className="min-w-0 truncate text-right text-sm font-medium text-white/84">{value}</span></div>;
}

function MethodLine({ method, total }: { method: MethodReport; total: number }) {
    const percent = total > 0 ? (method.amount / total) * 100 : 0;
    const Icon = method.key === "invoice_payment" ? CreditCard : WalletCards;
    const DetailIcon = method.key === "invoice_payment" ? CreditCard : Landmark;
    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${method.iconClassName}`}><Icon size={14} /></span><div><p className="text-sm font-medium text-white">{method.label}</p><p className="flex items-center gap-1 text-xs text-white/42"><DetailIcon size={11} />{method.count} lançamentos</p></div></div>
                <div className="text-right"><p className="text-sm font-semibold text-white">{formatReportCurrency(method.amount)}</p><p className="text-xs text-white/42">{percent.toFixed(1)}%</p></div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${method.colorClassName}`} style={{ width: `${Math.min(100, percent)}%` }} /></div>
        </div>
    );
}
