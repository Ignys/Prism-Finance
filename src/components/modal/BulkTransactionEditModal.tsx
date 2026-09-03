import { useMemo, useState } from "react";
import { Tags } from "lucide-react";
import type { Beneficiary, Category, Tag, Transaction, TransactionStatus } from "../../context/FinanceContext";
import { useFinanceActions, useFinanceBeneficiaries, useFinanceCategories, useFinanceTags, useFinanceTransactions } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { MultiSelectCombobox } from "../transactions/MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { BeneficiaryOptionContent, CategoryOptionContent, TagOptionContent } from "../transactions/TransactionFormParts";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { FIELD_ICON_TRIGGER_CLASS, FIELD_LABEL_CLASS } from "../transactions/transactionForm.constants";
import { ModalStructure } from "./ModalStructure";

interface BulkTransactionEditModalProps {
    transactions: Transaction[];
    context: "wallet" | "invoice";
    onApplied?: () => void;
}

interface CategoryOption extends ComboboxOptionBase {
    category: Category;
    level: 0 | 1;
    categoryId: string;
}

interface BeneficiaryOption extends ComboboxOptionBase {
    beneficiary: Beneficiary;
}

interface TagOption extends ComboboxOptionBase {
    tag: Tag;
}

interface StatusOption extends ComboboxOptionBase {
    status: TransactionStatus;
}

const BULK_FIELD_ROW_CLASS = "rounded-xl border border-white/[0.08] bg-black/20 p-3";
const BULK_CHECKBOX_CLASS = "h-4 w-4 rounded border-white/20 bg-black/35 accent-emerald-400";

function getStatusOptions(context: BulkTransactionEditModalProps["context"]): StatusOption[] {
    if (context === "invoice") {
        return [
            { id: "pending", label: "Pendente", searchText: "pendente aberta", status: "pending" },
            { id: "skipped", label: "Ignorada", searchText: "ignorada skipped", status: "skipped" },
        ];
    }

    return [
        { id: "pending", label: "Pendente", searchText: "pendente aberta", status: "pending" },
        { id: "paid", label: "Paga / concluida", searchText: "paga concluida recebida", status: "paid" },
        { id: "skipped", label: "Ignorada", searchText: "ignorada skipped", status: "skipped" },
    ];
}

function StatusOptionContent({ option }: { option: StatusOption }) {
    return <span className="truncate">{option.label}</span>;
}

function BulkFieldToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
    return (
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className={BULK_CHECKBOX_CLASS} />
            {label}
        </label>
    );
}

function buildCategoryOptions(categories: Category[], categoryType: Category["type"]): CategoryOption[] {
    const availableCategories = categories.filter((category) => category.type === categoryType && category.isActive);
    const rootCategories = availableCategories.filter((category) => !category.parentId);
    const subCategoriesByRoot = new Map<string, Category[]>();

    for (const category of availableCategories) {
        if (!category.parentId) {
            continue;
        }
        const rootSubCategories = subCategoriesByRoot.get(category.parentId) ?? [];
        rootSubCategories.push(category);
        subCategoriesByRoot.set(category.parentId, rootSubCategories);
    }

    return rootCategories.flatMap((rootCategory) => {
        const rootOption: CategoryOption = {
            id: rootCategory.id,
            label: rootCategory.name,
            searchText: rootCategory.name,
            category: rootCategory,
            level: 0,
            categoryId: rootCategory.id,
        };

        const subCategoryOptions = (subCategoriesByRoot.get(rootCategory.id) ?? []).map((subCategory) => ({
            id: subCategory.id,
            label: subCategory.name,
            searchText: `${subCategory.name} ${rootCategory.name}`,
            category: subCategory,
            level: 1 as const,
            categoryId: subCategory.id,
        }));

        return [rootOption, ...subCategoryOptions];
    });
}

