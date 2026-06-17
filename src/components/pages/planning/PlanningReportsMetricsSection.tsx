import { Activity, ArrowDownRight, ArrowUpRight, ReceiptText, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import type { ReportsSummary } from "./planningReportsUtils";
import { formatReportCurrency, formatReportPercent } from "./planningReportFormatting";

export function PlanningReportsMetricsSection({ summary }: { summary: ReportsSummary }) {
    return (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard icon={ArrowUpRight} label="Receitas" value={formatReportCurrency(summary.income)} toneClassName="text-emerald-200 bg-emerald-500/12" />
            <MetricCard icon={ArrowDownRight} label="Despesas" value={formatReportCurrency(summary.spending)} toneClassName="text-red-200 bg-red-500/12" />
            <MetricCard
                icon={Activity}
                label="Saldo líquido"
                value={formatReportCurrency(summary.net)}
                toneClassName={summary.net >= 0 ? "text-emerald-200 bg-emerald-500/12" : "text-orange-200 bg-orange-500/12"}
            />
            <MetricCard icon={Sparkles} label="Economia" value={formatReportPercent(summary.savingsRate)} toneClassName="text-cyan-200 bg-cyan-500/12" />
            <MetricCard icon={Trophy} label="Maior categoria" value={summary.biggestCategory?.label ?? "--"} toneClassName="text-amber-200 bg-amber-500/12" />
            <MetricCard icon={ReceiptText} label="Transações" value={String(summary.transactionCount)} toneClassName="text-violet-200 bg-violet-500/12" />
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, toneClassName }: { icon: LucideIcon; label: string; value: string; toneClassName: string }) {
    return (
        <article className="flex justify-between rounded-lg border border-white/[0.08] bg-[#111111] p-3">
            <div className="flex flex-col">
                <p className="text-[12px] uppercase tracking-[0.06em] text-white/60">{label}</p>
                <p className="truncate text-base font-medium tracking-tight text-white" style={{ fontFamily: '"Azeret Mono", monospace' }} title={value}>
                    {value}
                </p>
            </div>
            <span className={`inline-flex px-3 items-center justify-center rounded-lg ${toneClassName}`}>
                <Icon size={15} />
            </span>
        </article>
    );
}
