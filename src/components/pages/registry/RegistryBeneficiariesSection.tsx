import { UserRound } from "lucide-react";
import { useFinanceBeneficiaries } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddBeneficiary } from "../../modal/AddBeneficiary";

const BENEFICIARY_TYPE_LABELS: Record<string, string> = {
    person: "Pessoa",
    cost_center: "Centro de custo",
    pet: "Pet",
    other: "Outro",
};

export function RegistryBeneficiariesSection() {
    const beneficiaries = useFinanceBeneficiaries();
    const { openModal } = useModal();

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <UserRound size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Beneficiarios ({beneficiaries.length})</p>
                </div>
                <button onClick={() => openModal(<AddBeneficiary mode="create" />)} className="cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-sm uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]">
                    Criar beneficiario
                </button>
            </div>

            <div className="space-y-2">
                {beneficiaries.map((beneficiary) => (
                    <button
                        type="button"
                        key={beneficiary.id}
                        onClick={() => openModal(<AddBeneficiary mode="edit" beneficiaryId={beneficiary.id} />)}
                        className="flex relative overflow-clip w-full items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/25"
                    >
                        
                        

                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 overflow-hidden rounded-full border z-10 border-white/10">
                                {beneficiary.avatarImage ? (
                                    <img src={beneficiary.avatarImage} alt={beneficiary.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full" style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-white">{beneficiary.name}</p>
                                <p className="text-sm text-white/55">{BENEFICIARY_TYPE_LABELS[beneficiary.type] ?? beneficiary.type}</p>
                            </div>
                        </div>
                        <span className={`text-xs uppercase tracking-[0.12em] ${beneficiary.isActive ? "text-emerald-300" : "text-neutral-500"}`}>{beneficiary.isActive ? "Ativo" : "Inativo"}</span>
                        <div className={`pointer-events-none absolute -left-20 z-0 -top-20 h-30 w-30 rounded-full blur-xl opacity-40`} style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
                    </button>
                ))}
            </div>
        </section>
    );
}
