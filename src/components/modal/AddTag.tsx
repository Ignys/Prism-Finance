import { RotateCcw, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Tag as FinanceTag, useFinanceActions, useFinanceTags } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { ModalStructure } from "./ModalStructure";

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

interface AddTagProps {
    mode?: "create" | "edit";
    tagId?: string;
    initialTag?: FinanceTag;
}

export function AddTag({ mode = "create", tagId, initialTag }: AddTagProps) {
    const { addTag, permanentlyDeleteTag, setTagActive } = useFinanceActions();
    const tags = useFinanceTags();
    const { closeModal, openModal } = useModal();
    const [submitting, setSubmitting] = useState(false);

    const editingTag = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialTag) {
            return initialTag;
        }
        if (!tagId) {
            return null;
        }
        return tags.find((item) => item.id === tagId) ?? null;
    }, [initialTag, mode, tagId, tags]);

    const [name, setName] = useState("");
    const [color, setColor] = useState("#64748B");

    useEffect(() => {
        if (editingTag) {
            setName(editingTag.name);
            setColor(editingTag.color ?? "#64748B");
            return;
        }
        setName("");
        setColor("#64748B");
    }, [editingTag]);

    const normalizedName = name.trim().slice(0, 50);
    const isEditMode = mode === "edit" && Boolean(editingTag);

    const runAction = async (action: () => Promise<boolean>) => {
        if (submitting) {
            return;
        }

        setSubmitting(true);
        try {
            const success = await action();
            if (success) {
                closeModal();
                return;
            }
            setSubmitting(false);
        } catch (error) {
            console.error("Failed to submit tag modal:", error);
            setSubmitting(false);
        }
    };

    const handleSubmit = () =>
        runAction(async () => {
            if (!normalizedName) {
                return false;
            }

            const targetTag = editingTag;
            await addTag({
                id: targetTag?.id ?? uuidv4(),
                userId: targetTag?.userId ?? null,
                name: normalizedName,
                color: color.trim() || null,
                isActive: targetTag?.isActive ?? true,
                sortOrder: targetTag?.sortOrder ?? 0,
                createdAt: targetTag?.createdAt ?? new Date().toISOString(),
            });
            return true;
        });

    const handleToggleActive = () =>
        runAction(async () => {
            if (!editingTag) {
                return false;
            }
            await setTagActive(editingTag.id, !editingTag.isActive);
            return true;
        });

    const openPermanentDeleteModal = () => {
        if (!editingTag || editingTag.isActive) {
            return;
        }

        openModal(
            <ConfirmActionModal
                title="Excluir tag em definitivo?"
                description={`A tag "${editingTag.name}" sera removida permanentemente.`}
                consequences={[
                    "A tag sera retirada das transacoes relacionadas.",
                    "A tag tambem sera removida das recorrencias futuras em que estiver salva.",
                ]}
                confirmLabel="Excluir em definitivo"
                onConfirm={() => permanentlyDeleteTag(editingTag.id)}
            />,
        );
    };

    return (
        <ModalStructure height="auto" width="520px">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-medium">{isEditMode ? "Editar tag" : "Nova tag"}</h2>
                        <p className="text-xs uppercase tracking-[0.12em] text-white/45">Cadastro de tags</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </div>

                <section className="mt-4 grid grid-cols-1 gap-3">
                    {mode === "edit" && !editingTag && <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Tag nao encontrada.</p>}

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Nome</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={FIELD_INPUT_CLASS}
                            placeholder="Nome da tag"
                            maxLength={50}
                        />
                    </label>

                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded border border-white/[0.12] bg-black/35 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="#64748B" />
                    </div>

                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3">
                        <p className={`${FIELD_LABEL_CLASS} mb-2`}>Preview</p>
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                            <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10"
                                style={{ color: color || "#CBD5E1", backgroundColor: `${color || "#64748B"}22` }}
                            >
                                <Tag size={15} />
                            </span>
                            <span className="font-medium text-white">{normalizedName || "Nome da tag"}</span>
                        </div>
                    </div>
                </section>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingTag && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => void handleToggleActive()}
                                    disabled={submitting}
                                    className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        editingTag.isActive
                                            ? "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:border-amber-400/45 hover:text-amber-50"
                                            : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                    }`}
                                >
                                    {editingTag.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingTag.isActive ? "Arquivar" : "Reativar"}
                                </button>

                                {!editingTag.isActive ? (
                                    <button
                                        type="button"
                                        onClick={openPermanentDeleteModal}
                                        disabled={submitting}
                                        className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Trash2 size={15} />
                                        Excluir em definitivo
                                    </button>
                                ) : null}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={(mode === "edit" && !editingTag) || !normalizedName || submitting}
                            className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Processando..." : "Concluir"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
