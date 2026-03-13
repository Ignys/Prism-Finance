import { Reorder } from "framer-motion";
import { Eye, EyeOff, GripVertical, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Tag as FinanceTag, useFinanceActions, useFinanceTags } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddTag } from "../../modal/AddTag";

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
        <section className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Tag size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Tags ({visibleCount})</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowInactive((current) => !current)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.08em] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white"
                    >
                        {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
                    </button>
                    <button
                        type="button"
                        onClick={() => openModal(<AddTag mode="create" />)}
                        className="cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-sm uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]"
                    >
                        Criar tag
                    </button>
                </div>
            </div>

            {orderedTags.length < 1 ? (
                <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhuma tag para os filtros atuais.</div>
            ) : (
                <Reorder.Group axis="y" values={orderedTags} onReorder={setOrderedTags} className="space-y-2">
                    {orderedTags.map((tag) => (
                        <Reorder.Item key={tag.id} value={tag} onDragEnd={commitOrder} className="list-none">
                            <TagCard tag={tag} onEdit={() => openModal(<AddTag mode="edit" tagId={tag.id} />)} />
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}
        </section>
    );
}

function TagCard({ tag, onEdit }: { tag: FinanceTag; onEdit: () => void }) {
    return (
        <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${tag.isActive ? "border-white/10 bg-black/20" : "border-white/10 bg-white/[0.02] opacity-70"}`}>
            <span className="inline-flex text-white/35">
                <GripVertical size={15} className="cursor-grab active:cursor-grabbing" />
            </span>

            <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
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
