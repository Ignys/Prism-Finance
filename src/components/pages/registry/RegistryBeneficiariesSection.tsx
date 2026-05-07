import { Reorder } from "framer-motion";
import { GripVertical, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Beneficiary, useFinanceActions, useFinanceBeneficiaries } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddBeneficiary } from "../../modal/AddBeneficiary";
import { RegistrySectionActions } from "./RegistrySectionActions";

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

    const visibleBeneficiaries = useMemo(
        () => beneficiaries.filter((beneficiary) => showInactive || beneficiary.isActive),
        [beneficiaries, showInactive],
    );
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
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <UserRound size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Beneficiarios ({visibleCount})</p>
                </div>
                <RegistrySectionActions
                    isShowingInactive={showInactive}
                    showLabel="Mostrar inativos"
                    hideLabel="Ocultar inativos"
                    createLabel="Novo beneficiário"
                    onToggleInactive={() => setShowInactive((current) => !current)}
                    onCreate={() => openModal(<AddBeneficiary mode="create" />)}
                />
            </div>

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {orderedBeneficiaries.length < 1 ? (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhum beneficiario para os filtros atuais.</div>
                ) : (
                    <Reorder.Group axis="y" values={orderedBeneficiaries} onReorder={setOrderedBeneficiaries} className="space-y-2">
                        {orderedBeneficiaries.map((beneficiary) => (
                            <Reorder.Item key={beneficiary.id} value={beneficiary} onDragEnd={commitOrder} className="list-none">
                                <BeneficiaryCard beneficiary={beneficiary} onEdit={() => openModal(<AddBeneficiary mode="edit" beneficiaryId={beneficiary.id} />)} />
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </section>
    );
}

function BeneficiaryCard({ beneficiary, onEdit }: { beneficiary: Beneficiary; onEdit: () => void }) {
    return (
        <div
            className={`relative flex overflow-clip rounded-lg border p-3 text-left transition-colors ${beneficiary.isActive ? "border-white/6 bg-white/[0.02] hover:border-white/25" : "border-white/8 bg-white/[0.01] opacity-70 hover:border-white/15"}`}
        >
            <div className="mr-2 flex items-center text-white/35">
                <GripVertical size={15} className="cursor-grab active:cursor-grabbing" />
            </div>

            <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="z-[1] h-11 w-11 overflow-hidden rounded-full border border-white/10">
                        {beneficiary.avatarImage ? (
                            <img src={beneficiary.avatarImage} alt={beneficiary.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full" style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-white">{beneficiary.name}</p>
                        <p className="text-sm text-white/55">{BENEFICIARY_TYPE_LABELS[beneficiary.type] ?? beneficiary.type}</p>
                    </div>
                </div>
                <span className={`text-xs uppercase tracking-[0.12em] ${beneficiary.isActive ? "text-emerald-300" : "text-neutral-500"}`}>{beneficiary.isActive ? "Ativo" : "Inativo"}</span>
            </button>

            <div className="pointer-events-none absolute -left-20 -top-20 h-30 w-30 rounded-full opacity-40 blur-xl" style={{ backgroundColor: beneficiary.avatarColor ?? "#4B5563" }} />
        </div>
    );
}
