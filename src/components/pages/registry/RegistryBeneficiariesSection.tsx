import { Reorder } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { BeneficiaryAvatar } from "../../common/BeneficiaryAvatar";
import { AddBeneficiary } from "../../modal/AddBeneficiary";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";

const BENEFICIARY_TYPE_LABELS: Record<string, string> = {
    person: "Pessoa",
    cost_center: "Centro de custo",
    pet: "Pet",
    other: "Outro",
};

export function RegistryBeneficiariesSection() {
    const beneficiaries = useFinanceBeneficiaries();
    const { reorderBeneficiaries } = useFinanceActions();
    const { openModal } = useModal();
    const [showInactive, setShowInactive] = useState(false);

    const visibleBeneficiaries = useMemo(() => beneficiaries.filter((beneficiary) => showInactive || beneficiary.isActive), [beneficiaries, showInactive]);
    const [orderedBeneficiaries, setOrderedBeneficiaries] = useState(visibleBeneficiaries);

    useEffect(() => {
        setOrderedBeneficiaries(visibleBeneficiaries);
    }, [visibleBeneficiaries]);

    const activeCount = beneficiaries.filter((beneficiary) => beneficiary.isActive).length;
    const visibleCount = showInactive ? beneficiaries.length : activeCount;

    const commitOrder = () => {
        void reorderBeneficiaries(orderedBeneficiaries.map((beneficiary) => beneficiary.id));
    };

    return (
        <section className="flex h-full min-h-0 flex-col rounded-xl">
            <RegistrySectionHeader
                title="Seus beneficiários"
                visibleCount={visibleCount}
                isShowingInactive={showInactive}
                showLabel="Mostrar inativos"
                hideLabel="Ocultar inativos"
                createLabel="Novo beneficiário"
                onToggleInactive={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddBeneficiary mode="create" />)}
            />

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {orderedBeneficiaries.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhum beneficiário para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <Reorder.Group axis="y" values={orderedBeneficiaries} onReorder={setOrderedBeneficiaries} className="space-y-2">
                        {orderedBeneficiaries.map((beneficiary, index) => (
                            <Reorder.Item key={beneficiary.id} value={beneficiary} onDragEnd={commitOrder} className="list-none">
                                <RegistryListItemEntrance index={index}>
                                    <BeneficiaryCard
                                        beneficiary={beneficiary}
                                        onEdit={beneficiary.source === "family_shared" ? undefined : () => openModal(<AddBeneficiary mode="edit" beneficiaryId={beneficiary.id} />)}
                                    />
                                </RegistryListItemEntrance>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </section>
    );
}

function BeneficiaryCard({ beneficiary, onEdit }: { beneficiary: Beneficiary; onEdit?: () => void }) {
    const originLabel = beneficiary.source === "family_shared" ? "Membro da família" : beneficiary.isSelfProfile ? "Perfil" : (BENEFICIARY_TYPE_LABELS[beneficiary.type] ?? beneficiary.type);
    const isMe = beneficiary.isSelfProfile && beneficiary.source === "personal";

    return (
        <div
            className={`relative flex overflow-clip rounded-lg border p-3 text-left transition-colors ${beneficiary.isActive ? "border-white/6 bg-white/[0.02] hover:border-white/25" : "border-white/8 bg-white/[0.01] opacity-70 hover:border-white/15"}`}
        >
            <div className="mr-2 flex items-center text-white/35">
                <GripVertical size={15} className="cursor-grab active:cursor-grabbing" />
            </div>

            <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left" disabled={!onEdit}>
                <div className="flex min-w-0 items-center gap-3">
                    <BeneficiaryAvatar beneficiary={beneficiary} className="z-[1] h-11 w-11 rounded-full border border-white/10" textClassName="text-base font-semibold text-white" />
                    <div className="min-w-0">
                        <p className="truncate font-medium text-white">{beneficiary.name}</p>
                        <p className="text-sm text-white/55">{isMe ? "Você" : originLabel}</p>
                    </div>
                </div>
            </button>

            <div className="pointer-events-none absolute -left-20 -top-20 h-30 w-30 rounded-full opacity-40 blur-xl" style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
        </div>
    );
}
