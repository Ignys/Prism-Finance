import { Flag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Category, WishItem, WishItemPriority } from "../../context/FinanceContext";
import { SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, useFinanceActions, useFinanceCategories, useFinanceWishItems } from "../../context/FinanceContext";
import { DEFAULT_EXPENSE_CATEGORY_ID } from "../../context/finance/constants";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { WISH_ITEM_PRIORITY_OPTIONS } from "../../lib/wishlistPriority";
import { CategoryOptionContent } from "../transactions/TransactionFormParts";
import { FIELD_LABEL_CLASS } from "../transactions/transactionForm.constants";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { ModalStructure } from "./ModalStructure";

const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

interface CategoryOption extends ComboboxOptionBase {
    category: Category;
    level: 0 | 1;
    rootCategoryId: string;
    categoryId: string;
}

interface AddWishItemProps {
    mode?: "create" | "edit";
    wishItemId?: string;
    initialWishItem?: WishItem;
}

function normalizeUrl(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    return `https://${trimmed}`;
}

export function AddWishItem({ mode = "create", wishItemId, initialWishItem }: AddWishItemProps) {
    const categories = useFinanceCategories();
    const wishItems = useFinanceWishItems();
    const { addWishItem, removeWishItem } = useFinanceActions();
    const { closeModal } = useModal();
    const [amountDigits, setAmountDigits] = useState("");
    const [categoryId, setCategoryId] = useState(DEFAULT_EXPENSE_CATEGORY_ID);
    const [priority, setPriority] = useState<WishItemPriority>(2);
    const [description, setDescription] = useState("");
    const [link, setLink] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const editingWishItem = useMemo(() => {
        if (mode !== "edit") {
            return null;
        }
        if (initialWishItem) {
            return initialWishItem;
        }
        if (!wishItemId) {
            return null;
        }
        return wishItems.find((item) => item.id === wishItemId) ?? null;
    }, [initialWishItem, mode, wishItemId, wishItems]);

    const availableCategories = useMemo(
        () => categories.filter((category) => category.type === "expense" && category.id !== SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && category.isActive),
        [categories],
    );

    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const subCategoriesByRoot = new Map<string, Category[]>();

        for (const category of availableCategories) {
            if (!category.parentId) {
                continue;
            }

            const rootCategories = subCategoriesByRoot.get(category.parentId) ?? [];
            rootCategories.push(category);
            subCategoriesByRoot.set(category.parentId, rootCategories);
        }

        return availableCategories
            .filter((category) => !category.parentId)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .flatMap((rootCategory) => {
                const rootOption: CategoryOption = {
                    id: `root:${rootCategory.id}`,
                    label: rootCategory.name,
                    searchText: rootCategory.name,
                    category: rootCategory,
                    level: 0,
                    rootCategoryId: rootCategory.id,
                    categoryId: rootCategory.id,
                };

                const subCategoryOptions = (subCategoriesByRoot.get(rootCategory.id) ?? [])
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((subCategory) => ({
                        id: `sub:${subCategory.id}`,
                        label: subCategory.name,
                        searchText: `${subCategory.name} ${rootCategory.name}`,
                        category: subCategory,
                        level: 1 as const,
                        rootCategoryId: rootCategory.id,
                        categoryId: subCategory.id,
                    }));

                return [rootOption, ...subCategoryOptions];
            });
    }, [availableCategories]);

    const selectedCategoryOptionId = useMemo(() => {
        if (!categoryId) {
            return "";
        }

        const selectedOption = categoryOptions.find((option) => option.categoryId === categoryId);
        return selectedOption?.id ?? "";
    }, [categoryId, categoryOptions]);

    const amountValue = parseCurrencyDigitsToNumber(amountDigits);
    const normalizedDescription = description.trim();
    const normalizedLink = normalizeUrl(link);
    const normalizedImageUrl = normalizeUrl(imageUrl);
    const canSubmit = amountValue > 0 && normalizedDescription.length > 0 && categoryOptions.some((option) => option.categoryId === categoryId);
    const isEditMode = mode === "edit" && Boolean(editingWishItem);

    useEffect(() => {
        if (editingWishItem) {
            setAmountDigits(String(Math.round(editingWishItem.value * 100)));
            setCategoryId(editingWishItem.categoryId);
            setPriority(editingWishItem.priority);
            setDescription(editingWishItem.description);
            setLink(editingWishItem.link ?? "");
            setImageUrl(editingWishItem.imageUrl ?? "");
            return;
        }

        setAmountDigits("");
        setCategoryId(DEFAULT_EXPENSE_CATEGORY_ID);
        setPriority(2);
        setDescription("");
        setLink("");
        setImageUrl("");
    }, [editingWishItem]);

    const handleCategorySelect = (optionId: string) => {
        const selectedOption = categoryOptions.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }

        setCategoryId(selectedOption.categoryId);
    };

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
            console.error("Failed to submit wish item modal:", error);
            setSubmitting(false);
        }
    };

    const handleSubmit = () =>
        runAction(async () => {
            const targetWishItem = editingWishItem;
            if ((mode === "edit" && !targetWishItem) || !canSubmit) {
                return false;
            }

            await addWishItem({
                id: targetWishItem?.id ?? uuidv4(),
                userId: targetWishItem?.userId ?? null,
                value: amountValue,
                categoryId,
                priority,
                description: normalizedDescription,
                link: normalizedLink,
                imageUrl: normalizedImageUrl,
                isActive: targetWishItem?.isActive ?? true,
                createdAt: targetWishItem?.createdAt ?? new Date().toISOString(),
            });

            return true;
        });

    const handleRemove = () =>
        runAction(async () => {
            if (!editingWishItem) {
                return false;
            }

            await removeWishItem(editingWishItem.id);
            return true;
        });

    return (
        <ModalStructure height="auto" width="620px">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <header className="flex items-center justify-between gap-3">
                    <h1 className="ml-1 text-sm uppercase opacity-50">{isEditMode ? "EDITAR ITEM DA LISTA DE DESEJOS" : "NOVO ITEM NA LISTA DE DESEJOS"}</h1>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>

                <section className="mt-4 grid grid-cols-1 gap-3">
                    {mode === "edit" && !editingWishItem ? <p className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Item nao encontrado.</p> : null}

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Valor</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrencyFromDigits(amountDigits)}
                            onChange={(event) => setAmountDigits(extractCurrencyDigits(event.target.value))}
                            className={FIELD_INPUT_CLASS}
                            placeholder="R$ 0,00"
                        />
                    </label>

                    <SingleSelectCombobox
                        label="Categoria"
                        value={selectedCategoryOptionId}
                        placeholder="Selecione uma categoria"
                        emptyMessage="Nenhuma categoria disponivel."
                        options={categoryOptions}
                        onChange={handleCategorySelect}
                        renderOptionContent={(option) => <CategoryOptionContent option={option} />}
                        labelClassName={FIELD_LABEL_CLASS}
                    />

                    <div className="flex flex-col gap-2">
                        <span className={FIELD_LABEL_CLASS}>Prioridade</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {WISH_ITEM_PRIORITY_OPTIONS.map((option) => {
                                const isSelected = priority === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setPriority(option.value)}
                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                            isSelected ? "bg-white/[0.06] text-white" : "border-white/[0.1] bg-black/25 text-white/70 hover:border-white/[0.2] hover:text-white"
                                        }`}
                                        style={{
                                            borderColor: isSelected ? `${option.color}66` : undefined,
                                            boxShadow: isSelected ? `inset 0 0 0 1px ${option.color}33` : undefined,
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                                                style={{
                                                    color: option.color,
                                                    borderColor: `${option.color}44`,
                                                    backgroundColor: `${option.color}14`,
                                                }}
                                            >
                                                <Flag size={15} />
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium">{option.label}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Descricao</span>
                        <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="Ex.: Kindle, tenis novo, fone" />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Link</span>
                        <input type="text" value={link} onChange={(event) => setLink(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="https://..." />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Link da imagem</span>
                        <input type="text" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className={FIELD_INPUT_CLASS} placeholder="https://imagem-do-produto..." />
                    </label>
                </section>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isEditMode && editingWishItem ? (
                            <button
                                type="button"
                                onClick={() => void handleRemove()}
                                disabled={submitting}
                                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2 size={15} />
                                Remover
                            </button>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2">
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
                            disabled={(mode === "edit" && !editingWishItem) || !canSubmit || submitting}
                            className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Salvando..." : "Concluir"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
