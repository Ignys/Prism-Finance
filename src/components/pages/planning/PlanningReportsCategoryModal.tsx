import { X } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import { ModalStructure } from "../../modal/ModalStructure";
import { CategoryRow } from "./PlanningReportsCategoryList";
import { REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { formatReportCurrency } from "./planningReportFormatting";
import type { CategoryReport } from "./planningReportsUtils";

interface PlanningReportsCategoryModalProps {
    title: string;
    totalAmount: number;
    categoryReports: CategoryReport[];
    showPaymentSplit: boolean;
}

export function PlanningReportsCategoryModal({ title, totalAmount, categoryReports, showPaymentSplit }: PlanningReportsCategoryModalProps) {
    const { closeModal } = useModal();

    return (
        <ModalStructure height="auto" width="560px">
            <div className="flex max-h-[85vh] flex-col rounded-2xl border border-white/[0.09] bg-[#131313] p-5 text-left text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-medium">{title}</h2>
                        <p className="text-sm text-white/60" style={REPORT_MONO_STYLE}>
                            {formatReportCurrency(totalAmount)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                        aria-label="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>
                <ul className="elegant-scrollbar mt-5 min-h-0 space-y-3.5 overflow-y-auto pr-1">
                    {categoryReports.map((category) => (
                        <CategoryRow key={category.key} category={category} showPaymentSplit={showPaymentSplit} />
                    ))}
                </ul>
            </div>
        </ModalStructure>
    );
}
