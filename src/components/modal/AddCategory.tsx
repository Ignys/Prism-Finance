import { Info, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, type Category, useFinanceActions, useFinanceCategories } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { isInvoicePaymentCategoryId } from "../../context/finance/helpers";
import { normalizeCategoryIconName } from "../../lib/categoryIcons";
import { CategoryIconPicker } from "../common/CategoryIconPicker";
import { ModalStructure } from "./ModalStructure";

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

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
    const { addCategory, setCategoryActive } = useFinanceActions();
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);

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
        if (editingCategory) {
            setName(editingCategory.name);
            setType(editingCategory.type);
            setParentId(editingCategory.parentId ?? "");
            setIcon(normalizeCategoryIconName(editingCategory.icon, editingCategory.type));
            setColor(editingCategory.color ?? "#6B7280");
            return;
        }

        setName("");
        setType("expense");
        setParentId("");
        setIcon(normalizeCategoryIconName(null, "expense"));
        setColor("#6B7280");
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
        const currentParentId = editingCategory?.parentId ?? parentId;
        return categories.filter(
            (item) =>
                item.type === type &&
                !blockedParentIds.has(item.id) &&
                !isInvoicePaymentCategoryId(item.id) &&
                (item.isActive || item.id === currentParentId),
        );
    }, [blockedParentIds, categories, editingCategory?.parentId, parentId, type]);

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
    const isInvoicePaymentCategory = editingCategory?.id === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID;

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
            console.error("Failed to submit category modal:", error);
            setSubmitting(false);
        }
    };

    const handleSubmit = () =>
        runAction(async () => {
            if (!normalizedName || !normalizedIcon) {
                return false;
            }

            const target = editingCategory;
            const selectedParent = !isInvoicePaymentCategory && parentId ? categories.find((item) => item.id === parentId) : null;

            await addCategory({
                id: target?.id ?? uuidv4(),
                userId: target?.userId ?? null,
                parentId: isInvoicePaymentCategory ? null : (selectedParent?.id ?? null),
                name: normalizedName,
                type: isInvoicePaymentCategory ? "expense" : (selectedParent?.type ?? type),
                icon: normalizeCategoryIconName(normalizedIcon, isInvoicePaymentCategory ? "expense" : type),
                color: color.trim() || null,
                isActive: target?.isActive ?? true,
                isSystem: false,
                sortOrder: target?.sortOrder ?? 0,
                createdAt: target?.createdAt ?? new Date().toISOString(),
            });
            return true;
        });

    const handleToggleActive = () =>
        runAction(async () => {
            if (!editingCategory) {
                return false;
            }

            await setCategoryActive(editingCategory.id, !editingCategory.isActive);
            return true;
        });

    return (
        <ModalStructure height="auto" width="620px">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-medium">{isEditMode ? "Editar categoria" : "Nova categoria"}</h2>
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

                <section className="mt-2 grid grid-cols-1 gap-3">
                    {mode === "edit" && !editingCategory && <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Categoria nao encontrada.</p>}

                    {isInvoicePaymentCategory && (
                        <p className="flex items-center gap-2 rounded-md border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-[12px] text-blue-200">
                            <Info size={16} /> Essa categoria e reservada para pagamentos de fatura. Voce pode editar apenas nome, cor e icone.
                        </p>
                    )}

                    <div className="flex justify-between gap-2">
                        <label className="flex flex-col gap-1.5 w-1/2">
                            <span className={FIELD_LABEL_CLASS}>Nome</span>
                            <input type="text" value={name} onChange={(event) => setName(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Nome da categoria" />
                        </label>

                        <label className="flex flex-col gap-1.5 w-1/2">
                            <span className={FIELD_LABEL_CLASS}>Tipo</span>
                            <select
                                value={type}
                                onChange={(event) => setType(event.target.value as (typeof CATEGORY_TYPES)[number]["value"])}
                                disabled={isInvoicePaymentCategory}
                                className={`${FIELD_INPUT_CLASS} pb-3.5 disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                                {CATEGORY_TYPES.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Categoria maior</span>
                        <select
                            value={parentId}
                            onChange={(event) => setParentId(event.target.value)}
                            disabled={isInvoicePaymentCategory}
                            className={`${FIELD_INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            <option value="">Sem categoria maior</option>
                            {availableParents.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <CategoryIconPicker value={icon} categoryType={type} onChange={setIcon} />

                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded border border-white/[0.12] bg-black/35 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="#6B7280" />
                    </div>
                </section>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingCategory && !isInvoicePaymentCategory && (
                            <button
                                type="button"
                                onClick={() => void handleToggleActive()}
                                disabled={submitting}
                                className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    editingCategory.isActive
                                        ? "border-red-400/25 bg-red-500/10 text-red-200 hover:border-red-400/45 hover:text-red-100"
                                        : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"
                                }`}
                            >
                                {editingCategory.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                {editingCategory.isActive ? "Remover" : "Reativar"}
                            </button>
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
                            disabled={!normalizedName || !normalizedIcon || (mode === "edit" && !editingCategory) || submitting}
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
