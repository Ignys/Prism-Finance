import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CategoryIconPicker } from "../common/CategoryIconPicker";
import { type Category, useFinanceActions, useFinanceCategories } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { normalizeCategoryIconName } from "../../lib/categoryIcons";
import { ModalStructure } from "./ModalStructure";

const CATEGORY_TYPES = [
    { value: "expense", label: "Despesa" },
    { value: "income", label: "Receita" },
] as const;

interface AddCategoryProps {
    mode?: "create" | "edit";
    categoryId?: string;
    initialCategory?: Category;
}

function collectDescendantIds(categories: Category[], rootId: string): Set<string> {
    const descendants = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
        const parentId = queue.shift();
        if (!parentId) {
            continue;
        }
        categories.forEach((candidate) => {
            if (candidate.parentId === parentId && !descendants.has(candidate.id)) {
                descendants.add(candidate.id);
                queue.push(candidate.id);
            }
        });
    }

    return descendants;
}

export function AddCategory({ mode = "create", categoryId, initialCategory }: AddCategoryProps) {
    const categories = useFinanceCategories();
    const { addCategory } = useFinanceActions();
    const { closeModal } = useModal();

    const editingCategory = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialCategory) {
            return initialCategory;
        }
        if (!categoryId) {
            return null;
        }
        return categories.find((item) => item.id === categoryId) ?? null;
    }, [categories, categoryId, initialCategory, mode]);

    const [name, setName] = useState("");
    const [type, setType] = useState<(typeof CATEGORY_TYPES)[number]["value"]>("expense");
    const [parentId, setParentId] = useState<string>("");
    const [icon, setIcon] = useState<string>(normalizeCategoryIconName(null, "expense"));
    const [color, setColor] = useState("#6B7280");

    useEffect(() => {
        if (!editingCategory) {
            return;
        }
        setName(editingCategory.name);
        setType(editingCategory.type);
        setParentId(editingCategory.parentId ?? "");
        setIcon(normalizeCategoryIconName(editingCategory.icon, editingCategory.type));
        setColor(editingCategory.color ?? "#6B7280");
    }, [editingCategory]);

    const blockedParentIds = useMemo(() => {
        if (!editingCategory) {
            return new Set<string>();
        }
        const blocked = collectDescendantIds(categories, editingCategory.id);
        blocked.add(editingCategory.id);
        return blocked;
    }, [categories, editingCategory]);

    const availableParents = useMemo(() => {
        return categories.filter((item) => item.type === type && !blockedParentIds.has(item.id));
    }, [blockedParentIds, categories, type]);

    useEffect(() => {
        if (!parentId) {
            return;
        }
        if (!availableParents.some((item) => item.id === parentId)) {
            setParentId("");
        }
    }, [availableParents, parentId]);

    const normalizedName = name.trim();
    const normalizedIcon = normalizeCategoryIconName(icon, type);
    const isEditMode = mode === "edit" && Boolean(editingCategory);
    const lockTypeAndParent = isEditMode && Boolean(editingCategory?.isSystem);

    const handleSubmit = async () => {
        if (!normalizedName || !normalizedIcon) {
            return;
        }

        const target = editingCategory;
        const resolvedType = lockTypeAndParent && target ? target.type : type;
        const selectedParent = !lockTypeAndParent && parentId ? categories.find((item) => item.id === parentId) : null;
        const resolvedParentId = lockTypeAndParent && target ? target.parentId : selectedParent?.id ?? null;

        await addCategory({
            id: target?.id ?? uuidv4(),
            userId: target?.userId ?? null,
            parentId: resolvedParentId,
            name: normalizedName,
            type: selectedParent?.type ?? resolvedType,
            icon: normalizeCategoryIconName(normalizedIcon, resolvedType),
            color: color.trim() || null,
            isSystem: target?.isSystem ?? false,
            createdAt: target?.createdAt ?? new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="560px">
            <div className="rounded-lg bg-neutral-800 p-6">
                <h2 className="mb-5 text-2xl font-semibold">{isEditMode ? "Editar categoria" : "Nova categoria"}</h2>
                <div className="flex flex-col gap-4">
                    {mode === "edit" && !editingCategory && (
                        <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Categoria nao encontrada.</p>
                    )}

                    {lockTypeAndParent && (
                        <p className="rounded-md border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                            Categoria do sistema: tipo e categoria pai nao podem ser alterados.
                        </p>
                    )}

                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} className="rounded border border-neutral-600 bg-neutral-700 p-2.5" placeholder="Nome da categoria" />

                    <select
                        value={type}
                        onChange={(event) => setType(event.target.value as (typeof CATEGORY_TYPES)[number]["value"])}
                        disabled={lockTypeAndParent}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {CATEGORY_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={parentId}
                        onChange={(event) => setParentId(event.target.value)}
                        disabled={lockTypeAndParent}
                        className="rounded border border-neutral-600 bg-neutral-700 p-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="">Sem categoria pai</option>
                        {availableParents.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>

                    <CategoryIconPicker value={icon} categoryType={type} onChange={setIcon} />

                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded border border-neutral-600 bg-neutral-700 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className="flex-1 rounded border border-neutral-600 bg-neutral-700 p-2.5" placeholder="#6B7280" />
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!normalizedName || !normalizedIcon || (mode === "edit" && !editingCategory)}
                        className="default-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isEditMode ? "Salvar alteracoes" : "Criar categoria"}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
