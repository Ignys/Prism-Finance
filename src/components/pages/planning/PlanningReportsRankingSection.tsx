import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
import { formatReportCurrency } from "./planningReportFormatting";
import type { BeneficiaryReport } from "./planningReportsUtils";

export function PlanningReportsRankingSection({ beneficiaryReports }: { beneficiaryReports: BeneficiaryReport[] }) {
    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">Despesas dos Beneficiários</p>
                </div>
            </div>
            <div className="space-y-2">
                {beneficiaryReports.length > 0 ? (
                    beneficiaryReports.slice(0, 5).map((beneficiary) => <RankingRow key={beneficiary.key} beneficiary={beneficiary} />)
                ) : (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-white/55">Nenhum gasto encontrado no período.</div>
                )}
            </div>
        </section>
    );
}

function RankingRow({ beneficiary }: { beneficiary: BeneficiaryReport }) {
    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <BeneficiaryAvatar
                        beneficiary={{
                            name: beneficiary.name,
                            avatarImage: beneficiary.avatarImage,
                            avatarColor: beneficiary.avatarColor,
                        }}
                        className="h-10 w-10 rounded-lg border border-white/[0.12]"
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{beneficiary.name}</p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatReportCurrency(beneficiary.totalAmount)}</p>
                    <p className="text-xs text-white/42">{beneficiary.percent.toFixed(1)}%</p>
                </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${Math.min(100, beneficiary.percent)}%` }} />
            </div>
        </div>
    );
}
