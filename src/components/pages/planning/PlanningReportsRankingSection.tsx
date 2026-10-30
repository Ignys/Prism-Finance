import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { formatReportCurrency } from "./planningReportFormatting";
import type { BeneficiaryReport } from "./planningReportsUtils";

const RANKING_LIMIT = 5;

export function PlanningReportsRankingSection({ beneficiaryReports }: { beneficiaryReports: BeneficiaryReport[] }) {
    const visible = beneficiaryReports.slice(0, RANKING_LIMIT);

    return (
        <PlanningReportsPanel title="Quem gastou">
            {visible.length > 0 ? (
                <ul className="divide-y divide-white/[0.06]">
                    {visible.map((beneficiary) => (
                        <li key={beneficiary.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                            <BeneficiaryAvatar
                                beneficiary={{ name: beneficiary.name, avatarImage: beneficiary.avatarImage, avatarColor: beneficiary.avatarColor }}
                                className="h-9 w-9 shrink-0 rounded-full border border-white/[0.1]"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="truncate text-sm text-white/85">{beneficiary.name}</p>
                                    <p className="shrink-0 text-sm text-white" style={REPORT_MONO_STYLE}>
                                        {formatReportCurrency(beneficiary.totalAmount)}
                                    </p>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                        <div className="h-full rounded-full bg-white/60" style={{ width: `${beneficiary.percent}%` }} />
                                    </div>
                                    <span className="w-11 shrink-0 text-right text-[11px] text-white/40">{beneficiary.percent.toFixed(1)}%</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="py-8 text-center text-sm text-white/45">Nenhuma despesa com beneficiário no período.</p>
            )}
        </PlanningReportsPanel>
    );
}
