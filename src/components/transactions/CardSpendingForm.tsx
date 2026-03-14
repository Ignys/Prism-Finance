import { useEffect, useMemo, useState } from "react";
import { Copy, ReceiptText, Trash2, X } from "lucide-react";
import type { Beneficiary, Category, CreditCard, CreditCardInvoice, Transaction, TransactionStatus } from "../../context/FinanceContext";
import {
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceFavoriteCreditCard,
    useFinanceTags,
} from "../../context/FinanceContext";
import { buildCreditCardInvoiceId, getCreditCardInvoiceMonthKey, parseCreditCardInvoiceId, resolveCreditCardInvoiceCycle, resolveCreditCardInvoiceCycleFromCycleKey } from "../../context/financeTypes";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { getLocalDateFromOffset, getLocalTodayDate } from "../../lib/localDate";
import { WalletAvatar } from "../common/WalletAvatar";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";

const FIELD_LABEL_CLASS = "text-[11px] uppercase tracking-[0.12em] text-white/50";
const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

type InvoiceVisualStatus = "paid" | "overdue" | "closed" | "open";

const INVOICE_STATUS_LABELS: Record<InvoiceVisualStatus, string> = {
    open: "Aberta",
    closed: "Fechada",
    overdue: "Vencida",
    paid: "Paga",
};

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

interface CardSpendingFormProps {
    transaction?: Transaction | null;
    prefill?: CardSpendingFormPrefill;
}

export interface CardSpendingFormPrefill {
    initialCreditCardId?: string;
    initialInvoiceId?: string;
    initialCycleKey?: string;
    initialDate?: string;
}

interface CreditCardOption extends ComboboxOptionBase {
    creditCard: CreditCard;
}

