import { useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AuthShell } from "../layout/AuthShell";
import { AddBeneficiary } from "../modal/AddBeneficiary";

const TYPE_LABELS: Record<string, string> = {
    person: "Pessoa",
    cost_center: "Centro de custo",
    pet: "Pet",
    other: "Outro",
};

export function BeneficiariesPage() {
    const beneficiaries = useFinanceBeneficiaries();
    const { openModal } = useModal();

    return (
        <AuthShell>
            <div className="flex justify-center mt-5">
                <section className="w-7/12 space-y-2">
                    <div className="bg-neutral-900 rounded-lg p-4 flex items-center justify-between">
                        <p className="text-white/60">Beneficiarios cadastrados: {beneficiaries.length}</p>
                        <button onClick={() => openModal(<AddBeneficiary />)} className="default-button py-2 px-4">
                            Criar beneficiario
                        </button>
                    </div>
                    {beneficiaries.map((beneficiary) => (
                        <div key={beneficiary.id} className="bg-[#1e1e1e] p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full border border-white/10" style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
                                <div className="text-left">
                                    <p className="text-base font-medium">{beneficiary.name}</p>
                                    <p className="text-sm text-white/50">{TYPE_LABELS[beneficiary.type] ?? beneficiary.type}</p>
                                </div>
                            </div>
                            <span className={`text-sm ${beneficiary.isActive ? "text-emerald-400" : "text-neutral-500"}`}>{beneficiary.isActive ? "Ativo" : "Inativo"}</span>
                        </div>
                    ))}
                </section>
            </div>
        </AuthShell>
    );
}
