import { Tag } from "lucide-react";
import { useFinanceTags } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddTag } from "../../modal/AddTag";

export function RegistryTagsSection() {
    const tags = useFinanceTags();
    const { openModal } = useModal();

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Tag size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Tags ({tags.length})</p>
                </div>
                <button onClick={() => openModal(<AddTag mode="create" />)} className="cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-sm uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]">
                    Criar tag
                </button>
            </div>

            <div className="flex min-h-[72px] flex-wrap gap-2 rounded-lg border border-white/6 bg-white/[0.02] p-3">
                {tags.length === 0 && <p className="text-sm text-white/45">Nenhuma tag cadastrada.</p>}
                {tags.map((tag) => (
                    <button
                        type="button"
                        key={tag.id}
                        onClick={() => openModal(<AddTag mode="edit" tagId={tag.id} />)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-sm transition-colors hover:border-white/35"
                        style={{ backgroundColor: `${tag.color ?? "#64748B"}33`, color: tag.color ?? "#CBD5E1" }}
                    >
                        {tag.name}
                    </button>
                ))}
            </div>
        </section>
    );
}
