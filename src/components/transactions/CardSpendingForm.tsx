import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Eye, Info, Layers3, ReceiptText, Repeat, SlidersHorizontal, SquareSlash, Trash2, X } from "lucide-react";
import type { Beneficiary, Category, CreditCard, CreditCardInvoice, Transaction, TransactionMode, TransactionSeriesScope, TransactionStatus } from "../../context/FinanceContext";
import {
    SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID,
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceFavoriteCreditCard,
    useFinanceSession,
    useFinanceTags,
    useFinanceTransactions,
    useFinanceTransactionGroups,
} from "../../context/FinanceContext";
import { getCreditCardInvoiceReadState, type CreditCardInvoiceVisualStatus } from "../../context/finance/invoiceStatus";
import { buildCreditCardInvoiceId, getCreditCardInvoiceMonthKey, parseCreditCardInvoiceId, resolveCreditCardInvoiceCycle, resolveCreditCardInvoiceCycleFromCycleKey } from "../../context/financeTypes";
import { findCurrentUserSelfBeneficiary, roundToCents, splitAmountAcrossInstallments } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { getLocalTodayDate } from "../../lib/localDate";
import { BeneficiaryAvatar } from "../common/BeneficiaryAvatar";
import { WalletAvatar } from "../common/WalletAvatar";
import { DateField } from "./DateField";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { formatCurrencyBRL } from "./transactionView";
import { FooterButton } from "./TransactionForm";

const FIELD_INPUT_CLASS = "rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]";

