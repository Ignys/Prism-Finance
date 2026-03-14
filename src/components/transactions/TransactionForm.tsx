import { useMemo, useState } from "react";
import { Copy, MoveRight, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import type { Beneficiary, Category, Tag, Transaction, TransactionStatus, TransactionType, Wallet } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { WalletAvatar } from "../common/WalletAvatar";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { useTransactionForm } from "./useTransactionForm";

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

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

function TransactionHeader({ type, isEditing }: { type: TransactionType; isEditing: boolean }) {
    if (type === "income") {
        return (
            <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
                <TrendingUp size={32} className="rounded-2xl p-1" strokeWidth={3} />
                {isEditing ? "Editar receita" : "Nova receita"}
            </h1>
        );
    }

    if (type === "spending") {
        return (
            <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
                <TrendingDown size={32} className="rounded-2xl p-1" strokeWidth={3} />
                {isEditing ? "Editar despesa" : "Nova despesa"}
            </h1>
        );
    }

    return (
        <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
            <MoveRight size={32} className="rounded-2xl p-1" strokeWidth={3} />
            {isEditing ? "Editar transferencia" : "Nova transferencia"}
        </h1>
    );
}

function StatusField({ status, onChange, disabled = false }: { status: TransactionStatus; onChange: (value: TransactionStatus) => void; disabled?: boolean }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Status</span>
            <div className="flex rounded-xl border border-white/[0.1] bg-black/35 p-1 gap-1">
                <button
                    type="button"
                    onClick={() => onChange("paid")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        status === "paid" ? "bg-emerald-500/20 text-emerald-200" : "text-white/65 hover:bg-white/[0.06]"
                    }`}
                >
                    Pago
                </button>
                <button
                    type="button"
                    onClick={() => onChange("pending")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        status === "pending" ? "bg-amber-500/20 text-amber-200" : "text-white/65 hover:bg-white/[0.06]"
                    }`}
                >
                    Pendente
                </button>
            </div>
        </div>
    );
}

function DateField({
    value,
    onChange,
    onOffset,
}: {
    value: string;
    onChange: (value: string) => void;
    onOffset: (offsetInDays: number) => void;
}) {
    const dateShortcuts = [
        { label: "Hoje", offset: 0 },
        { label: "Ontem", offset: -1 },
        { label: "Amanha", offset: 1 },
    ];

    return (
        <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Data</span>
                <input className={FIELD_INPUT_CLASS} type="date" required value={value} onChange={(event) => onChange(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
                {dateShortcuts.map((shortcut) => (
                    <button
                        key={shortcut.label}
                        type="button"
                        onClick={() => onOffset(shortcut.offset)}
                        className="rounded-full border border-white/[0.15] bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]"
                    >
                        {shortcut.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CategoryOptionContent({ option }: { option: CategoryOption }) {
    const Icon = getCategoryIconComponent(option.category.icon, option.category.type);

    return (
        <div className={`flex items-center gap-2 ${option.level === 1 ? "pl-3" : ""}`}>
            {option.level === 1 && <span className="h-px w-2 rounded-full bg-white/25" />}
            <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12]"
                style={{ color: option.category.color ?? "#CBD5E1", backgroundColor: `${option.category.color ?? "#64748B"}22` }}
            >
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function WalletOptionContent({ option }: { option: WalletOption }) {
    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function BeneficiaryOptionContent({ option }: { option: BeneficiaryOption }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.03]">
                {option.beneficiary.avatarImage ? (
                    <img src={option.beneficiary.avatarImage} alt={option.beneficiary.name} className="h-full w-full object-cover" />
                ) : (
                    <span className="h-full w-full" style={{ backgroundColor: option.beneficiary.avatarColor ?? "#4B5563" }} />
                )}
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function TagsField({ tags, selectedTagIds, onToggle, readOnly = false }: { tags: Tag[]; selectedTagIds: string[]; onToggle: (tagId: string) => void; readOnly?: boolean }) {
    return (
        <div className="rounded-xl border border-white/[0.1] bg-black/35 p-2.5">
            <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                        <button
                            type="button"
                            key={tag.id}
                            onClick={() => onToggle(tag.id)}
                            disabled={readOnly}
                            className={`rounded-full border px-2.5 py-1.5 text-sm ${selected ? "border-white/80 text-white" : "border-white/20 text-white/60"}`}
                            style={{ backgroundColor: selected ? `${tag.color ?? "#64748B"}55` : `${tag.color ?? "#64748B"}22` }}
                        >
                            {tag.name}
                        </button>
                    );
                })}
                {tags.length === 0 && <p className="text-sm text-white/40">Nenhuma tag cadastrada.</p>}
            </div>
        </div>
    );
}

interface TransactionFormProps {
    type?: TransactionType;
    transaction?: Transaction | null;
    mode?: "default" | "invoice_payment_edit";
}

export function TransactionForm({ type, transaction, mode = "default" }: TransactionFormProps) {
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);
    const form = useTransactionForm({ type, transaction, mode });

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

    const handleCategorySelect = (optionId: string) => {
        const selectedOption = categoryOptions.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }

        form.setRootCategoryId(selectedOption.rootCategoryId);
        form.setSubCategoryId(optionId.startsWith("sub:") ? selectedOption.categoryId : "");
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
        } catch (error) {
            console.error("Failed to submit transaction form:", error);
        }

        setSubmitting(false);
    };

    return (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-3">
                <TransactionHeader type={form.resolvedType} isEditing={form.isEditing} />
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

            <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                    <input
                        className={FIELD_INPUT_CLASS}
                        placeholder="Descricao da transacao"
                        value={form.description}
                        onChange={(event) => form.setDescription(event.target.value)}
                    />
                </label>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <p className={FIELD_LABEL_CLASS}>Tags</p>
                    <TagsField tags={form.tags} selectedTagIds={form.selectedTagIds} onToggle={form.toggleTag} readOnly={form.isInvoicePaymentEdit} />
                </div>
            </section>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {form.isEditing && (
                        <>
                            <button
                                type="button"
                                onClick={() => void runAction(form.remove)}
                                disabled={submitting}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Excluir transacao"
                                title="Excluir transacao"
                            >
                                <Trash2 size={15} />
                            </button>
                            {!form.isInvoicePaymentEdit && (
                                <button
                                    type="button"
                                    onClick={() => void runAction(form.duplicate)}
                                    disabled={submitting}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label="Duplicar transacao"
                                    title="Duplicar transacao"
                                >
                                    <Copy size={15} />
                                </button>
                            )}
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

