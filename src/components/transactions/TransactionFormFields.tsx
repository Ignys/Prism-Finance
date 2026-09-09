import { useMemo } from "react";
import { ArrowRight, Layers3, LayoutGrid, ReceiptText, Tags } from "lucide-react";
import { useFinanceTransactions, type Beneficiary, type Category, type Tag, type Transaction, type TransactionSeriesScope, type Wallet } from "../../context/FinanceContext";
import { DateField } from "./DateField";
import { DescriptionAutocomplete } from "./DescriptionAutocomplete";
import { IconTextField } from "./IconTextField";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { TransactionDetailsField } from "./TransactionDetailsField";
import { TransactionFieldIcon } from "./TransactionFieldIcon";
import { BeneficiaryOptionContent, CategoryOptionContent, StatusField, TagOptionContent, WalletOptionContent } from "./TransactionFormParts";
import { TransactionModeField } from "./TransactionModeField";
import type { TransactionFormTab } from "./TransactionFormTabs";
import { FIELD_ICON_TRIGGER_CLASS } from "./transactionForm.constants";
import type { TransactionDetailsController } from "./useTransactionDetails";
import type { TransactionFormState } from "./useTransactionForm";

interface WalletOption extends ComboboxOptionBase { wallet: Wallet }
interface CategoryOption extends ComboboxOptionBase { category: Category; level: 0 | 1; rootCategoryId: string; categoryId: string }
interface BeneficiaryOption extends ComboboxOptionBase { beneficiary: Beneficiary }
interface TagOption extends ComboboxOptionBase { tag: Tag }
interface EditScopeOption extends ComboboxOptionBase { scope: TransactionSeriesScope; icon: typeof ReceiptText }

const EDIT_SCOPE_OPTIONS: EditScopeOption[] = [
    { id: "single", label: "Apenas esta transação", searchText: "apenas esta ocorrencia single", scope: "single", icon: ReceiptText },
    { id: "this_and_next", label: "Esta e as próximas", searchText: "esta e as proximas this and next", scope: "this_and_next", icon: ArrowRight },
    { id: "all", label: "Toda a série", searchText: "toda a serie all", scope: "all", icon: Layers3 },
];

function EditScopeOptionContent({ option }: { option: EditScopeOption }) {
    const Icon = option.icon;
    return <div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80"><Icon size={14} /></span><span className="truncate">{option.label}</span></div>;
}

