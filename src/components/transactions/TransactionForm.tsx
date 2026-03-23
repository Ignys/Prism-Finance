import { useEffect, useMemo, useState } from "react";
import { CircleX, Copy, SlidersHorizontal, SquareSlash, Trash2, X } from "lucide-react";
import type { Beneficiary, Category, Tag, Transaction, TransactionType, Wallet } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { DateField } from "./DateField";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { BeneficiaryOptionContent, CategoryOptionContent, StatusField, TagOptionContent, TransactionHeader, WalletOptionContent } from "./TransactionFormParts";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { useTransactionForm } from "./useTransactionForm";

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

interface CategoryOption extends ComboboxOptionBase {
    category: Category;
    level: 0 | 1;
    rootCategoryId: string;
    categoryId: string;
}

interface BeneficiaryOption extends ComboboxOptionBase {
    beneficiary: Beneficiary;
}

interface TagOption extends ComboboxOptionBase {
    tag: Tag;
}

export interface TransactionFormPrefill {
    initialDate?: string;
}

interface TransactionFormProps {
    type?: TransactionType;
    transaction?: Transaction | null;
    mode?: "default" | "invoice_payment_edit";
    prefill?: TransactionFormPrefill;
    onAdvancedOpenChange?: (isOpen: boolean) => void;
}

