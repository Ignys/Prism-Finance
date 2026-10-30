import { useState } from "react";
import { AddTag } from "../../components/modal/AddTag";
import { useFinanceTags } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { MobileListToolbar } from "../MobileListToolbar";

export function MobileTagsSection() {
    const tags = useFinanceTags();
    const { openModal } = useModal();
    const [showInactive, setShowInactive] = useState(false);

    const visible = tags.filter((tag) => showInactive || tag.isActive);
    const activeCount = tags.filter((tag) => tag.isActive).length;

    return (
        <div className="space-y-5">
            <MobileListToolbar
                countLabel={activeCount === 1 ? "1 tag ativa" : `${activeCount} tags ativas`}
                toggleLabel={showInactive ? "Ocultar inativas" : "Mostrar inativas"}
                createLabel="Nova tag"
                onToggle={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddTag mode="create" />)}
            />

            {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">Nenhuma tag por aqui. Toque em Nova tag para criar uma.</p>
            ) : (
                // Tags read as chips, so they wrap like a tag cloud instead of a list.
                <div className="flex flex-wrap gap-2 px-1">
                    {visible.map((tag) => {
                        const color = tag.color ?? "#94A3B8";
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => openModal(<AddTag mode="edit" tagId={tag.id} />)}
                                className={`inline-flex max-w-full items-center gap-0.5 rounded-full py-2 pl-3 pr-3.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${tag.isActive ? "" : "opacity-50"}`}
                                style={{ color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
                            >
                                <span aria-hidden="true" className="opacity-80">
                                    #
                                </span>
                                <span className="truncate text-white/90">{tag.name}</span>
                                {!tag.isActive && <span className="sr-only"> (inativa)</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