export function BulkTransactionEditModal({ transactions, context, onApplied }: BulkTransactionEditModalProps) {
    const { updateTransactionsBulk } = useFinanceActions();
    const categories = useFinanceCategories();
    const beneficiaries = useFinanceBeneficiaries();
    const tags = useFinanceTags();
    const allTransactions = useFinanceTransactions();
    const { closeModal } = useModal();

    const [categoryEnabled, setCategoryEnabled] = useState(false);
    const [beneficiaryEnabled, setBeneficiaryEnabled] = useState(false);
    const [statusEnabled, setStatusEnabled] = useState(false);
    const [tagsEnabled, setTagsEnabled] = useState(false);
    const [categoryId, setCategoryId] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState("");
    const [status, setStatus] = useState<TransactionStatus>("pending");
    const [tagIdsToAdd, setTagIdsToAdd] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const selectedTypeSet = useMemo(() => new Set(transactions.map((transaction) => transaction.type)), [transactions]);
    const categoryType = selectedTypeSet.size === 1 && selectedTypeSet.has("income") ? "income" : selectedTypeSet.size === 1 && selectedTypeSet.has("spending") ? "expense" : null;
    const canPatchCategory = categoryType !== null;
    const canPatchBeneficiary = transactions.every((transaction) => transaction.type !== "transfer");
    const statusOptions = useMemo(() => getStatusOptions(context), [context]);

    const categoryOptions = useMemo(() => (categoryType ? buildCategoryOptions(categories, categoryType) : []), [categories, categoryType]);
    const beneficiaryOptions = useMemo<BeneficiaryOption[]>(
        () =>
            beneficiaries
                .filter((beneficiary) => beneficiary.isActive)
                .map((beneficiary) => ({
                    id: beneficiary.id,
                    label: beneficiary.name,
                    searchText: beneficiary.name,
                    beneficiary,
                })),
        [beneficiaries],
    );
    const tagOptions = useMemo<TagOption[]>(
        () =>
            tags
                .filter((tag) => tag.isActive)
                .map((tag) => ({
                    id: tag.id,
                    label: tag.name,
                    searchText: tag.name,
                    tag,
                })),
        [tags],
    );

    const selectedCountByGroupId = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach((transaction) => {
            map.set(transaction.groupId, (map.get(transaction.groupId) ?? 0) + 1);
        });
        return map;
    }, [transactions]);

    const transactionCountByGroupId = useMemo(() => {
        const map = new Map<string, number>();
        allTransactions.forEach((transaction) => {
            map.set(transaction.groupId, (map.get(transaction.groupId) ?? 0) + 1);
        });
        return map;
    }, [allTransactions]);

    const partialGroupCount = useMemo(() => {
        let count = 0;
        selectedCountByGroupId.forEach((selectedCount, groupId) => {
            if ((transactionCountByGroupId.get(groupId) ?? 0) > selectedCount) {
                count += 1;
            }
        });
        return count;
    }, [selectedCountByGroupId, transactionCountByGroupId]);

    const willSplitGroups = partialGroupCount > 0 && ((categoryEnabled && canPatchCategory) || (beneficiaryEnabled && canPatchBeneficiary));
    const hasValidCategoryPatch = categoryEnabled && canPatchCategory && Boolean(categoryId);
    const hasValidBeneficiaryPatch = beneficiaryEnabled && canPatchBeneficiary && Boolean(beneficiaryId);
    const hasValidStatusPatch = statusEnabled && Boolean(status);
    const hasValidTagPatch = tagsEnabled && tagIdsToAdd.length > 0;
    const canSubmit = hasValidCategoryPatch || hasValidBeneficiaryPatch || hasValidStatusPatch || hasValidTagPatch;

    const handleSubmit = async () => {
        if (!canSubmit || submitting) {
            return;
        }

        setSubmitting(true);
        try {
            await updateTransactionsBulk({
                transactionIds: transactions.map((transaction) => transaction.id),
                categoryId: hasValidCategoryPatch ? categoryId : undefined,
                beneficiaryId: hasValidBeneficiaryPatch ? beneficiaryId : undefined,
                status: hasValidStatusPatch ? status : undefined,
                tagIdsToAdd: hasValidTagPatch ? tagIdsToAdd : undefined,
            });
            onApplied?.();
            closeModal();
        } catch (error) {
            console.error("Failed to update transactions in bulk:", error);
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure height="auto" width="680px">
            <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-5 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="mb-5 flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-white">Editar em massa</h2>
                    <p className="text-sm text-white/58">
                        {transactions.length} {transactions.length === 1 ? "transacao selecionada" : "transacoes selecionadas"}
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {canPatchCategory ? (
                        <div className={BULK_FIELD_ROW_CLASS}>
                            <BulkFieldToggle checked={categoryEnabled} label="Alterar categoria" onChange={setCategoryEnabled} />
                            <SingleSelectCombobox
                                hideLabel
                                label="Categoria"
                                value={categoryId}
                                placeholder="Selecione a categoria"
                                emptyMessage="Nenhuma categoria encontrada."
                                options={categoryOptions}
                                onChange={setCategoryId}
                                renderOptionContent={(option) => <CategoryOptionContent option={option} />}
                                disabled={!categoryEnabled}
                            />
                        </div>
                    ) : null}

                    {canPatchBeneficiary ? (
                        <div className={BULK_FIELD_ROW_CLASS}>
                            <BulkFieldToggle checked={beneficiaryEnabled} label="Alterar beneficiario" onChange={setBeneficiaryEnabled} />
                            <SingleSelectCombobox
                                hideLabel
                                label="Beneficiario"
                                value={beneficiaryId}
                                placeholder="Selecione o beneficiario"
                                emptyMessage="Nenhum beneficiario encontrado."
                                options={beneficiaryOptions}
                                onChange={setBeneficiaryId}
                                renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />}
                                disabled={!beneficiaryEnabled}
                            />
                        </div>
                    ) : null}

                    <div className={BULK_FIELD_ROW_CLASS}>
                        <BulkFieldToggle checked={statusEnabled} label="Alterar status" onChange={setStatusEnabled} />
                        <SingleSelectCombobox
                            hideLabel
                            label="Status"
                            value={status}
                            placeholder="Selecione o status"
                            emptyMessage="Nenhum status encontrado."
                            options={statusOptions}
                            onChange={(value) => setStatus(value as TransactionStatus)}
                            renderOptionContent={(option) => <StatusOptionContent option={option} />}
                            disabled={!statusEnabled}
                            disableSearch
                        />
                    </div>

                    <div className={BULK_FIELD_ROW_CLASS}>
                        <BulkFieldToggle checked={tagsEnabled} label="Adicionar tags" onChange={setTagsEnabled} />
                        <MultiSelectCombobox
                            hideLabel
                            leadingIcon={<TransactionFieldIcon icon={Tags} />}
                            label="Tags"
                            values={tagIdsToAdd}
                            placeholder="Selecione as tags"
                            emptyMessage="Nenhuma tag encontrada."
                            options={tagOptions}
                            onChange={setTagIdsToAdd}
                            renderOptionContent={(option) => <TagOptionContent option={option} />}
                            disabled={!tagsEnabled}
                            triggerClassName={FIELD_ICON_TRIGGER_CLASS}
                        />
                    </div>
                </div>

                {tagsEnabled ? <p className="mt-3 pl-1 text-xs text-white/45">As tags escolhidas serao adicionadas sem remover as tags atuais.</p> : null}

                {willSplitGroups ? (
                    <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/85">
                        Algumas transacoes fazem parte de series ou parcelamentos. Apenas as linhas selecionadas serao alteradas.
                    </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className={`${FIELD_LABEL_CLASS} pl-0`}>Somente campos ativados serao aplicados.</span>
                    <div className="flex gap-2">
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
                            disabled={!canSubmit || submitting}
                            className="inline-flex min-w-36 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? "Aplicando..." : "Aplicar alteracoes"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalStructure>
    );
}
