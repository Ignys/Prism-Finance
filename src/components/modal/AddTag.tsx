import { RotateCcw, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Tag as FinanceTag, useFinanceActions, useFinanceTags } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { ModalBody, ModalCancelButton, ModalFooter, ModalFooterAction, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";
import { ModalStructure } from "./ModalStructure";


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
            <ModalPanel>
                <ModalHeader title={isEditMode ? "Editando tag" : "Nova tag"} disabled={submitting} />

                <ModalBody className="flex flex-col gap-3">
                    {mode === "edit" && !editingTag && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Tag não encontrada.</p>}

                    <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <span
                            aria-hidden="true"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.12]"
                            style={{ color: color || "#CBD5E1", backgroundColor: `${color || "#64748B"}22` }}
                        >
                            <Tag size={14} />
                        </span>
                        <input
                            aria-label="Nome da tag"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={FIELD_EMBEDDED_INPUT_CLASS}
                            placeholder="Nome da tag"
                            maxLength={50}
                        />
                    </label>

                    <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <input aria-label="Cor" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/[0.12] bg-transparent p-0.5" />
                        <input aria-label="Código da cor" type="text" value={color} onChange={(event) => setColor(event.target.value)} className={FIELD_EMBEDDED_INPUT_CLASS} placeholder="#64748B" />
                    </label>
                </ModalBody>

                <ModalFooter
                    start={
                        isEditMode && editingTag ? (
                            <>
                                <ModalFooterAction onClick={() => void handleToggleActive()} disabled={submitting}>
                                    {editingTag.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingTag.isActive ? "Arquivar" : "Reativar"}
                                </ModalFooterAction>
                                {!editingTag.isActive ? (
                                    <ModalFooterAction tone="danger" onClick={openPermanentDeleteModal} disabled={submitting}>
                                        <Trash2 size={15} /> Excluir em definitivo
                                    </ModalFooterAction>
                                ) : null}
                            </>
                        ) : null
                    }
                >
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton onClick={() => void handleSubmit()} disabled={(mode === "edit" && !editingTag) || !normalizedName || submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}
