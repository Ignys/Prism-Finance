import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Tag, useFinanceActions, useFinanceTags } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ModalStructure } from "./ModalStructure";

interface AddTagProps {
    mode?: "create" | "edit";
    tagId?: string;
    initialTag?: Tag;
}

export function AddTag({ mode = "create", tagId, initialTag }: AddTagProps) {
    const { addTag } = useFinanceActions();
    const tags = useFinanceTags();
    const { closeModal } = useModal();

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
        if (!editingTag) {
            return;
        }
        setName(editingTag.name);
        setColor(editingTag.color ?? "#64748B");
    }, [editingTag]);

    const normalizedName = name.trim().slice(0, 50);
    const isEditMode = mode === "edit" && Boolean(editingTag);

    const handleSubmit = async () => {
        if (!normalizedName) {
            return;
        }

        const targetTag = editingTag;
        await addTag({
            id: targetTag?.id ?? uuidv4(),
            userId: targetTag?.userId ?? null,
            name: normalizedName,
            color: color.trim() || null,
            createdAt: targetTag?.createdAt ?? new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="460px">
            <div className="rounded-lg bg-neutral-800 p-6">
                <h2 className="mb-5 text-2xl font-semibold">{isEditMode ? "Editar tag" : "Nova tag"}</h2>
                <div className="flex flex-col gap-4">
                    {mode === "edit" && !editingTag && <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Tag nao encontrada.</p>}

                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5"
                        placeholder="Nome da tag"
                        maxLength={50}
                    />
                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded border border-neutral-600 bg-neutral-700 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5" placeholder="#64748B" />
                    </div>
                    <button type="button" onClick={handleSubmit} disabled={mode === "edit" && !editingTag} className="default-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">
                        {isEditMode ? "Salvar alteracoes" : "Criar tag"}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