interface InvoiceOption extends ComboboxOptionBase {
    invoice: CreditCardInvoice;
    visualStatus: InvoiceVisualStatus;
    monthLabel: string;
    cycleKey: string;
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

function CreditCardOptionContent({ option }: { option: CreditCardOption }) {
    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.creditCard} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function InvoiceOptionContent({ option }: { option: InvoiceOption }) {
    const statusClassNameByStatus: Record<InvoiceVisualStatus, string> = {
        open: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
        closed: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        overdue: "border-red-400/35 bg-red-500/15 text-red-100",
        paid: "border-sky-400/30 bg-sky-500/15 text-sky-100",
    };

    return (
        <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
                <p className="truncate text-sm text-white">{option.monthLabel}</p>
                <p className="truncate text-xs text-white/55">{option.cycleKey}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${statusClassNameByStatus[option.visualStatus]}`}>
                {INVOICE_STATUS_LABELS[option.visualStatus]}
            </span>
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

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function formatMonthLabel(monthKey: string): string {
    const [yearPart, monthPart] = monthKey.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return monthKey;
    }

    const formatted = monthLabelFormatter.format(new Date(year, month - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function parseYearMonthKey(cycleKey: string): { year: number; month: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(cycleKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return { year, month };
}

function shiftCycleKey(cycleKey: string, offset: number): string {
    const parsed = parseYearMonthKey(cycleKey);
    if (!parsed) {
        return "";
    }

    const shifted = new Date(parsed.year, parsed.month - 1 + offset, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function resolveInvoiceVisualStatus(params: { status: "open" | "paid"; closingDate: string; dueDate: string }, referenceDate = new Date()): InvoiceVisualStatus {
    if (params.status === "paid") {
        return "paid";
    }

    const today = getLocalTodayDate(referenceDate);
    if (today > params.dueDate) {
        return "overdue";
    }

    if (today > params.closingDate && today <= params.dueDate) {
        return "closed";
    }

    return "open";
}

export function CardSpendingForm({ transaction = null, prefill }: CardSpendingFormProps) {
    const { closeModal } = useModal();
    const { addTransaction, deleteTransaction } = useFinanceActions();
    const creditCards = useFinanceCreditCards();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const categories = useFinanceCategories();
    const beneficiaries = useFinanceBeneficiaries();
    const allTags = useFinanceTags();
    const isEditing = Boolean(transaction);
    const initialPrefillInvoiceId = !isEditing ? prefill?.initialInvoiceId?.trim() ?? "" : "";
    const parsedInitialPrefillInvoice = !isEditing && initialPrefillInvoiceId ? parseCreditCardInvoiceId(initialPrefillInvoiceId) : null;
    const initialPrefillCreditCardId = !isEditing ? (prefill?.initialCreditCardId?.trim() || parsedInitialPrefillInvoice?.creditCardId || "") : "";
    const initialPrefillDate = !isEditing ? prefill?.initialDate?.trim() ?? "" : "";

    const [submitting, setSubmitting] = useState(false);
    const [amountInput, setAmountInputState] = useState(() => (transaction ? formatAmountInputFromValue(transaction.value) : "R$ 0,00"));
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [date, setDate] = useState(transaction?.date ?? (initialPrefillDate || getLocalTodayDate()));
    const [creditCardId, setCreditCardId] = useState(transaction?.creditCardId ?? (initialPrefillCreditCardId || favoriteCreditCardId || ""));
    const [invoiceId, setInvoiceId] = useState(transaction?.invoiceId ?? initialPrefillInvoiceId);
    const [categoryId, setCategoryId] = useState(transaction?.category.id ?? "");
    const [beneficiaryId, setBeneficiaryId] = useState(transaction?.beneficiaryId ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? []);

    const amountValue = useMemo(() => parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput)), [amountInput]);

    useEffect(() => {
        if (!transaction) {
            return;
        }

        setAmountInputState(formatAmountInputFromValue(transaction.value));
        setDescription(transaction.description ?? "");
        setDate(transaction.date ?? getLocalTodayDate());
        setCreditCardId(transaction.creditCardId ?? favoriteCreditCardId ?? "");
        setInvoiceId(transaction.invoiceId ?? "");
        setCategoryId(transaction.category.id ?? "");
        setBeneficiaryId(transaction.beneficiaryId ?? "");
        setSelectedTagIds(transaction.tagIds ?? []);
    }, [favoriteCreditCardId, transaction?.id]);

    useEffect(() => {
        const fallbackCardId = creditCards.find((card) => card.id === favoriteCreditCardId)?.id ?? creditCards[0]?.id ?? "";
        if (!creditCards.some((card) => card.id === creditCardId)) {
            setCreditCardId(fallbackCardId);
        }
    }, [creditCardId, creditCards, favoriteCreditCardId]);

    const selectedCategoryIdsToKeep = useMemo(() => {
        const ids = new Set<string>();
        if (!categoryId) {
            return ids;
        }
        const selectedCategory = categories.find((item) => item.id === categoryId);
        if (!selectedCategory) {
            return ids;
        }
        ids.add(selectedCategory.id);
        if (selectedCategory.parentId) {
            ids.add(selectedCategory.parentId);
        }
        return ids;
    }, [categories, categoryId]);

    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const expenseCategories = categories.filter((item) => item.type === "expense" && (item.isActive || selectedCategoryIdsToKeep.has(item.id)));
        const subCategoriesByRoot = new Map<string, Category[]>();

        for (const category of expenseCategories) {
            if (!category.parentId) {
                continue;
            }

            const list = subCategoriesByRoot.get(category.parentId) ?? [];
            list.push(category);
            subCategoriesByRoot.set(category.parentId, list);
        }

        return expenseCategories
            .filter((category) => !category.parentId)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
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
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
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
    }, [categories, selectedCategoryIdsToKeep]);

    useEffect(() => {
        if (categoryOptions.some((option) => option.categoryId === categoryId)) {
            return;
        }
        setCategoryId(categoryOptions[0]?.categoryId ?? "");
    }, [categoryId, categoryOptions]);

    const beneficiaryOptions = useMemo<BeneficiaryOption[]>(
        () =>
            beneficiaries
                .filter((beneficiary) => beneficiary.isActive || beneficiary.id === beneficiaryId)
                .map((beneficiary) => ({
                    id: beneficiary.id,
                    label: beneficiary.name,
                    searchText: beneficiary.name,
                    beneficiary,
                })),
        [beneficiaries, beneficiaryId],
    );

    useEffect(() => {
        const defaultBeneficiary =
            beneficiaries.find((item) => normalizeComparisonText(item.name) === "eu") ??
            beneficiaries.find((item) => item.isActive) ??
            beneficiaries[0];
        if (!defaultBeneficiary) {
            setBeneficiaryId("");
            return;
        }
        if (!beneficiaries.some((item) => item.id === beneficiaryId)) {
            setBeneficiaryId(defaultBeneficiary.id);
        }
    }, [beneficiaries, beneficiaryId]);

    const selectedCard = useMemo(() => creditCards.find((card) => card.id === creditCardId) ?? null, [creditCardId, creditCards]);
    const openCycle = useMemo(() => (selectedCard ? resolveCreditCardInvoiceCycle(getLocalTodayDate(), selectedCard.closingDay, selectedCard.dueDay) : null), [selectedCard]);
    const prefillInvoiceId = !isEditing ? prefill?.initialInvoiceId?.trim() ?? "" : "";
    const prefillParsedInvoice = useMemo(() => (prefillInvoiceId ? parseCreditCardInvoiceId(prefillInvoiceId) : null), [prefillInvoiceId]);
    const prefillCycleKey = useMemo(() => {
        if (isEditing) {
            return "";
        }

        const cycleFromProps = prefill?.initialCycleKey?.trim() ?? "";
        return cycleFromProps || prefillParsedInvoice?.cycleKey || "";
    }, [isEditing, prefill?.initialCycleKey, prefillParsedInvoice?.cycleKey]);
    const transactionCycleKey = useMemo(() => {
        if (!transaction?.invoiceId) {
            return "";
        }
        return parseCreditCardInvoiceId(transaction.invoiceId)?.cycleKey ?? "";
    }, [transaction?.invoiceId]);
    const anchorCycleKey = useMemo(() => {
        if (prefillCycleKey) {
            return prefillCycleKey;
        }
        if (transactionCycleKey) {
            return transactionCycleKey;
        }
        return openCycle?.cycleKey ?? "";
    }, [openCycle?.cycleKey, prefillCycleKey, transactionCycleKey]);
    const preferredPrefillInvoiceId = useMemo(() => {
        if (isEditing || !selectedCard) {
            return "";
        }

        if (prefillInvoiceId && prefillParsedInvoice?.creditCardId === selectedCard.id) {
            return prefillInvoiceId;
        }

        if (prefillCycleKey) {
            return buildCreditCardInvoiceId(selectedCard.id, prefillCycleKey);
        }

        return "";
    }, [isEditing, prefillCycleKey, prefillInvoiceId, prefillParsedInvoice?.creditCardId, selectedCard]);

    const invoiceOptions = useMemo<InvoiceOption[]>(() => {
        if (!selectedCard) {
            return [];
        }

        const cardInvoices = creditCardInvoices.filter((invoice) => invoice.creditCardId === selectedCard.id);
        const invoicesById = new Map(cardInvoices.map((invoice) => [invoice.id, invoice]));

        const ensureSyntheticInvoice = (cycleKey: string) => {
            if (!cycleKey) {
                return;
            }

            const invoiceId = buildCreditCardInvoiceId(selectedCard.id, cycleKey);
            if (invoicesById.has(invoiceId)) {
                return;
            }

            const cycle = resolveCreditCardInvoiceCycleFromCycleKey(cycleKey, selectedCard.closingDay, selectedCard.dueDay);
            invoicesById.set(invoiceId, {
                id: invoiceId,
                creditCardId: selectedCard.id,
                cycleKey: cycle.cycleKey,
                closingDate: cycle.closingDate,
                dueDate: cycle.dueDate,
                totalAmount: 0,
                paidAmount: 0,
                status: "open",
                paidAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        };

        if (openCycle) {
            ensureSyntheticInvoice(openCycle.cycleKey);
        }

        if (anchorCycleKey) {
            for (let offset = 0; offset <= 4; offset += 1) {
                const cycleKey = offset === 0 ? anchorCycleKey : shiftCycleKey(anchorCycleKey, offset);
                ensureSyntheticInvoice(cycleKey);
            }
        }

        return Array.from(invoicesById.values())
            .sort((a, b) => {
                if (a.dueDate === b.dueDate) {
                    return a.id.localeCompare(b.id);
                }
                return a.dueDate.localeCompare(b.dueDate);
            })
            .map((invoice) => {
                const visualStatus = resolveInvoiceVisualStatus(invoice);
                const monthKey = getCreditCardInvoiceMonthKey(invoice);
                const monthLabel = formatMonthLabel(monthKey);
                return {
                    id: invoice.id,
                    searchText: `${monthLabel} ${invoice.cycleKey} ${INVOICE_STATUS_LABELS[visualStatus]}`,
                    visualStatus,
                    label: `${monthLabel} (${invoice.cycleKey})`,
                    monthLabel,
                    cycleKey: invoice.cycleKey,
                    invoice,
                };
            });
    }, [anchorCycleKey, creditCardInvoices, openCycle, selectedCard]);

    useEffect(() => {
        if (invoiceOptions.length < 1) {
            setInvoiceId("");
            return;
        }
        if (invoiceOptions.some((option) => option.id === invoiceId)) {
            return;
        }
        if (preferredPrefillInvoiceId && invoiceOptions.some((option) => option.id === preferredPrefillInvoiceId)) {
            setInvoiceId(preferredPrefillInvoiceId);
            return;
        }
        const openOption = invoiceOptions.find((option) => option.visualStatus === "open");
        setInvoiceId(openOption?.id ?? invoiceOptions[0].id);
    }, [invoiceId, invoiceOptions, preferredPrefillInvoiceId]);

    const creditCardOptions = useMemo<CreditCardOption[]>(
        () =>
            creditCards
                .filter((card) => card.isActive || card.id === creditCardId)
                .map((card) => ({
                    id: card.id,
                    label: card.name,
                    searchText: card.name,
                    creditCard: card,
                })),
        [creditCardId, creditCards],
    );

    const selectedCategoryOptionId = useMemo(() => {
        if (!categoryId) {
            return "";
        }
        const selectedOption = categoryOptions.find((option) => option.categoryId === categoryId);
        return selectedOption?.id ?? "";
    }, [categoryId, categoryOptions]);

    const handleCategorySelect = (optionId: string) => {
        const selectedOption = categoryOptions.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }
        setCategoryId(selectedOption.categoryId);
    };

    const tags = useMemo(() => allTags.filter((tag) => tag.isActive || selectedTagIds.includes(tag.id)), [allTags, selectedTagIds]);

    const toggleTag = (tagId: string) => {
        setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((item) => item !== tagId) : [...prev, tagId]));
    };

    const setAmountInput = (value: string) => {
        const digits = extractCurrencyDigits(value);
        setAmountInputState(formatCurrencyFromDigits(digits));
    };

    const setDateOffset = (offsetInDays: number) => {
        setDate(getLocalDateFromOffset(offsetInDays));
    };

    const buildDraft = () => {
        const numericValue = amountValue;
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return null;
        }

        if (!selectedCard || !invoiceId) {
            return null;
        }

        const selectedInvoiceOption = invoiceOptions.find((option) => option.id === invoiceId);
        if (!selectedInvoiceOption) {
            return null;
        }

        const resolvedStatus: TransactionStatus = selectedInvoiceOption.visualStatus === "open" ? "pending" : "paid";

        return {
            type: "spending" as const,
            value: numericValue,
            date: date || getLocalTodayDate(),
            inWallet: selectedCard.bankWalletId ?? "default",
            paymentMethod: "credit_card" as const,
            creditCardId: selectedCard.id,
            invoiceId: selectedInvoiceOption.invoice.id,
            categoryId: categoryId || null,
            beneficiaryId: beneficiaryId || null,
            tagIds: selectedTagIds,
            description: description || "Compra no cartao",
            status: resolvedStatus,
            notes: description || undefined,
        };
    };

    const submit = async () => {
        const draft = buildDraft();
        if (!draft) {
            return false;
        }

        if (transaction) {
            await addTransaction(draft);
            await deleteTransaction(transaction);
            return true;
        }

        await addTransaction(draft);
        return true;
    };

    const remove = async () => {
        if (!transaction) {
            return false;
        }

        await deleteTransaction(transaction);
        return true;
    };

    const duplicate = async () => {
        const draft = buildDraft();
        if (!draft) {
            return false;
        }

        await addTransaction(draft);
        return true;
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
            console.error("Failed to submit card spending form:", error);
        }

        setSubmitting(false);
    };

    return (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-3">
                <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
                    <ReceiptText size={30} className="rounded-2xl p-1" strokeWidth={2.5} />
                    {isEditing ? "Editar gasto no cartao" : "Novo gasto no cartao"}
                </h1>
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
                    <input className={FIELD_INPUT_CLASS} inputMode="numeric" placeholder="R$ 0,00" value={amountInput} onChange={(event) => setAmountInput(event.target.value)} />
                </label>

                <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Data</span>
                        <input className={FIELD_INPUT_CLASS} type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Hoje", offset: 0 },
                            { label: "Ontem", offset: -1 },
                            { label: "Amanha", offset: 1 },
                        ].map((shortcut) => (
                            <button
                                key={shortcut.label}
                                type="button"
                                onClick={() => setDateOffset(shortcut.offset)}
                                className="rounded-full border border-white/[0.15] bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.08em] text-white/75 transition-colors hover:bg-white/[0.08]"
                            >
                                {shortcut.label}
                            </button>
                        ))}
                    </div>
                </div>

                <SingleSelectCombobox
                    label="Cartao"
                    value={creditCardId}
                    placeholder="Selecione um cartao"
                    emptyMessage="Nenhum cartao encontrado."
                    options={creditCardOptions}
                    onChange={setCreditCardId}
                    renderOptionContent={(option) => <CreditCardOptionContent option={option} />}
                    labelClassName={FIELD_LABEL_CLASS}
                />

                <SingleSelectCombobox
                    label="Fatura"
                    value={invoiceId}
                    placeholder="Selecione uma fatura"
                    emptyMessage="Nenhuma fatura disponivel."
                    options={invoiceOptions}
                    onChange={setInvoiceId}
                    renderOptionContent={(option) => <InvoiceOptionContent option={option} />}
                    labelClassName={FIELD_LABEL_CLASS}
                />

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

                <SingleSelectCombobox
                    label="Beneficiario"
                    value={beneficiaryId}
                    placeholder="Selecione um beneficiario"
                    emptyMessage="Nenhum beneficiario encontrado."
                    options={beneficiaryOptions}
                    onChange={setBeneficiaryId}
                    renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />}
                    labelClassName={FIELD_LABEL_CLASS}
                />

                <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className={FIELD_LABEL_CLASS}>Descricao</span>
                    <input className={FIELD_INPUT_CLASS} placeholder="Descricao da compra" value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <p className={FIELD_LABEL_CLASS}>Tags</p>
                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-2.5">
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => {
                                const selected = selectedTagIds.includes(tag.id);
                                return (
                                    <button
                                        type="button"
                                        key={tag.id}
                                        onClick={() => toggleTag(tag.id)}
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
                </div>
            </section>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {isEditing && (
                        <>
                            <button
                                type="button"
                                onClick={() => void runAction(remove)}
                                disabled={submitting}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-200 transition-colors hover:border-red-400/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Excluir transacao"
                                title="Excluir transacao"
                            >
                                <Trash2 size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => void runAction(duplicate)}
                                disabled={submitting}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Duplicar transacao"
                                title="Duplicar transacao"
                            >
                                <Copy size={15} />
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
                        onClick={() => void runAction(submit)}
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
