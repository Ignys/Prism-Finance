import { useMemo, useState } from "react";
import { useFinanceActions } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { formatCurrencyBRL, formatTransactionDate } from "../transactions/transactionView";
import { ModalStructure } from "./ModalStructure";

export interface InvoiceAssignmentReviewIssue {
    transactionId: string;
    date: string;
    description: string;
    cardName: string;
    amount: number;
    currentInvoiceLabel: string;
    expectedInvoiceLabel: string;
}

interface ReviewInvoiceAssignmentsModalProps {
    issues: InvoiceAssignmentReviewIssue[];
}

export function ReviewInvoiceAssignmentsModal({ issues }: ReviewInvoiceAssignmentsModalProps) {
    const { closeModal } = useModal();
    const { repairCreditCardInvoiceAssignments } = useFinanceActions();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [submitting, setSubmitting] = useState(false);
    const sortedIssues = useMemo(() => [...issues].sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description)), [issues]);
    const selectedCount = selectedIds.size;
    const hasIssues = sortedIssues.length > 0;
    const allSelected = hasIssues && selectedCount === sortedIssues.length;

    const toggleIssue = (transactionId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(transactionId)) {
                next.delete(transactionId);
            } else {
                next.add(transactionId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(sortedIssues.map((issue) => issue.transactionId)));
    };

    const handleApply = async () => {
        if (selectedIds.size < 1 || submitting) {
            return;
        }

        setSubmitting(true);
        try {
            await repairCreditCardInvoiceAssignments(Array.from(selectedIds));
            closeModal();
        } catch (error) {
            console.error("Failed to repair invoice assignments:", error);
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure height="auto" width="760px">
            <div className="flex max-h-[90vh] flex-col rounded-2xl border border-white/[0.08] bg-[#171717] p-5 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-white">Revisar faturas</h2>
                        <p className="text-sm leading-6 text-white/60">Selecione as compras que devem voltar para a fatura calculada pela data do gasto.</p>
                    </div>

                    <button
                        type="button"
                        onClick={toggleAll}
                        disabled={!hasIssues || submitting}
                        className="inline-flex min-w-32 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.05em] text-white/75 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {allSelected ? "Limpar selecao" : "Selecionar todas"}
                    </button>
                </div>

                <div className="mt-4 min-h-0 overflow-y-auto rounded-xl border border-white/[0.08]">
                    {sortedIssues.map((issue) => {
                        const checked = selectedIds.has(issue.transactionId);

                        return (
                            <label
                                key={issue.transactionId}
                                className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-3 transition-colors last:border-b-0 ${checked ? "bg-emerald-500/10" : "bg-black/10 hover:bg-white/[0.03]"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleIssue(issue.transactionId)}
                                    className="mt-1 h-4 w-4 accent-emerald-400"
                                />

                                <div className="min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">{issue.description || "Compra sem descricao"}</p>
                                            <p className="text-xs text-white/45">
                                                {formatTransactionDate(issue.date, "dd/MM/yyyy")} - {issue.cardName}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold text-white/85">R$ {formatCurrencyBRL(issue.amount)}</span>
                                    </div>

                                    <div className="grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                                        <div className="rounded-lg border border-red-300/15 bg-red-500/10 px-2.5 py-2">
                                            <span className="block uppercase tracking-[0.08em] text-red-100/60">Atual</span>
                                            <strong className="mt-1 block font-semibold text-red-50">{issue.currentInvoiceLabel}</strong>
                                        </div>
                                        <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-2">
                                            <span className="block uppercase tracking-[0.08em] text-emerald-100/60">Sugerida</span>
                                            <strong className="mt-1 block font-semibold text-emerald-50">{issue.expectedInvoiceLabel}</strong>
                                        </div>
                                    </div>
                                </div>
                            </label>
                        );
                    })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-white/55">{selectedCount} de {sortedIssues.length} selecionadas</span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleApply()}
                            disabled={selectedCount < 1 || submitting}
                            className="inline-flex min-w-40 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? "Corrigindo..." : "Corrigir selecionadas"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
