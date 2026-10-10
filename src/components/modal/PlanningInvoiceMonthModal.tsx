import { CreditCard, X } from "lucide-react";
import { useState } from "react";
import { useModal } from "../../context/ModalContext";
import { formatCurrency, getCurrentMonthKey } from "../pages/planning/planningTimelineUtils";
import { ModalStructure } from "./ModalStructure";
import { formatMonthDisplay, PlanningMonthField } from "./PlanningSimulationModal";

interface PlanningInvoiceMonthModalProps {
    label: string;
    amount: number;
    dueMonthKey: string;
    chargeMonthKey: string;
    onSubmit: (monthKey: string) => void;
}

export function PlanningInvoiceMonthModal({ label, amount, dueMonthKey, chargeMonthKey, onSubmit }: PlanningInvoiceMonthModalProps) {
    const { closeModal } = useModal();
    const [selectedMonthKey, setSelectedMonthKey] = useState(chargeMonthKey);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (selectedMonthKey !== dueMonthKey && selectedMonthKey < getCurrentMonthKey()) {
            setError("Escolha o mês atual ou um mês futuro.");
            return;
        }

        onSubmit(selectedMonthKey);
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="480px">
            <div className="rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <header className="flex items-center justify-between gap-3">
                    <h2 className="ml-1 text-sm uppercase opacity-50">Mover cobrança da fatura</h2>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>

                <section className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-200">
                                <CreditCard size={14} />
                            </span>
                            <span className="truncate text-sm">{label}</span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-red-200">{formatCurrency(amount)}</span>
                    </div>

                    <PlanningMonthField
                        value={selectedMonthKey}
                        onChange={(monthKey) => {
                            setSelectedMonthKey(monthKey);
                            setError(null);
                        }}
                    />

                    <p className="text-xs text-white/50">
                        Vale só para o planejamento; a fatura continua vencendo em {formatMonthDisplay(dueMonthKey).toLowerCase()}. Escolha esse mês para voltar ao original.
                    </p>
                </section>

                {error ? <p className="mt-3 text-sm text-amber-200/90">{error}</p> : null}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="inline-flex min-w-32 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
