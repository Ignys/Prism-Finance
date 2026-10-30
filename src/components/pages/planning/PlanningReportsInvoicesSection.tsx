import { PlanningReportsLineSection } from "./PlanningReportsLineSection";
import type { InvoiceMonth, InvoiceMonthState } from "./planningAccountReports";

// O estado da fatura vai no ponto e na leitura do mês em foco.
const STATE_STYLE: Record<InvoiceMonthState, { label?: string; dotClassName: string }> = {
    paid: { label: "Paga", dotClassName: "bg-violet-300/50" },
    closed: { label: "Fechada", dotClassName: "bg-orange-300" },
    open: { label: "Aberta", dotClassName: "bg-violet-400" },
    future: { label: "Futura", dotClassName: "bg-violet-400/30" },
    empty: { dotClassName: "bg-white/20" },
};

export function PlanningReportsInvoicesSection({ months }: { months: InvoiceMonth[] }) {
    return (
        <PlanningReportsLineSection
            title="Valor das faturas"
            color="#8b5cf6"
            points={months.map((month) => ({
                monthKey: month.monthKey,
                label: month.label,
                shortLabel: month.shortLabel,
                value: month.total,
                dotClassName: STATE_STYLE[month.state].dotClassName,
                note: STATE_STYLE[month.state].label,
            }))}
        />
    );
}
