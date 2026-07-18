import { ReceiptText } from "lucide-react";
import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
import { formatReportCurrency } from "./planningReportFormatting";
import type { BeneficiaryReport } from "./planningReportsUtils";

export function PlanningReportsRankingSection({ beneficiaryReports }: { beneficiaryReports: BeneficiaryReport[] }) {
    return (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-base font-medium text-white">Gastos por beneficiario</p>
                    <p className="text-xs text-white/42">Ranking com ticket medio e peso no total de gastos</p>
                </div>
                <ReceiptText size={18} className="text-white/42" />
            </div>
            <div className="space-y-2">
                {beneficiaryReports.length > 0 ? (
                    beneficiaryReports.slice(0, 5).map((beneficiary) => <RankingRow key={beneficiary.key} beneficiary={beneficiary} />)
                ) : (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-sm text-white/55">Nenhum gasto encontrado no periodo.</div>
                )}
            </div>
        </section>
    );
}

function RankingRow({ beneficiary }: { beneficiary: BeneficiaryReport }) {
    const averageTicket = beneficiary.count > 0 ? beneficiary.totalAmount / beneficiary.count : 0;

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
                        className="h-7 w-7 rounded-lg border border-white/[0.12]"
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{beneficiary.name}</p>
                        <p className="text-xs text-white/42">
                            {beneficiary.count} lancamentos, ticket medio {formatReportCurrency(averageTicket)}
                        </p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatReportCurrency(beneficiary.totalAmount)}</p>
                    <p className="text-xs text-white/42">{beneficiary.percent.toFixed(1)}%</p>
                </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-white/55" style={{ width: `${Math.min(100, beneficiary.percent)}%`, backgroundColor: beneficiary.avatarColor ?? "#E5E7EB" }} />
            </div>
        </div>
    );
}
