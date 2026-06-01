import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleX, Copy, Layers3, ReceiptText, Repeat, SlidersHorizontal, SquareSlash, Trash2, X } from "lucide-react";
import type { Beneficiary, Category, Tag, Transaction, TransactionMode, TransactionSeriesScope, TransactionType, Wallet } from "../../context/FinanceContext";
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

interface TransactionModeOption extends ComboboxOptionBase {
    mode: TransactionMode;
    icon: typeof ReceiptText;
}

interface EditScopeOption extends ComboboxOptionBase {
    scope: TransactionSeriesScope;
    icon: typeof ReceiptText;
}

const TRANSACTION_MODE_OPTIONS: TransactionModeOption[] = [
    {
        id: "single",
        label: "Unica",
        searchText: "unica avulsa single",
        mode: "single",
        icon: ReceiptText,
    },
    {
        id: "recurring",
        label: "Fixa mensal",
        searchText: "fixa mensal recorrente recurring",
        mode: "recurring",
        icon: Repeat,
    },
];

const EDIT_SCOPE_OPTIONS: EditScopeOption[] = [
    {
        id: "single",
        label: "Apenas essa transacao",
        searchText: "apenas essa ocorrencia single",
        scope: "single",
        icon: ReceiptText,
    },
    {
        id: "this_and_next",
        label: "Essa e as proximas",
        searchText: "essa e as proximas this and next",
        scope: "this_and_next",
        icon: ArrowRight,
    },
    {
        id: "all",
        label: "Toda a serie",
        searchText: "toda a serie all",
        scope: "all",
        icon: Layers3,
    },
];

function TransactionModeOptionContent({ option }: { option: TransactionModeOption }) {
    const Icon = option.icon;

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80">
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function EditScopeOptionContent({ option }: { option: EditScopeOption }) {
    const Icon = option.icon;

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80">
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function EditScopeSelectedContent({ option }: { option: EditScopeOption }) {
    return <span className="truncate">{option.label}</span>;
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
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <div>
                <header className="flex items-center justify-between gap-3">
                    <TransactionHeader type={form.resolvedType} isEditing={form.isEditing} isSeriesTransaction={form.isSeriesTransaction} isInvoicePaymentEdit={form.isInvoicePaymentEdit} />
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

                <div className="mt-2 flex gap-3">
                    <section className="flex grow flex-col gap-3">
                        <label className="flex flex-col gap-1.5">
                            <input
                                className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24] disabled:cursor-not-allowed disabled:opacity-65"
                                inputMode="numeric"
                                placeholder="R$ 0,00"
                                value={form.amountInput}
                                onChange={(event) => form.setAmountInput(event.target.value)}
                                disabled={form.isInvoicePaymentEdit}
                            />
                        </label>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <StatusField status={form.status} onChange={form.setStatus} disabled={form.isInvoicePaymentEdit} />
                            <DateField value={form.date} onChange={form.setDate} onOffset={form.setDateOffset} />
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
                                label="Beneficiário"
                                value={form.beneficiaryId}
                                placeholder="Selecione um beneficiário"
                                emptyMessage="Nenhum beneficiário encontrado."
                                options={beneficiaryOptions}
                                onChange={form.setBeneficiaryId}
                                renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />}
                                labelClassName={FIELD_LABEL_CLASS}
                            />
                        </div>

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

                        <label className="flex flex-col gap-1.5">
                            <span className={FIELD_LABEL_CLASS}>Descrição</span>
                            <input className={FIELD_INPUT_CLASS} placeholder="Descrição da transação" value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
                        </label>
                    </section>

                    {advancedOpen && (
                        <>
                            <div className={`w-px rounded-full bg-white/5`} />

                            <aside className={`flex flex-col gap-3 w-[280px] `}>
                                {form.isEditing && form.isSeriesTransaction && !form.isInvoicePaymentEdit && (
                                    <SingleSelectCombobox
                                        disableSearch
                                        compactTrigger
                                        label="Editar"
                                        value={form.editScope}
                                        placeholder="Selecione um escopo"
                                        emptyMessage="Nenhum escopo encontrado."
                                        options={EDIT_SCOPE_OPTIONS}
                                        onChange={(value) => {
                                            if (value === "all" || value === "this_and_next" || value === "single") {
                                                form.setEditScope(value);
                                                return;
                                            }

                                            form.setEditScope("single");
                                        }}
                                        renderOptionContent={(option) => <EditScopeOptionContent option={option} />}
                                        renderSelectedContent={(option) => <EditScopeSelectedContent option={option} />}
                                        labelClassName={FIELD_LABEL_CLASS}
                                    />
                                )}

                                <MultiSelectCombobox
                                    label="Tags"
                                    values={form.selectedTagIds}
                                    placeholder="Nenhuma tag selecionada"
                                    emptyMessage="Nenhuma tag cadastrada."
                                    options={tagOptions}
                                    onChange={form.setSelectedTagIds}
                                    renderOptionContent={(option) => <TagOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                />

                                <SingleSelectCombobox
                                    disableSearch
                                    label="Tipo"
                                    value={form.transactionMode === "recurring" ? "recurring" : "single"}
                                    placeholder="Selecione um modo"
                                    emptyMessage="Nenhum modo encontrado."
                                    options={TRANSACTION_MODE_OPTIONS}
                                    onChange={(value) => {
                                        if (value === "recurring" || value === "single") {
                                            form.setTransactionMode(value);
                                            return;
                                        }

                                        form.setTransactionMode("single");
                                    }}
                                    renderOptionContent={(option) => <TransactionModeOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                    disabled={form.isInvoicePaymentEdit || form.isTransfer}
                                />
                            </aside>
                        </>
                    )}
                </div>
            </div>

            <footer className="mt-4 flex flex-col gap-3">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen((current) => !current)}
                        disabled={submitting}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-150 ${
                            advancedOpen ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100" : "border-white/[0.14] bg-white/[0.03] text-white/70 hover:border-white/[0.22] hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                        <SlidersHorizontal size={14} />
                        {advancedOpen ? "Esconder opcoes" : "Mais opcoes"}
                    </button>
                </div>

                <div className="flex items-end justify-between gap-1">
                    <div className="flex flex-wrap gap-1">
                        {form.isEditing && !form.isInvoicePaymentEdit && (
                            <>

                                <FooterButton onClick={() => void runAction(form.remove)}>
                                    <Trash2 size={15} /> Excluir
                                </FooterButton>
                                <FooterButton onClick={() => void runAction(form.duplicate)}>
                                    <Copy size={15} /> Duplicar
                                </FooterButton>
                                <FooterButton onClick={() => void runAction(form.ignore)}>
                                    <SquareSlash size={15} /> Ignorar
                                </FooterButton>
                            
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={submitting}
                            className="inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void runAction(form.submit)}
                            disabled={submitting}
                            className="inline-flex items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Carregando..." : "Concluir"}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}


export function FooterButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-1.5 py-2 text-xs uppercase text-white/70 transition-colors hover:border-white/[0.4] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
            {children}
        </button>
    )}