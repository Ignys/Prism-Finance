import { Reorder } from "framer-motion";
import { GripVertical, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Tag as FinanceTag, useFinanceActions, useFinanceTags } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddTag } from "../../modal/AddTag";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";

export function RegistryTagsSection() {
    const tags = useFinanceTags();
    const { reorderTags } = useFinanceActions();
    const { openModal } = useModal();
    const [showInactive, setShowInactive] = useState(false);

    const visibleTags = useMemo(() => tags.filter((tag) => showInactive || tag.isActive), [showInactive, tags]);
    const [orderedTags, setOrderedTags] = useState(visibleTags);

    useEffect(() => {
        setOrderedTags(visibleTags);
    }, [visibleTags]);

    const activeCount = tags.filter((tag) => tag.isActive).length;
    const visibleCount = showInactive ? tags.length : activeCount;

    const commitOrder = () => {
        void reorderTags(orderedTags.map((tag) => tag.id));
    };

    return (
        <section className="flex h-full min-h-0 flex-col">
            <RegistrySectionHeader
                title="Suas tags"
                visibleCount={visibleCount}
                isShowingInactive={showInactive}
                showLabel="Mostrar inativos"
                hideLabel="Ocultar inativos"
                createLabel="Nova tag"
                onToggleInactive={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddTag mode="create" />)}
            />

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {orderedTags.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhuma tag para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <Reorder.Group axis="y" values={orderedTags} onReorder={setOrderedTags} className="space-y-2">
                        {orderedTags.map((tag, index) => (
                            <Reorder.Item key={tag.id} value={tag} onDragEnd={commitOrder} className="list-none">
                                <RegistryListItemEntrance index={index}>
                                    <TagCard tag={tag} onEdit={() => openModal(<AddTag mode="edit" tagId={tag.id} />)} />
                                </RegistryListItemEntrance>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </section>
    );
}

function TagCard({ tag, onEdit }: { tag: FinanceTag; onEdit: () => void }) {
    return (
        <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${tag.isActive ? "border-white/10 bg-black/20" : "border-white/10 bg-white/[0.02] opacity-70"}`}>
            <span className="inline-flex text-white/35">
                <GripVertical size={15} className="cursor-grab active:cursor-grabbing" />
            </span>

            <button
                type="button"
                onClick={onEdit}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.05]"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10"
                        style={{ color: tag.color ?? "#CBD5E1", backgroundColor: `${tag.color ?? "#64748B"}22` }}
                    >
                        <Tag size={15} />
                    </span>
                    <span className="truncate font-medium text-white">{tag.name}</span>
                </div>
                {!tag.isActive && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">Inativo</span>}
            </button>
        </div>
    );
}
