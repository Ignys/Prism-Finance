import { ReceiptText } from "lucide-react";

interface PlanningReportsEmptyStateProps {
    title?: string;
    description?: string;
}

export function PlanningReportsEmptyState({
    title = "Sem transações para relatar",
    description = "Receitas e despesas pagas ou pendentes vão aparecer aqui assim que forem registradas.",
}: PlanningReportsEmptyStateProps) {
    return (
        <div className="flex min-h-[380px] items-center justify-center rounded-lg border border-white/[0.08] bg-[#111111] p-8 text-center">
            <div className="max-w-sm">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
                    <ReceiptText size={21} />
                </span>
                <p className="mt-4 text-lg font-medium text-white">{title}</p>
                <p className="mt-2 text-sm text-white/48">{description}</p>
            </div>
        </div>
    );
}