export function TransactionForm({ type, transaction, mode = "default", prefill, onAdvancedOpenChange }: TransactionFormProps) {
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [shouldRenderAdvanced, setShouldRenderAdvanced] = useState(false);
    const form = useTransactionForm({ type, transaction, mode, prefill });

    const walletOptions = useMemo<WalletOption[]>(
        () =>
            form.wallets.map((wallet) => ({
                id: wallet.id,
                label: wallet.name,
                searchText: wallet.name,
                wallet,
            })),
        [form.wallets],
    );

    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const subCategoriesByRoot = new Map<string, Category[]>();

        for (const category of form.availableCategories) {
            if (!category.parentId) {
                continue;
            }
            const rootCategories = subCategoriesByRoot.get(category.parentId) ?? [];
            rootCategories.push(category);
            subCategoriesByRoot.set(category.parentId, rootCategories);
        }

        return form.rootCategories.flatMap((rootCategory) => {
            const rootOption: CategoryOption = {
                id: `root:${rootCategory.id}`,
                label: rootCategory.name,
                searchText: rootCategory.name,
                category: rootCategory,
                level: 0,
                rootCategoryId: rootCategory.id,
                categoryId: rootCategory.id,
            };

            const subCategoryOptions = (subCategoriesByRoot.get(rootCategory.id) ?? []).map((subCategory) => ({
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
    }, [form.availableCategories, form.rootCategories]);

    const selectedCategoryOptionId = form.subCategoryId ? `sub:${form.subCategoryId}` : form.rootCategoryId ? `root:${form.rootCategoryId}` : "";

    const beneficiaryOptions = useMemo<BeneficiaryOption[]>(
        () =>
            form.beneficiaries
                .filter((beneficiary) => beneficiary.isActive || beneficiary.id === form.beneficiaryId)
                .map((beneficiary) => ({
                    id: beneficiary.id,
                    label: beneficiary.name,
                    searchText: beneficiary.name,
                    beneficiary,
                })),
        [form.beneficiaries, form.beneficiaryId],
    );
    const tagOptions = useMemo<TagOption[]>(
        () =>
            form.tags.map((tag) => ({
                id: tag.id,
                label: tag.name,
                searchText: tag.name,
                tag,
            })),
        [form.tags],
    );

    const handleCategorySelect = (optionId: string) => {
        const selectedOption = categoryOptions.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }

        form.setRootCategoryId(selectedOption.rootCategoryId);
        form.setSubCategoryId(optionId.startsWith("sub:") ? selectedOption.categoryId : "");
    };

    useEffect(() => {
        onAdvancedOpenChange?.(advancedOpen);
    }, [advancedOpen, onAdvancedOpenChange]);

    useEffect(() => {
        if (advancedOpen) {
            setShouldRenderAdvanced(true);
            return;
        }

        const timeoutId = window.setTimeout(() => setShouldRenderAdvanced(false), 220);
        return () => window.clearTimeout(timeoutId);
    }, [advancedOpen]);

    const showAdvancedPanel = advancedOpen || shouldRenderAdvanced;

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
        } catch (error) {
            console.error("Failed to submit transaction form:", error);
        }

        setSubmitting(false);
    };

    return (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-3">
                <TransactionHeader type={form.resolvedType} isEditing={form.isEditing} />
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen((current) => !current)}
                        disabled={submitting}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] transition-colors ${
                            advancedOpen ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100" : "border-white/[0.14] bg-white/[0.03] text-white/70 hover:border-white/[0.22] hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        <SlidersHorizontal size={14} />
                        {advancedOpen ? "Ocultar avancadas" : "Opcoes avancadas"}
                    </button>
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
            </div>

            <div className={`mt-4 grid gap-4 ${showAdvancedPanel ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Valor</span>
                        <input
                            className={FIELD_INPUT_CLASS}
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={form.amountInput}
                            onChange={(event) => form.setAmountInput(event.target.value)}
                            disabled={form.isInvoicePaymentEdit}
                        />
                    </label>

                    <StatusField status={form.status} onChange={form.setStatus} disabled={form.isInvoicePaymentEdit} />

                    <DateField value={form.date} onChange={form.setDate} onOffset={form.setDateOffset} />

                    {form.isInvoicePaymentEdit ? (
                        <div className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>Categoria</span>
                            <div className={`${FIELD_INPUT_CLASS} text-white/75`}>{transaction?.category.label ?? "Sem categoria"}</div>
                        </div>
                    ) : (
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
                    )}

                    {form.isInvoicePaymentEdit ? (
                        <div className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>Carteira</span>
                            <div className={FIELD_INPUT_CLASS}>
                                {walletOptions.find((option) => option.id === form.walletId) ? (
                                    <WalletOptionContent option={walletOptions.find((option) => option.id === form.walletId)!} />
                                ) : (
                                    <span className="text-white/45">Carteira removida</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <SingleSelectCombobox
                            label="Carteira"
                            value={form.walletId}
                            placeholder="Selecione uma carteira"
                            emptyMessage="Nenhuma carteira encontrada."
                            options={walletOptions}
                            onChange={form.setWalletId}
                            renderOptionContent={(option) => <WalletOptionContent option={option} />}
                            labelClassName={FIELD_LABEL_CLASS}
                        />
                    )}

                    <SingleSelectCombobox
                        label="Beneficiario"
                        value={form.beneficiaryId}
                        placeholder="Selecione um beneficiario"
                        emptyMessage="Nenhum beneficiario encontrado."
                        options={beneficiaryOptions}
                        onChange={form.setBeneficiaryId}
                        renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />}
                        labelClassName={FIELD_LABEL_CLASS}
                    />

                    <label className="flex flex-col gap-1.5 md:col-span-2">
                        <span className={FIELD_LABEL_CLASS}>Descricao</span>
                        <input className={FIELD_INPUT_CLASS} placeholder="Descricao da transacao" value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
                    </label>
                </section>

                {showAdvancedPanel && (
                    <aside
                        className={`h-fit overflow-hidden rounded-2xl bg-black/25 transition-all duration-200 ease-out ${
                            advancedOpen
                                ? "max-h-[420px] translate-y-0 border border-white/[0.09] p-3 opacity-100"
                                : "pointer-events-none max-h-0 -translate-y-1 border border-transparent p-0 opacity-0"
                        }`}
                        aria-hidden={!advancedOpen}
                    >
                        <div className="space-y-3">
                            <label className="flex flex-col gap-1.5">
                                <span className={FIELD_LABEL_CLASS}>Modo</span>
                                <select
                                    className={FIELD_INPUT_CLASS}
                                    value={form.transactionMode === "recurring" ? "recurring" : "single"}
                                    onChange={(event) => form.setTransactionMode(event.target.value === "recurring" ? "recurring" : "single")}
                                    disabled={form.isInvoicePaymentEdit || form.isTransfer}
                                >
                                    <option value="single">Unica</option>
                                    <option value="recurring">Recorrente fixa</option>
                                </select>
                            </label>

                            {form.isEditing && form.isSeriesTransaction && !form.isInvoicePaymentEdit && (
                                <label className="flex flex-col gap-1.5">
                                    <span className={FIELD_LABEL_CLASS}>Escopo</span>
                                    <select
                                        className={FIELD_INPUT_CLASS}
                                        value={form.editScope}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            if (value === "all" || value === "this_and_next") {
                                                form.setEditScope(value);
                                            } else {
                                                form.setEditScope("single");
                                            }
                                        }}
                                    >
                                        <option value="single">So esta ocorrencia</option>
                                        <option value="this_and_next">Esta e proximas</option>
                                        <option value="all">Toda a serie</option>
                                    </select>
                                </label>
                            )}

                            <MultiSelectCombobox
                                label="Tags"
                                values={form.selectedTagIds}
                                placeholder="Selecione tags"
                                emptyMessage="Nenhuma tag cadastrada."
                                options={tagOptions}
                                onChange={form.setSelectedTagIds}
                                renderOptionContent={(option) => <TagOptionContent option={option} />}
                                labelClassName={FIELD_LABEL_CLASS}
                            />
                        </div>
                    </aside>
                )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex gap-1">
                    {form.isEditing && !form.isInvoicePaymentEdit && (
                        <>
                            <button
                                type="button"
                                onClick={() => void runAction(form.remove)}
                                disabled={submitting}
                                className="inline-flex p-2 gap-1.5 text-xs uppercase items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2 size={15} /> Excluir
                            </button>
                            <button
                                type="button"
                                onClick={() => void runAction(form.duplicate)}
                                disabled={submitting}
                                className="inline-flex p-2 gap-1.5 text-xs uppercase items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Copy size={15} /> Duplicar
                            </button>
                            <button
                                type="button"
                                onClick={() => void runAction(form.ignore)}
                                disabled={submitting}
                                className="inline-flex p-2 gap-1.5 text-xs uppercase items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <SquareSlash size={15} /> Ignorar
                            </button>
                            <button
                                type="button"
                                onClick={() => void runAction(form.cancelTransaction)}
                                disabled={submitting}
                                className="inline-flex p-2 gap-1.5 text-xs uppercase items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <CircleX size={15} /> Cancelar transacao
                            </button>
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
                        onClick={() => void runAction(form.submit)}
                        disabled={submitting}
                        className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "Processando..." : "Concluir"}
                    </button>
                </div>
            </div>
        </div>
    );
}
