import { Reorder } from "framer-motion";
import { GripVertical } from "lucide-react";
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
                        <div className="py-4 text-sm text-white/45">Nenhuma tag para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <Reorder.Group axis="y" values={orderedTags} onReorder={setOrderedTags} className="divide-y divide-white/[0.06]">
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
    const color = tag.color ?? "#94A3B8";

    return (
        <div className={`group flex items-center gap-1 py-2 ${tag.isActive ? "" : "opacity-60"}`}>
            <span className="inline-flex cursor-grab text-white/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing" aria-hidden="true">
                <GripVertical size={15} />
            </span>

            <button
                type="button"
                onClick={onEdit}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-white/35"
            >
                <span
                    className="inline-flex min-w-0 items-center gap-0.5 rounded-full py-1 pl-2.5 pr-3 text-sm font-medium"
                    style={{ color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
                >
                    <span aria-hidden="true" className="opacity-80">#</span>
                    <span className="truncate text-white/90">{tag.name}</span>
                </span>
                {!tag.isActive && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativo</span>}
            </button>
        </div>
    );
}
