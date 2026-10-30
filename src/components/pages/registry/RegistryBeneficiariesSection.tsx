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
                        <div className="py-4 text-sm text-white/45">Nenhum beneficiário para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <Reorder.Group axis="y" values={orderedBeneficiaries} onReorder={setOrderedBeneficiaries} className="divide-y divide-white/[0.06]">
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
        <div className={`group flex items-center gap-1 py-2 ${beneficiary.isActive ? "" : "opacity-60"}`}>
            <span className="inline-flex cursor-grab text-white/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing" aria-hidden="true">
                <GripVertical size={15} />
            </span>

            <button
                type="button"
                onClick={onEdit}
                disabled={!onEdit}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors enabled:hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-white/35"
            >
                <BeneficiaryAvatar beneficiary={beneficiary} className="h-11 w-11 shrink-0 rounded-full" textClassName="text-base font-semibold text-white" />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-white">{beneficiary.name}</span>
                        {isMe ? <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white/80">Você</span> : null}
                    </span>
                    <span className="block truncate text-xs text-white/45">{originLabel}</span>
                </span>
                {!beneficiary.isActive && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativo</span>}
            </button>
        </div>
    );
}
