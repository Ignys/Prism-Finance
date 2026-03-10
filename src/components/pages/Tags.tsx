import { useFinanceTags } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AuthShell } from "../layout/AuthShell";
import { AddTag } from "../modal/AddTag";

export function TagsPage() {
    const tags = useFinanceTags();
    const { openModal } = useModal();

    return (
        <AuthShell>
            <div className="flex justify-center mt-5">
                <section className="w-8/12 space-y-2">
                    <div className="bg-neutral-900 rounded-lg p-4 flex items-center justify-between">
                        <p className="text-white/60">Tags cadastradas: {tags.length}</p>
                        <button onClick={() => openModal(<AddTag />)} className="default-button py-2 px-4">
                            Criar tag
                        </button>
                    </div>
                    <div className="bg-[#1e1e1e] rounded-lg p-4 flex flex-wrap gap-2">
                        {tags.length === 0 && <p className="text-white/50">Nenhuma tag cadastrada.</p>}
                        {tags.map((tag) => (
                            <span key={tag.id} className="px-3 py-1.5 rounded-full text-sm border border-white/10" style={{ backgroundColor: `${tag.color ?? "#64748B"}33`, color: tag.color ?? "#CBD5E1" }}>
                                {tag.name}
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
