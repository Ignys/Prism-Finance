import { useState } from "react";
import { BeneficiaryAvatar } from "../../components/common/BeneficiaryAvatar";
import { AddBeneficiary } from "../../components/modal/AddBeneficiary";
import { useFinanceBeneficiaries } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { MobileListToolbar } from "../MobileListToolbar";

const TYPE_LABELS: Record<string, string> = { person: "Pessoa", cost_center: "Centro de custo", pet: "Pet", other: "Outro" };

export function MobileBeneficiariesSection() {
    const beneficiaries = useFinanceBeneficiaries();
    const { openModal } = useModal();
    const [showInactive, setShowInactive] = useState(false);

    const visible = beneficiaries.filter((item) => showInactive || item.isActive);
    const activeCount = beneficiaries.filter((item) => item.isActive).length;

    return (
        <div className="space-y-5">
            <MobileListToolbar
                countLabel={activeCount === 1 ? "1 beneficiário ativo" : `${activeCount} beneficiários ativos`}
                toggleLabel={showInactive ? "Ocultar inativos" : "Mostrar inativos"}
                createLabel="Novo"
                onToggle={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddBeneficiary mode="create" />)}
            />

            {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">Nenhum beneficiário por aqui. Toque em Novo para cadastrar um.</p>
            ) : (
                <ul className="divide-y divide-white/[0.06]">
                    {visible.map((beneficiary) => {
                        // Family members' profiles are managed by them, so they can't be edited here.
                        const isShared = beneficiary.source === "family_shared";
                        const origin = isShared ? "Membro da família" : beneficiary.isSelfProfile ? "Perfil" : (TYPE_LABELS[beneficiary.type] ?? beneficiary.type);
                        const isMe = beneficiary.isSelfProfile && beneficiary.source === "personal";

                        return (
                            <li key={beneficiary.id}>
                                <button
                                    type="button"
                                    disabled={isShared}
                                    onClick={() => openModal(<AddBeneficiary mode="edit" beneficiaryId={beneficiary.id} />)}
                                    className={`flex w-full items-center gap-3 px-1 py-3 text-left outline-none enabled:active:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-sky-400/60 ${beneficiary.isActive ? "" : "opacity-60"}`}
                                >
                                    <BeneficiaryAvatar beneficiary={beneficiary} className="h-11 w-11 shrink-0 rounded-full" textClassName="text-base font-semibold text-white" />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate font-medium text-white">{beneficiary.name}</span>
                                            {isMe && <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white/80">Você</span>}
                                        </span>
                                        <span className="block truncate text-xs text-neutral-500">{origin}</span>
                                    </span>
                                    {!beneficiary.isActive && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativo</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
