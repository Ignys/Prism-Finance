import { FolderTree, Info, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, type Category, useFinanceActions, useFinanceCategories } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { isInvoicePaymentCategoryId } from "../../context/finance/helpers";
import { normalizeCategoryIconName } from "../../lib/categoryIcons";
import { CategoryIconPicker } from "../common/CategoryIconPicker";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { ModalStructure } from "./ModalStructure";
import { ModalBody, ModalCancelButton, ModalFooter, ModalFooterAction, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { CategoryOptionContent } from "../transactions/TransactionFormParts";

const NO_PARENT_OPTION_ID = "__no-parent__";

interface ParentOption extends ComboboxOptionBase {
    category: Category | null;
}

function ParentOptionContent({ option }: { option: ParentOption }) {
    if (option.category) {
        return <CategoryOptionContent option={{ label: option.label, category: option.category, level: 0 }} />;
    }

    return (
        <div className="flex items-center gap-2">
            <TransactionFieldIcon icon={FolderTree} />
            <span className="truncate text-white/70">{option.label}</span>
        </div>
    );
}

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
    const { addCategory, permanentlyDeleteCategory, setCategoryActive } = useFinanceActions();
    const { closeModal, openModal } = useModal();
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
        return categories.filter((item) => item.type === type && !blockedParentIds.has(item.id) && !isInvoicePaymentCategoryId(item.id) && (item.isActive || item.id === currentParentId));
    }, [blockedParentIds, categories, editingCategory?.parentId, parentId, type]);
    const parentOptions = useMemo<ParentOption[]>(
        () => [
            { id: NO_PARENT_OPTION_ID, label: "Sem categoria maior", searchText: "sem categoria maior nenhuma", category: null },
            ...availableParents.map((category) => ({ id: category.id, label: category.name, searchText: category.name, category })),
        ],
        [availableParents],
    );

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

    const openPermanentDeleteModal = () => {
        if (!editingCategory || editingCategory.isActive || isInvoicePaymentCategory) {
            return;
        }

        openModal(
            <ConfirmActionModal
                title="Excluir categoria permanentemente?"
                description={`A categoria "${editingCategory.name}" será removida permanentemente.`}
                consequences={["A categoria e todas as subcategorias dela serão removidas em definitivo.", "Transações relacionadas passarão automaticamente para categoria padrão."]}
                confirmLabel="Excluir"
                onConfirm={() => permanentlyDeleteCategory(editingCategory.id)}
            />,
        );
    };

    return (
        <ModalStructure height="auto" width="620px">
            <ModalPanel>
                <ModalHeader title={isEditMode ? "Editando categoria" : "Nova categoria"} disabled={submitting} />

                <ModalBody className="flex flex-col gap-2">
                    {mode === "edit" && !editingCategory && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Categoria não encontrada.</p>}

                    {isInvoicePaymentCategory && (
                        <div className="flex items-start gap-2 rounded-xl border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-200">
                            <Info size={15} className="mt-0.5 shrink-0" />
                            <p>Essa categoria é nativa para os pagamentos de fatura. Você pode editar apenas nome, cor e ícone.</p>
                        </div>
                    )}

                    <div className="flex gap-1 rounded-xl border border-white/[0.1] bg-black/35 p-1" role="radiogroup" aria-label="Tipo">
                        {CATEGORY_TYPES.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                role="radio"
                                aria-checked={type === item.value}
                                onClick={() => setType(item.value)}
                                disabled={isInvoicePaymentCategory}
                                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    type === item.value ? (item.value === "income" ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/15 text-red-200") : "text-white/65 hover:bg-white/[0.06]"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                        <input aria-label="Cor da categoria" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/[0.12] bg-transparent p-0.5" />
                        <input aria-label="Nome da categoria" type="text" value={name} onChange={(event) => setName(event.target.value)} className={FIELD_EMBEDDED_INPUT_CLASS} placeholder="Nome da categoria" />
                    </label>

                    <SingleSelectCombobox
                        hideLabel
                        label="Categoria maior"
                        value={parentId || NO_PARENT_OPTION_ID}
                        placeholder="Sem categoria maior"
                        emptyMessage="Nenhuma categoria encontrada."
                        options={parentOptions}
                        onChange={(value) => setParentId(value === NO_PARENT_OPTION_ID ? "" : value)}
                        renderOptionContent={(option) => <ParentOptionContent option={option} />}
                        disabled={isInvoicePaymentCategory}
                    />

                    <CategoryIconPicker value={icon} categoryType={type} onChange={setIcon} color={color} />
                </ModalBody>

                <ModalFooter
                    start={
                        isEditMode && editingCategory && !isInvoicePaymentCategory ? (
                            <>
                                <ModalFooterAction onClick={() => void handleToggleActive()} disabled={submitting}>
                                    {editingCategory.isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                                    {editingCategory.isActive ? "Arquivar" : "Reativar"}
                                </ModalFooterAction>
                                {!editingCategory.isActive ? (
                                    <ModalFooterAction tone="danger" onClick={openPermanentDeleteModal} disabled={submitting}>
                                        <Trash2 size={15} /> Excluir
                                    </ModalFooterAction>
                                ) : null}
                            </>
                        ) : null
                    }
                >
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton onClick={() => void handleSubmit()} disabled={!normalizedName || !normalizedIcon || (mode === "edit" && !editingCategory) || submitting}>
                        {submitting ? "Salvando..." : "Salvar"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}