const INVOICE_STATUS_LABELS: Record<CreditCardInvoiceVisualStatus, string> = {
    open: "Aberta",
    future: "Futura",
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
    onAdvancedOpenChange?: (isOpen: boolean) => void;
    onInstallmentPreviewOpenChange?: (isOpen: boolean) => void;
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
    visualStatus: CreditCardInvoiceVisualStatus;
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

interface TagOption extends ComboboxOptionBase {
    color: string | null;
}

interface SpendingModeOption extends ComboboxOptionBase {
    mode: TransactionMode;
    icon: typeof ReceiptText;
}

interface EditScopeOption extends ComboboxOptionBase {
    scope: TransactionSeriesScope;
    icon: typeof ReceiptText;
}

interface InstallmentPreviewRow {
    installmentNumber: number;
    cycleKey: string;
    monthLabel: string;
    amount: number;
    ignored: boolean;
}

interface InstallmentPreviewData {
    rows: InstallmentPreviewRow[];
    installmentCount: number;
    ignoredInstallmentsCount: number;
    totalAmount: number;
    effectiveTotalAmount: number;
    startMonthLabel: string;
}

const SPENDING_MODE_OPTIONS: SpendingModeOption[] = [
    {
        id: "single",
        label: "Unica",
        searchText: "unica unica avulsa single",
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
    {
        id: "installment",
        label: "Parcelada",
        searchText: "parcelada parcelas installment",
        mode: "installment",
        icon: Copy,
    },
];

const EDIT_SCOPE_OPTIONS: EditScopeOption[] = [
    {
        id: "single",
        label: "Apenas essa transação",
        searchText: "so esta ocorrencia single",
        scope: "single",
        icon: ReceiptText,
    },
    {
        id: "this_and_next",
        label: "Essa e as próximas transações",
        searchText: "esta e proximas this and next",
        scope: "this_and_next",
        icon: ArrowRight,
    },
    {
        id: "all",
        label: "Todas as transações",
        searchText: "toda a serie all",
        scope: "all",
        icon: Layers3,
    },
];

const DATE_SHORTCUTS = [
    { label: "Hoje", offsetInDays: 0 },
    { label: "Ontem", offsetInDays: -1 },
];

function CreditCardOptionContent({ option }: { option: CreditCardOption }) {
    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.creditCard} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function InvoiceOptionContent({ option }: { option: InvoiceOption }) {
    const statusClassNameByStatus: Record<CreditCardInvoiceVisualStatus, string> = {
        open: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
        future: "border-violet-300/35 bg-violet-500/15 text-violet-100",
        closed: "border-amber-400/30 bg-amber-500/15 text-amber-100",
        overdue: "border-red-400/35 bg-red-500/15 text-red-100",
        paid: "border-sky-400/30 bg-sky-500/15 text-sky-100",
    };

    return (
        <div className="flex min-w-0 items-center justify-between gap-2 ">
            <div className="min-w-0">
                <p className="truncate text-sm text-white">{option.monthLabel}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${statusClassNameByStatus[option.visualStatus]}`}>
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
            <BeneficiaryAvatar beneficiary={option.beneficiary} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function TagOptionContent({ option }: { option: TagOption }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color ?? "#64748B" }} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

function SpendingModeOptionContent({ option }: { option: SpendingModeOption }) {
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

function normalizeIgnoredInstallmentsCountInput(value: string, installmentCount: number | null): number {
    if (!installmentCount || installmentCount < 2) {
        return 0;
    }

    const parsedValue = Number(value);
    const safeValue = Number.isFinite(parsedValue) ? Math.floor(parsedValue) : 0;
    return Math.max(0, Math.min(installmentCount - 1, safeValue));
}

function formatPreviewCurrency(value: number): string {
    return `R$ ${formatCurrencyBRL(value)}`;
}

function InstallmentPreviewModal({ data, onClose }: { data: InstallmentPreviewData; onClose: () => void }) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 py-6 text-white" role="dialog" aria-modal="true" aria-labelledby="installment-preview-title">
            <button type="button" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" aria-label="Fechar preview de parcelas" onMouseDown={onClose} />
            <div
                className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#151515] shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Preview</p>
                        <h2 id="installment-preview-title" className="mt-1 text-lg font-semibold text-white">
                            Parcelamento previsto
                        </h2>
                        <p className="mt-1 text-sm text-white/55">
                            Comecando em {data.startMonthLabel}, com {data.installmentCount} parcelas.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                        aria-label="Fechar preview"
                    >
                        <X size={15} />
                    </button>
                </header>

                <div className="overflow-auto px-5 py-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Total parcelado</p>
                            <p className="mt-1 font-semibold text-white">{formatPreviewCurrency(data.totalAmount)}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/55">Entra nas faturas</p>
                            <p className="mt-1 font-semibold text-emerald-100">{formatPreviewCurrency(data.effectiveTotalAmount)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-400/20 bg-slate-500/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-100/55">Ignoradas</p>
                            <p className="mt-1 font-semibold text-slate-100">{data.ignoredInstallmentsCount}</p>
                        </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
                        <div className="max-h-[42vh] overflow-auto">
                            <table className="min-w-full divide-y divide-white/[0.06] text-sm">
                                <thead className="sticky top-0 bg-[#1b1b1b] text-[10px] uppercase tracking-[0.12em] text-white/45">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Parcela</th>
                                        <th className="px-3 py-2 text-left font-medium">Mes</th>
                                        <th className="px-3 py-2 text-right font-medium">Valor</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05] bg-black/10">
                                    {data.rows.map((row) => (
                                        <tr key={`${row.cycleKey}-${row.installmentNumber}`} className={row.ignored ? "text-white/60" : "text-white/90"}>
                                            <td className="whitespace-nowrap px-3 py-2">
                                                {row.installmentNumber}/{data.installmentCount}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col">
                                                    <span>{row.monthLabel}</span>
                                                    <span className="text-[10px] uppercase tracking-[0.08em] text-white/35">{row.cycleKey}</span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatPreviewCurrency(row.amount)}</td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                                                        row.ignored
                                                            ? "border-slate-400/25 bg-slate-500/10 text-slate-200"
                                                            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                                    }`}
                                                >
                                                    {row.ignored ? "Ignorada" : "Entra na fatura"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-white/45">
                        Parcelas ignoradas mantem o valor original no historico, mas nao entram no total da fatura.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function CardSpendingForm({ transaction = null, prefill, onAdvancedOpenChange, onInstallmentPreviewOpenChange }: CardSpendingFormProps) {
    const { closeModal } = useModal();
    const { addTransaction, deleteTransactionWithScope, updateTransaction } = useFinanceActions();
    const creditCards = useFinanceCreditCards();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactionGroups = useFinanceTransactionGroups();
    const transactions = useFinanceTransactions();
    const categories = useFinanceCategories();
    const { user } = useFinanceSession();
    const beneficiaries = useFinanceBeneficiaries();
    const allTags = useFinanceTags();
    const isEditing = Boolean(transaction);
    const sourceGroup = useMemo(() => (transaction ? (transactionGroups.find((item) => item.id === transaction.groupId) ?? null) : null), [transaction, transactionGroups]);
    const isSeriesTransaction = Boolean(sourceGroup && sourceGroup.transactionMode !== "single");
    const initialPrefillInvoiceId = !isEditing ? (prefill?.initialInvoiceId?.trim() ?? "") : "";
    const parsedInitialPrefillInvoice = !isEditing && initialPrefillInvoiceId ? parseCreditCardInvoiceId(initialPrefillInvoiceId) : null;
    const initialPrefillCreditCardId = !isEditing ? prefill?.initialCreditCardId?.trim() || parsedInitialPrefillInvoice?.creditCardId || "" : "";
    const initialPrefillDate = !isEditing ? (prefill?.initialDate?.trim() ?? "") : "";
    const leadingSkippedInstallmentsCount = useMemo(() => {
        if (!sourceGroup || sourceGroup.transactionMode !== "installment") {
            return 0;
        }

        const groupedTransactions = transactions
            .filter((item) => item.groupId === sourceGroup.id)
            .sort((a, b) => {
                const aInstallmentNumber = a.installmentNumber ?? Number.MAX_SAFE_INTEGER;
                const bInstallmentNumber = b.installmentNumber ?? Number.MAX_SAFE_INTEGER;
                if (aInstallmentNumber !== bInstallmentNumber) {
                    return aInstallmentNumber - bInstallmentNumber;
                }
                if (a.date === b.date) {
                    return a.meta.criado_em.localeCompare(b.meta.criado_em);
                }
                return a.date.localeCompare(b.date);
            });

        let skippedCount = 0;
        for (const groupedTransaction of groupedTransactions) {
            if (groupedTransaction.status !== "skipped") {
                break;
            }
            skippedCount += 1;
        }

        return skippedCount;
    }, [sourceGroup, transactions]);

    const [submitting, setSubmitting] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [installmentPreviewOpen, setInstallmentPreviewOpen] = useState(false);
    const [amountInput, setAmountInputState] = useState(() => (transaction ? formatAmountInputFromValue(transaction.value) : "R$ 0,00"));
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [date, setDate] = useState(transaction?.date ?? (initialPrefillDate || getLocalTodayDate()));
    const [creditCardId, setCreditCardId] = useState(transaction?.creditCardId ?? (initialPrefillCreditCardId || favoriteCreditCardId || ""));
    const [invoiceId, setInvoiceId] = useState(transaction?.invoiceId ?? initialPrefillInvoiceId);
    const [useInvoiceFromDate, setUseInvoiceFromDate] = useState(false);
    const [categoryId, setCategoryId] = useState(transaction?.category.id ?? "");
    const [beneficiaryId, setBeneficiaryId] = useState(transaction?.beneficiaryId ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? []);
    const [spendingMode, setSpendingMode] = useState<TransactionMode>(() => sourceGroup?.transactionMode ?? "single");
    const [installmentCountInput, setInstallmentCountInput] = useState(() =>
        sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2",
    );
    const [ignoredInstallmentsCountInput, setIgnoredInstallmentsCountInput] = useState(() => (sourceGroup?.transactionMode === "installment" ? String(leadingSkippedInstallmentsCount) : "0"));
    const [editScope, setEditScope] = useState<TransactionSeriesScope>("single");
    const activeCreditCards = useMemo(() => creditCards.filter((card) => card.isActive), [creditCards]);
    const selectableCreditCards = useMemo(() => creditCards.filter((card) => card.isActive || (isEditing && card.id === creditCardId)), [creditCardId, creditCards, isEditing]);

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
        setUseInvoiceFromDate(false);
        setCategoryId(transaction.category.id ?? "");
        setBeneficiaryId(transaction.beneficiaryId ?? "");
        setSelectedTagIds(transaction.tagIds ?? []);
        setSpendingMode(sourceGroup?.transactionMode ?? "single");
        setInstallmentCountInput(sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2");
        setIgnoredInstallmentsCountInput(sourceGroup?.transactionMode === "installment" ? String(leadingSkippedInstallmentsCount) : "0");
        setEditScope("single");
    }, [favoriteCreditCardId, leadingSkippedInstallmentsCount, sourceGroup?.installmentCount, sourceGroup?.transactionMode, transaction?.id]);

    useEffect(() => {
        onAdvancedOpenChange?.(advancedOpen);
    }, [advancedOpen, onAdvancedOpenChange]);

    useEffect(() => {
        onInstallmentPreviewOpenChange?.(installmentPreviewOpen);
    }, [installmentPreviewOpen, onInstallmentPreviewOpenChange]);

    useEffect(() => {
        return () => onInstallmentPreviewOpenChange?.(false);
    }, [onInstallmentPreviewOpenChange]);

    useEffect(() => {
        const fallbackCardId =
            activeCreditCards.find((card) => card.id === favoriteCreditCardId)?.id ??
            activeCreditCards[0]?.id ??
            (isEditing ? (creditCards.find((card) => card.id === favoriteCreditCardId)?.id ?? creditCards[0]?.id ?? "") : "");
        if (!selectableCreditCards.some((card) => card.id === creditCardId)) {
            setCreditCardId(fallbackCardId);
            return;
        }

        if (!isEditing && creditCards.some((card) => card.id === creditCardId && !card.isActive)) {
            setCreditCardId(fallbackCardId);
        }
    }, [activeCreditCards, creditCardId, creditCards, favoriteCreditCardId, isEditing, selectableCreditCards]);

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
        const expenseCategories = categories.filter(
            (item) => item.type === "expense" && item.id !== SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && (item.isActive || selectedCategoryIdsToKeep.has(item.id)),
        );
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
        const defaultBeneficiary = findCurrentUserSelfBeneficiary(beneficiaries, user?.uid) ?? beneficiaries.find((item) => item.isActive) ?? beneficiaries[0];
        if (!defaultBeneficiary) {
            setBeneficiaryId("");
            return;
        }
        if (!beneficiaries.some((item) => item.id === beneficiaryId)) {
            setBeneficiaryId(defaultBeneficiary.id);
        }
    }, [beneficiaries, beneficiaryId, user?.uid]);

    const selectedCard = useMemo(() => selectableCreditCards.find((card) => card.id === creditCardId) ?? null, [creditCardId, selectableCreditCards]);
    const openCycle = useMemo(() => (selectedCard ? resolveCreditCardInvoiceCycle(getLocalTodayDate(), selectedCard.closingDay, selectedCard.dueDay) : null), [selectedCard]);
    const automaticCycle = useMemo(() => {
        if (!selectedCard) {
            return null;
        }

        return resolveCreditCardInvoiceCycle(date || getLocalTodayDate(), selectedCard.closingDay, selectedCard.dueDay);
    }, [date, selectedCard]);
    const prefillInvoiceId = !isEditing ? (prefill?.initialInvoiceId?.trim() ?? "") : "";
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

        if (automaticCycle?.cycleKey) {
            ensureSyntheticInvoice(automaticCycle.cycleKey);
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
                const visualStatus = getCreditCardInvoiceReadState(invoice, selectedCard).visualStatus;
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
    }, [anchorCycleKey, automaticCycle?.cycleKey, creditCardInvoices, openCycle, selectedCard]);

    const automaticInvoiceId = useMemo(() => {
        if (!selectedCard || !automaticCycle?.cycleKey) {
            return "";
        }

        return buildCreditCardInvoiceId(selectedCard.id, automaticCycle.cycleKey);
    }, [automaticCycle?.cycleKey, selectedCard]);

    const resolvedInvoiceSelectionId = useInvoiceFromDate ? automaticInvoiceId : invoiceId;
    const selectedResolvedInvoiceOption = useMemo(() => invoiceOptions.find((option) => option.id === resolvedInvoiceSelectionId) ?? null, [invoiceOptions, resolvedInvoiceSelectionId]);
    const installmentPreviewData = useMemo<InstallmentPreviewData | null>(() => {
        if (spendingMode !== "installment" || !selectedCard || !selectedResolvedInvoiceOption) {
            return null;
        }

        const parsedInstallmentCount = Number(installmentCountInput);
        const installmentCount = Number.isInteger(parsedInstallmentCount) && parsedInstallmentCount >= 2 ? parsedInstallmentCount : null;
        if (!installmentCount || !Number.isFinite(amountValue) || amountValue <= 0) {
            return null;
        }

        const ignoredInstallmentsCount = normalizeIgnoredInstallmentsCountInput(ignoredInstallmentsCountInput, installmentCount);
        const installmentAmounts = splitAmountAcrossInstallments(amountValue, installmentCount);
        const rows = installmentAmounts.map<InstallmentPreviewRow>((installmentAmount, index) => {
            const cycleKey = shiftCycleKey(selectedResolvedInvoiceOption.cycleKey, index);
            const cycle = cycleKey ? resolveCreditCardInvoiceCycleFromCycleKey(cycleKey, selectedCard.closingDay, selectedCard.dueDay) : null;
            const monthKey = cycle ? getCreditCardInvoiceMonthKey({ dueDate: cycle.dueDate }) : cycleKey;

            return {
                installmentNumber: index + 1,
                cycleKey,
                monthLabel: monthKey ? formatMonthLabel(monthKey) : selectedResolvedInvoiceOption.monthLabel,
                amount: installmentAmount,
                ignored: index < ignoredInstallmentsCount,
            };
        });

        return {
            rows,
            installmentCount,
            ignoredInstallmentsCount,
            totalAmount: roundToCents(rows.reduce((sum, row) => sum + row.amount, 0)),
            effectiveTotalAmount: roundToCents(rows.reduce((sum, row) => sum + (row.ignored ? 0 : row.amount), 0)),
            startMonthLabel: selectedResolvedInvoiceOption.monthLabel,
        };
    }, [amountValue, ignoredInstallmentsCountInput, installmentCountInput, selectedCard, selectedResolvedInvoiceOption, spendingMode]);

    useEffect(() => {
        if (installmentPreviewOpen && !installmentPreviewData) {
            setInstallmentPreviewOpen(false);
        }
    }, [installmentPreviewData, installmentPreviewOpen]);

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
            selectableCreditCards.map((card) => ({
                id: card.id,
                label: card.name,
                searchText: card.name,
                creditCard: card,
            })),
        [selectableCreditCards],
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
    const tagOptions = useMemo<TagOption[]>(
        () =>
            tags.map((tag) => ({
                id: tag.id,
                label: tag.name,
                searchText: tag.name,
                color: tag.color ?? null,
            })),
        [tags],
    );

    const setAmountInput = (value: string) => {
        const digits = extractCurrencyDigits(value);
        setAmountInputState(formatCurrencyFromDigits(digits));
    };

    const buildDraft = (statusOverride?: TransactionStatus) => {
        const numericValue = amountValue;
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return null;
        }
        const trimmedDescription = description.trim();

        if (!selectedCard) {
            return null;
        }

        const resolvedMode: TransactionMode = spendingMode === "installment" ? "installment" : spendingMode === "recurring" ? "recurring" : "single";
        const requiresInvoiceSelection = resolvedMode === "single" || resolvedMode === "installment";
        const selectedInvoiceOption = selectedResolvedInvoiceOption;
        if (requiresInvoiceSelection && (!resolvedInvoiceSelectionId || !selectedInvoiceOption)) {
            return null;
        }

        const resolvedStatus: TransactionStatus =
            resolvedMode === "single" && selectedInvoiceOption ? (selectedInvoiceOption.visualStatus === "open" || selectedInvoiceOption.visualStatus === "future" ? "pending" : "paid") : "pending";
        const finalStatus = statusOverride ?? resolvedStatus;
        const parsedInstallmentCount = Number(installmentCountInput);
        const resolvedInstallmentCount = resolvedMode === "installment" && Number.isInteger(parsedInstallmentCount) && parsedInstallmentCount >= 2 ? parsedInstallmentCount : null;
        const resolvedIgnoredInstallmentsCount = resolvedMode === "installment" ? normalizeIgnoredInstallmentsCountInput(ignoredInstallmentsCountInput, resolvedInstallmentCount) : null;

        return {
            type: "spending" as const,
            value: numericValue,
            date: date || getLocalTodayDate(),
            inWallet: selectedCard.bankWalletId ?? "default",
            paymentMethod: "credit_card" as const,
            creditCardId: selectedCard.id,
            invoiceId: requiresInvoiceSelection && selectedInvoiceOption ? selectedInvoiceOption.invoice.id : null,
            categoryId: categoryId || null,
            beneficiaryId: beneficiaryId || null,
            tagIds: selectedTagIds,
            description: trimmedDescription || "Compra no Cartao",
            status: finalStatus,
            notes: trimmedDescription || undefined,
            transactionMode: resolvedMode,
            installmentCount: resolvedInstallmentCount,
            ignoredInstallmentsCount: resolvedMode === "installment" ? resolvedIgnoredInstallmentsCount : undefined,
            recurrenceRule:
                resolvedMode === "recurring"
                    ? {
                          frequency: "monthly",
                          interval: 1,
                          anchorDate: date || getLocalTodayDate(),
                          amount: Math.abs(numericValue),
                          tagIds: selectedTagIds,
                          excludedDates: [],
                          notes: trimmedDescription || null,
                      }
                    : null,
            recurrenceEndDate: null,
        };
    };

    const submit = async () => {
        const draft = buildDraft();
        if (!draft) {
            return false;
        }

        if (transaction) {
            await updateTransaction({
                transaction,
                draft,
                scope: editScope,
            });
            return true;
        }

        await addTransaction(draft);
        return true;
    };

    const remove = async () => {
        if (!transaction) {
            return false;
        }

        await deleteTransactionWithScope(transaction, editScope);
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
    

    const ignore = async () => {
        if (!transaction) {
            return false;
        }

        const draft = buildDraft("skipped");
        if (!draft) {
            return false;
        }

        await updateTransaction({
            transaction,
            draft,
            scope: editScope,
        });
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

    const invoiceLabelContent = (
        <div className="flex flex-wrap items-center justify-between gap-2 pr-2">
            <span className={FIELD_LABEL_CLASS}>Fatura</span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!selectedCard}
                    onClick={() => setUseInvoiceFromDate((current) => !current)}
                    className={`${FIELD_LABEL_CLASS} inline-flex items-center gap-2 transition-colors`}
                    aria-pressed={useInvoiceFromDate}
                    aria-label="Selecionar fatura pela data"
                >
                    <span
                        className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full border transition-colors ${
                            useInvoiceFromDate ? "border-emerald-300/45 bg-emerald-400/30" : "border-white/[0.14] bg-black/30"
                        }`}
                    >
                        <span
                            className={`inline-flex h-3.5 w-3.5 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform ${
                                useInvoiceFromDate ? "translate-x-4" : "translate-x-0.5"
                            }`}
                        />
                    </span>
                    <span className={FIELD_LABEL_CLASS}>Escolher pela data</span>
                    <div className="group relative">
                        <span className="inline-flex items-center justify-center rounded-ful text-white/55 transition-colors group-hover:border-white/[0.24] group-hover:text-white/80">
                            <Info size={15} />
                        </span>
                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-white/[0.12] bg-[#101010] p-2 text-[11px] normal-case tracking-normal text-white/75 opacity-0 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.95)] transition-opacity group-hover:opacity-100">
                            Quando ativo, a fatura deixa de ser escolhida manualmente e passa a ser calculada pela data do gasto e pelos dias de fechamento e vencimento do cartao.
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {installmentPreviewOpen && installmentPreviewData && <InstallmentPreviewModal data={installmentPreviewData} onClose={() => setInstallmentPreviewOpen(false)} />}
            <div className="rounded-xl flex flex-col justify-between border h-149 border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <div>
                    <header className="flex items-center justify-between">
                        <h1 className="text-sm ml-1 uppercase opacity-50">{isEditing ? (isSeriesTransaction ? "Editando gasto da série" : "Editando gasto no cartão") : "Novo gasto no cartão"}</h1>
                        <div className="flex items-center gap-2">
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
                        </div>
                    </header>

                    <div className={`mt-2 flex justify-between gap-3`}>
                        <section className="flex flex-col gap-3 grow">
                            <label className="flex flex-col gap-1.5">
                                <input
                                    className={
                                        "text-2xl rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]"
                                    }
                                    inputMode="numeric"
                                    placeholder="R$ 0,00"
                                    value={amountInput}
                                    onChange={(event) => setAmountInput(event.target.value)}
                                />
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <DateField value={date} onChange={setDate} shortcuts={DATE_SHORTCUTS} />
                                <SingleSelectCombobox
                                    label="Fatura"
                                    value={resolvedInvoiceSelectionId}
                                    placeholder="Selecione uma fatura"
                                    emptyMessage="Nenhuma fatura disponível."
                                    options={invoiceOptions}
                                    onChange={setInvoiceId}
                                    renderOptionContent={(option) => <InvoiceOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                    labelContent={invoiceLabelContent}
                                    disabled={useInvoiceFromDate}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <SingleSelectCombobox
                                    label="Cartão"
                                    value={creditCardId}
                                    placeholder="Selecione um cartão"
                                    emptyMessage="Nenhum cartão encontrado."
                                    options={creditCardOptions}
                                    onChange={setCreditCardId}
                                    renderOptionContent={(option) => <CreditCardOptionContent option={option} />}
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
                            </div>

                            <SingleSelectCombobox
                                label="Categoria"
                                value={selectedCategoryOptionId}
                                placeholder="Selecione uma categoria"
                                emptyMessage="Nenhuma categoria disponível."
                                options={categoryOptions}
                                onChange={handleCategorySelect}
                                renderOptionContent={(option) => <CategoryOptionContent option={option} />}
                                labelClassName={FIELD_LABEL_CLASS}
                            />

                            <label className="flex flex-col gap-1.5 md:col-span-2">
                                <span className={FIELD_LABEL_CLASS}>Descrição</span>
                                <input className={FIELD_INPUT_CLASS} placeholder="Descrição da transação" value={description} onChange={(event) => setDescription(event.target.value)} />
                            </label>
                        </section>

                        {advancedOpen && (
                            <>
                                <div className="w-px bg-white/5 rounded-full"></div>

                                <aside className="flex flex-col gap-3 w-70">
                                    {isEditing && isSeriesTransaction && (
                                        <label className="flex flex-col gap-1.5">
                                            <SingleSelectCombobox
                                                disableSearch
                                                compactTrigger
                                                label="Editar"
                                                value={editScope}
                                                placeholder="Selecione um escopo"
                                                emptyMessage="Nenhum escopo encontrado."
                                                options={EDIT_SCOPE_OPTIONS}
                                                onChange={(value) => {
                                                    if (value === "all" || value === "this_and_next" || value === "single") {
                                                        setEditScope(value);
                                                        return;
                                                    }

                                                    setEditScope("single");
                                                }}
                                                renderOptionContent={(option) => <EditScopeOptionContent option={option} />}
                                                renderSelectedContent={(option) => <EditScopeSelectedContent option={option} />}
                                                labelClassName={FIELD_LABEL_CLASS}
                                            />
                                        </label>
                                    )}
                                    <MultiSelectCombobox
                                        label={"Tags"}
                                        values={selectedTagIds}
                                        placeholder="Nenhuma tag selecionada"
                                        emptyMessage="Nenhuma tag cadastrada."
                                        options={tagOptions}
                                        onChange={setSelectedTagIds}
                                        renderOptionContent={(option) => <TagOptionContent option={option} />}
                                        labelClassName={FIELD_LABEL_CLASS}
                                    />
                                    <div>
                                        <label className="flex flex-col gap-1.5">
                                            <SingleSelectCombobox
                                                disableSearch
                                                label="Tipo"
                                                value={spendingMode}
                                                placeholder="Selecione um modo"
                                                emptyMessage="Nenhum modo encontrado."
                                                options={SPENDING_MODE_OPTIONS}
                                                onChange={(value) => {
                                                    if (value === "installment" || value === "recurring" || value === "single") {
                                                        setSpendingMode(value);
                                                        return;
                                                    }

                                                    setSpendingMode("single");
                                                }}
                                                renderOptionContent={(option) => <SpendingModeOptionContent option={option} />}
                                                labelClassName={FIELD_LABEL_CLASS}
                                            />
                                        </label>
                                        {spendingMode === "installment" && (
                                            <>
                                                <div className="flex rounded-b flex-col gap-1 bg-black/20 mx-0.5 border-white/10 border-dashed border-x border-b py-4 px-3 ">
                                                    <label className="flex justify-between items-center gap-1.5 ">
                                                        <span className={"text-[12px] text-white/50 uppercase"}>Parcelas <br /> ignoradas</span>
                                                        <input
                                                            className={"w-25 rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]"}
                                                            type="number"
                                                            min={0}
                                                            max={installmentCountInput ? Number(installmentCountInput) - 1 : undefined}
                                                            step={1}
                                                            value={ignoredInstallmentsCountInput}
                                                            onChange={(event) => setIgnoredInstallmentsCountInput(event.target.value)}
                                                            onBlur={() => {
                                                                const parsedInstallmentCount = Number(installmentCountInput);
                                                                const resolvedInstallmentCount =
                                                                    Number.isInteger(parsedInstallmentCount) && parsedInstallmentCount >= 2 ? parsedInstallmentCount : null;
                                                                const normalizedIgnoredCount = normalizeIgnoredInstallmentsCountInput(ignoredInstallmentsCountInput, resolvedInstallmentCount);
                                                                setIgnoredInstallmentsCountInput(String(normalizedIgnoredCount));
                                                            }}
                                                        />
                                                    </label>
                                                    <label className="flex justify-between items-center gap-1.5">
                                                        <span className={"text-[12px] text-white/50 uppercase"}>QUANTIDADE DE PARCELAS</span>
                                                        <input
                                                            className={"w-25 rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]"}
                                                            type="number"
                                                            min={2}
                                                            step={1}
                                                            value={installmentCountInput}
                                                            onChange={(event) => setInstallmentCountInput(event.target.value)}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setInstallmentPreviewOpen(true)}
                                                        disabled={!installmentPreviewData}
                                                        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        <Eye size={13} />
                                                        Pré-visualizar
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
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
                            className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium uppercase tracking-[0.08em]  rounded-full transition-colors duration-150 ${
                                advancedOpen
                                    ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                                    : "border-white/[0.14] bg-white/[0.03] text-white/70 hover:border-white/[0.22] hover:text-white"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            <SlidersHorizontal size={14} />
                            {advancedOpen ? "Esconder opções" : "Mais opções"}
                        </button>
                    </div>
                    <div className="flex justify-between">
                        <div className="flex gap-1">
                            {isEditing && (
                                <>
                                    <FooterButton onClick={() => void runAction(remove)}>
                                        <Trash2 size={15} /> Excluir
                                    </FooterButton>
                                    <FooterButton onClick={() => void runAction(duplicate)}>
                                        <Copy size={15} /> Duplicar
                                    </FooterButton>
                                    <FooterButton onClick={() => void runAction(ignore)}>
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
                                {submitting ? "Carregando..." : "Concluir"}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