function ReadOnlyField({ label, children, showFallbackIcon = false }: { label: string; children: React.ReactNode; showFallbackIcon?: boolean }) {
    return (
        <div aria-label={label} className="flex min-h-[50px] items-center gap-2 rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2.5 text-sm text-white/75">
            {showFallbackIcon ? <TransactionFieldIcon icon={LayoutGrid} /> : null}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

interface TransactionFormFieldsProps {
    activeTab: TransactionFormTab;
    form: TransactionFormState;
    transaction?: Transaction | null;
    details: TransactionDetailsController;
    disabled: boolean;
    detailsDisabled?: boolean;
}

export function TransactionFormFields({ activeTab, form, transaction, details, disabled, detailsDisabled = disabled }: TransactionFormFieldsProps) {
    const transactions = useFinanceTransactions();
    const walletOptions = useMemo<WalletOption[]>(() => form.wallets.map((wallet) => ({ id: wallet.id, label: wallet.name, searchText: wallet.name, wallet })), [form.wallets]);
    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const subCategoriesByRoot = new Map<string, Category[]>();
        form.availableCategories.forEach((category) => {
            if (category.parentId) subCategoriesByRoot.set(category.parentId, [...(subCategoriesByRoot.get(category.parentId) ?? []), category]);
        });
        return form.rootCategories.flatMap((rootCategory) => [
            { id: `root:${rootCategory.id}`, label: rootCategory.name, searchText: rootCategory.name, category: rootCategory, level: 0 as const, rootCategoryId: rootCategory.id, categoryId: rootCategory.id },
            ...(subCategoriesByRoot.get(rootCategory.id) ?? []).map((subCategory) => ({ id: `sub:${subCategory.id}`, label: subCategory.name, searchText: `${subCategory.name} ${rootCategory.name}`, category: subCategory, level: 1 as const, rootCategoryId: rootCategory.id, categoryId: subCategory.id })),
        ]);
    }, [form.availableCategories, form.rootCategories]);
    const beneficiaryOptions = useMemo<BeneficiaryOption[]>(() => form.beneficiaries.filter((beneficiary) => beneficiary.isActive || beneficiary.id === form.beneficiaryId).map((beneficiary) => ({ id: beneficiary.id, label: beneficiary.name, searchText: beneficiary.name, beneficiary })), [form.beneficiaries, form.beneficiaryId]);
    const tagOptions = useMemo<TagOption[]>(() => form.tags.map((tag) => ({ id: tag.id, label: tag.name, searchText: tag.name, tag })), [form.tags]);
    const descriptionSuggestionCategoryIds = useMemo(() => categoryOptions.map((option) => option.categoryId), [categoryOptions]);
    const selectedCategoryOptionId = form.subCategoryId ? `sub:${form.subCategoryId}` : form.rootCategoryId ? `root:${form.rootCategoryId}` : "";

    const handleCategorySelect = (optionId: string) => {
        const option = categoryOptions.find((item) => item.id === optionId);
        if (!option) return;
        form.setRootCategoryId(option.rootCategoryId);
        form.setSubCategoryId(option.level === 1 ? option.categoryId : "");
    };

    const handleDescriptionSuggestionSelect = (suggestion: Transaction) => {
        const categoryOption = categoryOptions.find((option) => option.categoryId === suggestion.category.id);
        if (!categoryOption) return;
        form.setRootCategoryId(categoryOption.rootCategoryId);
        form.setSubCategoryId(categoryOption.level === 1 ? categoryOption.categoryId : "");
    };

    if (activeTab === "advanced") {
        return (
            <section className="flex flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                    <MultiSelectCombobox hideLabel leadingIcon={<TransactionFieldIcon icon={Tags} />} triggerClassName={FIELD_ICON_TRIGGER_CLASS} label="Tags" values={form.selectedTagIds} placeholder="Nenhuma tag selecionada" emptyMessage="Nenhuma tag cadastrada." options={tagOptions} onChange={form.setSelectedTagIds} renderOptionContent={(option) => <TagOptionContent option={option} />} />
                    <TransactionModeField recurrenceCountInput={form.recurrenceCountInput} onRecurrenceCountChange={form.setRecurrenceCountInput} mode={form.transactionMode} installmentCountInput={form.installmentCountInput} onModeChange={form.setTransactionMode} onInstallmentCountChange={form.setInstallmentCountInput} disabled={form.isInvoicePaymentEdit || form.isTransfer || disabled} />
                </div>
                <div className="h-px bg-white/[0.06]" />
                <TransactionDetailsField details={details} disabled={detailsDisabled} />
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-3">
            <input className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24] disabled:cursor-not-allowed disabled:opacity-65" inputMode="numeric" placeholder="R$ 0,00" value={form.amountInput} onChange={(event) => form.setAmountInput(event.target.value)} disabled={form.isInvoicePaymentEdit || disabled} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><StatusField status={form.status} onChange={form.setStatus} disabled={form.isInvoicePaymentEdit || disabled} /><DateField hideLabel value={form.date} onChange={form.setDate} onOffset={form.setDateOffset} disabled={disabled} /></div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {form.isInvoicePaymentEdit ? <ReadOnlyField label="Carteira">{walletOptions.find((option) => option.id === form.walletId) ? <WalletOptionContent option={walletOptions.find((option) => option.id === form.walletId)!} /> : <span>Carteira removida</span>}</ReadOnlyField> : <SingleSelectCombobox hideLabel label="Carteira" value={form.walletId} placeholder="Selecione uma carteira" emptyMessage="Nenhuma carteira encontrada." options={walletOptions} onChange={form.setWalletId} renderOptionContent={(option) => <WalletOptionContent option={option} />} disabled={disabled} />}
                <SingleSelectCombobox hideLabel label="Beneficiário" value={form.beneficiaryId} placeholder="Selecione um beneficiário" emptyMessage="Nenhum beneficiário encontrado." options={beneficiaryOptions} onChange={form.setBeneficiaryId} renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />} disabled={disabled} />
            </div>
            {form.isInvoicePaymentEdit ? <ReadOnlyField label="Categoria" showFallbackIcon>{transaction?.category.label ?? "Sem categoria"}</ReadOnlyField> : <SingleSelectCombobox hideLabel label="Categoria" value={selectedCategoryOptionId} placeholder="Selecione uma categoria" emptyMessage="Nenhuma categoria disponível." options={categoryOptions} onChange={handleCategorySelect} renderOptionContent={(option) => <CategoryOptionContent option={option} />} disabled={disabled} />}
            {form.isInvoicePaymentEdit ? (
                <IconTextField ariaLabel="Descrição" placeholder="Descrição da transação" value={form.description} onChange={form.setDescription} disabled={disabled} maxLength={160} />
            ) : (
                <DescriptionAutocomplete
                    value={form.description}
                    onChange={form.setDescription}
                    onSuggestionSelect={handleDescriptionSuggestionSelect}
                    transactions={transactions}
                    type={form.resolvedType}
                    allowedCategoryIds={descriptionSuggestionCategoryIds}
                    excludeTransactionId={transaction?.id}
                    disabled={disabled}
                />
            )}
            {form.isEditing && form.isSeriesTransaction && !form.isInvoicePaymentEdit ? <SingleSelectCombobox disableSearch compactTrigger label="Aplicar edição em" value={form.editScope} placeholder="Selecione um escopo" emptyMessage="Nenhum escopo encontrado." options={EDIT_SCOPE_OPTIONS} onChange={(value) => form.setEditScope(value === "all" || value === "this_and_next" ? value : "single")} renderOptionContent={(option) => <EditScopeOptionContent option={option} />} renderSelectedContent={(option) => <span className="truncate">{option.label}</span>} disabled={disabled} /> : null}
        </section>
    );
}
