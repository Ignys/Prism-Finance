import { buildCardInvoiceOptions, formatMonthLabel, shiftCycleKey } from "./cardInvoiceOptions";
import { InvoiceOptionContent } from "./InvoiceOptionContent";
import { occurrenceId } from "../../context/finance/recurrence/projectOccurrences";
import { TransactionModeField } from "./TransactionModeField";
import { defaultInvoiceOption, filterInvoiceOption } from "./invoiceSelection";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, SquareSlash, Tags, Trash2, X } from "lucide-react";
import type { Category, Transaction, TransactionMode, TransactionSeriesScope, TransactionStatus } from "../../context/FinanceContext";
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
import { buildCreditCardInvoiceId, getCreditCardInvoiceMonthKey, parseCreditCardInvoiceId, resolveCreditCardInvoiceCycle, resolveCreditCardInvoiceCycleFromCycleKey } from "../../context/financeTypes";
import { createId, findCurrentUserSelfBeneficiary, roundToCents, splitAmountAcrossInstallments } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { getLocalTodayDate } from "../../lib/localDate";
import { AnimatedTransactionFormPanel } from "./AnimatedTransactionFormPanel";
import { DateField } from "./DateField";
import { DescriptionAutocomplete } from "./DescriptionAutocomplete";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { SingleSelectCombobox } from "./SingleSelectCombobox";
import { TransactionDetailsField } from "./TransactionDetailsField";
import { TransactionFieldIcon } from "./TransactionFieldIcon";
import type { TransactionFormTab } from "./TransactionFormTabs";
import { FIELD_ICON_TRIGGER_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { getTransactionSubmitErrorMessage } from "./transactionSubmitError";
import { FooterButton } from "./TransactionForm";
import { useTransactionDetails } from "./useTransactionDetails";
import {
    BeneficiaryOptionContent,
    CategoryOptionContent,
    CreditCardOptionContent,
    EDIT_SCOPE_OPTIONS,
    EditScopeOptionContent,
    EditScopeSelectedContent,
    TagOptionContent,
    type BeneficiaryOption,
    type CategoryOption,
    type CreditCardOption,
    type TagOption,
} from "./CardSpendingOptions";
import { InstallmentPreviewModal, type InstallmentPreviewData, type InstallmentPreviewRow } from "./InstallmentPreviewModal";
import { CardCommitmentField } from "./CardCommitmentField";

interface CardSpendingFormProps {
    transaction?: Transaction | null;
    prefill?: CardSpendingFormPrefill;
    activeTab: TransactionFormTab;
    onInstallmentPreviewOpenChange?: (isOpen: boolean) => void;
}

export interface CardSpendingFormPrefill {
    initialCreditCardId?: string;
    initialInvoiceId?: string;
    initialCycleKey?: string;
    initialDate?: string;
    initialValues?: Pick<Transaction, "value" | "description" | "category" | "beneficiaryId" | "tagIds">;
}

const DATE_SHORTCUTS = [
    { label: "Hoje", offsetInDays: 0 },
    { label: "Ontem", offsetInDays: -1 },
];

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function normalizeIgnoredInstallmentsCountInput(value: string, installmentCount: number | null): number {
    if (!installmentCount || installmentCount < 2) {
        return 0;
    }

    const parsedValue = Number(value);
    const safeValue = Number.isFinite(parsedValue) ? Math.floor(parsedValue) : 0;
    return Math.max(0, Math.min(installmentCount - 1, safeValue));
}

export function CardSpendingForm({ transaction = null, prefill, activeTab, onInstallmentPreviewOpenChange }: CardSpendingFormProps) {
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
    const [submitError, setSubmitError] = useState("");
    const [installmentPreviewOpen, setInstallmentPreviewOpen] = useState(false);
    const [draftTransactionId] = useState(() => createId("tx"));
    const [transactionSaved, setTransactionSaved] = useState(false);
    const financialFieldsDisabled = submitting || transactionSaved;
    const [amountInput, setAmountInputState] = useState(() => formatAmountInputFromValue(transaction?.value ?? prefill?.initialValues?.value ?? 0));
    const [description, setDescription] = useState(transaction?.description ?? prefill?.initialValues?.description ?? "");
    const [date, setDate] = useState(transaction?.date ?? (initialPrefillDate || getLocalTodayDate()));
    const [creditCardId, setCreditCardId] = useState(transaction?.creditCardId ?? (initialPrefillCreditCardId || favoriteCreditCardId || ""));
    const [invoiceId, setInvoiceId] = useState(transaction?.invoiceId ?? initialPrefillInvoiceId);
    const [commitment, setCommitment] = useState<"forecast" | "posted">(transaction?.commitment ?? "posted");
    const [categoryId, setCategoryId] = useState(transaction?.category.id ?? prefill?.initialValues?.category.id ?? "");
    const [beneficiaryId, setBeneficiaryId] = useState(transaction?.beneficiaryId ?? prefill?.initialValues?.beneficiaryId ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? prefill?.initialValues?.tagIds ?? []);
    const [recurrenceCountInput, setRecurrenceCountInput] = useState(() => sourceGroup?.recurrenceRule?.end.type === "count" ? String(sourceGroup.recurrenceRule.end.count) : "");
    const [spendingMode, setSpendingMode] = useState<TransactionMode>(() => sourceGroup?.transactionMode ?? "single");
    const [installmentCountInput, setInstallmentCountInput] = useState(() =>
        sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2",
    );
    const [ignoredInstallmentsCountInput, setIgnoredInstallmentsCountInput] = useState(() => (sourceGroup?.transactionMode === "installment" ? String(leadingSkippedInstallmentsCount) : "0"));
    const [editScope, setEditScope] = useState<TransactionSeriesScope>("single");
    const isFutureRecurringOccurrence = spendingMode === "recurring" && date > getLocalTodayDate();
    const details = useTransactionDetails({ transactionId: transaction?.id ?? (spendingMode === "recurring" ? occurrenceId(`group-${draftTransactionId}`, 1) : draftTransactionId), userId: user?.uid, loadExisting: isEditing });
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
        setCommitment(transaction.commitment ?? "posted");
        previousDateRef.current = transaction.date ?? getLocalTodayDate();
        setCategoryId(transaction.category.id ?? "");
        setBeneficiaryId(transaction.beneficiaryId ?? "");
        setSelectedTagIds(transaction.tagIds ?? []);
        setSpendingMode(sourceGroup?.transactionMode ?? "single");
        setInstallmentCountInput(sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2");
        setIgnoredInstallmentsCountInput(sourceGroup?.transactionMode === "installment" ? String(leadingSkippedInstallmentsCount) : "0");
        setEditScope("single");
    }, [favoriteCreditCardId, leadingSkippedInstallmentsCount, sourceGroup?.installmentCount, sourceGroup?.transactionMode, transaction?.id]);

    useEffect(() => {
        onInstallmentPreviewOpenChange?.(installmentPreviewOpen);
    }, [installmentPreviewOpen, onInstallmentPreviewOpenChange]);

    useEffect(() => {
        return () => onInstallmentPreviewOpenChange?.(false);
    }, [onInstallmentPreviewOpenChange]);

    useEffect(() => {
        if (isFutureRecurringOccurrence && (!transaction || transaction.date !== date)) setCommitment("forecast");
    }, [date, isFutureRecurringOccurrence, transaction]);

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

    const invoiceOptions = useMemo(() => buildCardInvoiceOptions(selectedCard, creditCardInvoices, [
        openCycle?.cycleKey ?? "", automaticCycle?.cycleKey ?? "",
        ...Array.from({ length: 5 }, (_, offset) => anchorCycleKey ? shiftCycleKey(anchorCycleKey, offset) : ""),
    ]), [anchorCycleKey, automaticCycle?.cycleKey, creditCardInvoices, openCycle?.cycleKey, selectedCard]);

    const automaticInvoiceId = useMemo(() => {
        if (!selectedCard || !automaticCycle?.cycleKey) {
            return "";
        }

        const option = invoiceOptions.find((item) => item.cycleKey === automaticCycle.cycleKey);
        return option && (!option.disabled || option.id === transaction?.invoiceId) ? option.id : "";
    }, [automaticCycle?.cycleKey, invoiceOptions, selectedCard, transaction?.invoiceId]);

    const previousDateRef = useRef(date);

    useEffect(() => {
        if (previousDateRef.current === date) {
            return;
        }
        previousDateRef.current = date;
        if (automaticInvoiceId) {
            setInvoiceId(automaticInvoiceId);
        }
    }, [automaticInvoiceId, date]);
    const selectedResolvedInvoiceOption = useMemo(() => invoiceOptions.find((option) => option.id === invoiceId) ?? null, [invoiceOptions, invoiceId]);
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
        if (invoiceOptions.some((option) => option.id === invoiceId && (option.invoice.status !== "paid" || option.id === transaction?.invoiceId))) {
            return;
        }
        const preferred = defaultInvoiceOption(invoiceOptions, preferredPrefillInvoiceId);
        const openOption = invoiceOptions.find((option) => option.visualStatus === "open");
        setInvoiceId((preferredPrefillInvoiceId ? preferred : openOption ?? preferred)?.invoice.id ?? "");
    }, [invoiceId, invoiceOptions, preferredPrefillInvoiceId, transaction?.invoiceId]);

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
    const descriptionSuggestionCategoryIds = useMemo(() => categoryOptions.map((option) => option.categoryId), [categoryOptions]);

    const handleCategorySelect = (optionId: string) => {
        const selectedOption = categoryOptions.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }
        setCategoryId(selectedOption.categoryId);
    };

    const handleDescriptionSuggestionSelect = (suggestion: Transaction) => {
        const selectedOption = categoryOptions.find((option) => option.categoryId === suggestion.category.id);
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
        if (requiresInvoiceSelection && (!invoiceId || !selectedInvoiceOption)) {
            return null;
        }

        const resolvedStatus: TransactionStatus = transaction?.status ?? "pending";
        const finalStatus = statusOverride ?? resolvedStatus;
        const parsedInstallmentCount = Number(installmentCountInput);
        const resolvedInstallmentCount = resolvedMode === "installment" && Number.isInteger(parsedInstallmentCount) && parsedInstallmentCount >= 2 ? parsedInstallmentCount : null;
        const resolvedIgnoredInstallmentsCount = resolvedMode === "installment" ? normalizeIgnoredInstallmentsCountInput(ignoredInstallmentsCountInput, resolvedInstallmentCount) : null;

        return {
            id: transaction ? undefined : spendingMode === "recurring" ? occurrenceId(`group-${draftTransactionId}`, 1) : draftTransactionId,
            groupId: !transaction && spendingMode === "recurring" ? `group-${draftTransactionId}` : undefined,
            type: "spending" as const,
            value: numericValue,
            date: date || getLocalTodayDate(),
            inWallet: selectedCard.bankWalletId ?? "default",
            paymentMethod: "credit_card" as const,
            creditCardId: selectedCard.id,
            // Keep the invoice chosen in the form. Recurrence controls future
            // occurrences, but must not reroute this charge by date.
            invoiceId: selectedInvoiceOption?.invoice.id ?? transaction?.invoiceId ?? null,
            commitment,
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
                          frequency: "monthly" as const,
                          end: recurrenceCountInput ? { type: "count" as const, count: Number(recurrenceCountInput) } : sourceGroup?.recurrenceRule?.end.type === "until" ? sourceGroup.recurrenceRule.end : { type: "never" as const },
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

        await addTransaction(duplicateTransactionDraft(draft));
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

    const runAction = async (action: () => Promise<boolean>, persistDetails = false) => {
        if (submitting) {
            return;
        }

        setSubmitting(true);
        setSubmitError("");

        try {
            if (!transactionSaved) {
                const success = await action();
                if (!success) {
                    setSubmitting(false);
                    return;
                }
            }

            if (persistDetails) {
                try {
                    await details.commit();
                } catch (detailsError) {
                    console.error("Failed to save card spending details:", detailsError);
                    setTransactionSaved(true);
                    setSubmitError("O gasto foi salvo, mas a anotação ou os anexos não. Tente novamente para concluir os detalhes.");
                    setSubmitting(false);
                    return;
                }
            }

            closeModal();
            return;
        } catch (error) {
            console.error("Failed to submit card spending form:", error);
            setSubmitError(getTransactionSubmitErrorMessage(error));
        }

        setSubmitting(false);
    };

    return (
        <>
            {installmentPreviewOpen && installmentPreviewData && <InstallmentPreviewModal data={installmentPreviewData} onClose={() => setInstallmentPreviewOpen(false)} />}
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                    <header className="flex shrink-0 items-center justify-between">
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

                    {submitError && <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{submitError}</p>}

                    <div className="mt-3 min-h-0 flex-1">
                        <AnimatedTransactionFormPanel activeTab={activeTab}>
                            {activeTab === "simple" ? (
                        <section className="flex flex-col gap-3" role="tabpanel" aria-label="Dados simples">
                            <input
                                className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24] disabled:cursor-not-allowed disabled:opacity-65"
                                inputMode="numeric"
                                placeholder="R$ 0,00"
                                value={amountInput}
                                onChange={(event) => setAmountInput(event.target.value)}
                                disabled={financialFieldsDisabled}
                            />
                            <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-3">
                                <CardCommitmentField
                                    value={commitment}
                                    onChange={setCommitment}
                                    disabled={financialFieldsDisabled}
                                    postedDisabled={isFutureRecurringOccurrence}
                                />
                                <DateField hideLabel value={date} onChange={setDate} shortcuts={DATE_SHORTCUTS} disabled={financialFieldsDisabled} />
                                <SingleSelectCombobox
                                    hideLabel
                                    label="Fatura"
                                    value={invoiceId}
                                    placeholder="Selecione uma fatura"
                                    emptyMessage="Nenhuma fatura disponível."
                                    options={invoiceOptions}
                                    filterOption={filterInvoiceOption}
                                    onChange={setInvoiceId}
                                    renderOptionContent={(option) => <InvoiceOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                    disabled={financialFieldsDisabled}
                                />
                            </div>

                            <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-2">
                                <SingleSelectCombobox
                                    hideLabel
                                    label="Cartão"
                                    value={creditCardId}
                                    placeholder="Selecione um cartão"
                                    emptyMessage="Nenhum cartão encontrado."
                                    options={creditCardOptions}
                                    onChange={setCreditCardId}
                                    renderOptionContent={(option) => <CreditCardOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                    disabled={financialFieldsDisabled}
                                />
                                <SingleSelectCombobox
                                    hideLabel
                                    label="Beneficiario"
                                    value={beneficiaryId}
                                    placeholder="Selecione um beneficiario"
                                    emptyMessage="Nenhum beneficiario encontrado."
                                    options={beneficiaryOptions}
                                    onChange={setBeneficiaryId}
                                    renderOptionContent={(option) => <BeneficiaryOptionContent option={option} />}
                                    labelClassName={FIELD_LABEL_CLASS}
                                    disabled={financialFieldsDisabled}
                                />
                            </div>

                            <SingleSelectCombobox
                                hideLabel
                                label="Categoria"
                                value={selectedCategoryOptionId}
                                placeholder="Selecione uma categoria"
                                emptyMessage="Nenhuma categoria disponível."
                                options={categoryOptions}
                                onChange={handleCategorySelect}
                                renderOptionContent={(option) => <CategoryOptionContent option={option} />}
                                labelClassName={FIELD_LABEL_CLASS}
                                disabled={financialFieldsDisabled}
                            />

                            <DescriptionAutocomplete
                                value={description}
                                onChange={setDescription}
                                onSuggestionSelect={handleDescriptionSuggestionSelect}
                                transactions={transactions}
                                type="spending"
                                allowedCategoryIds={descriptionSuggestionCategoryIds}
                                excludeTransactionId={transaction?.id}
                                disabled={financialFieldsDisabled}
                            />
                            {isEditing && isSeriesTransaction ? (
                                <SingleSelectCombobox
                                    disableSearch
                                    label="Aplicar edição em"
                                    value={editScope}
                                    placeholder="Selecione um escopo"
                                    emptyMessage="Nenhum escopo encontrado."
                                    options={EDIT_SCOPE_OPTIONS}
                                    onChange={(value) => setEditScope(value === "all" || value === "this_and_next" ? value : "single")}
                                    renderOptionContent={(option) => <EditScopeOptionContent option={option} />}
                                    renderSelectedContent={(option) => <EditScopeSelectedContent option={option} />}
                                    disabled={financialFieldsDisabled}
                                    labelClassName={FIELD_LABEL_CLASS}
                                />
                            ) : null}
                        </section>

                        ) : (
                            <section className="flex flex-col gap-3" role="tabpanel" aria-label="Opções avançadas">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <MultiSelectCombobox
                                        hideLabel
                                        leadingIcon={<TransactionFieldIcon icon={Tags} />}
                                        triggerClassName={FIELD_ICON_TRIGGER_CLASS}
                                        label="Tags"
                                        values={selectedTagIds}
                                        placeholder="Nenhuma tag selecionada"
                                        emptyMessage="Nenhuma tag cadastrada."
                                        options={tagOptions}
                                        onChange={setSelectedTagIds}
                                        renderOptionContent={(option) => <TagOptionContent option={option} />}
                                        labelClassName={FIELD_LABEL_CLASS}
                                        disabled={financialFieldsDisabled}
                                    />
                                    <div>
                                        <TransactionModeField mode={spendingMode} installmentCountInput={installmentCountInput} onModeChange={setSpendingMode} onInstallmentCountChange={setInstallmentCountInput} recurrenceCountInput={recurrenceCountInput} onRecurrenceCountChange={setRecurrenceCountInput} hideInstallmentCount disabled={financialFieldsDisabled} />
                                        {spendingMode === "installment" && (
                                                <div className="mx-0.5 flex flex-col gap-2 rounded-b border-x border-b border-dashed border-white/10 bg-black/20 px-3 py-3">
                                                    <label className="flex items-center justify-between gap-3">
                                                        <span className="text-[11px] uppercase tracking-[0.08em] text-white/50">Parcelas ignoradas</span>
                                                        <input
                                                            className="w-24 rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors focus:border-white/[0.24]"
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
                                                            disabled={financialFieldsDisabled}
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-3">
                                                        <span className="text-[11px] uppercase tracking-[0.08em] text-white/50">Quantidade de parcelas</span>
                                                        <input
                                                            className="w-24 rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none transition-colors focus:border-white/[0.24]"
                                                            type="number"
                                                            min={2}
                                                            step={1}
                                                            value={installmentCountInput}
                                                            onChange={(event) => setInstallmentCountInput(event.target.value)}
                                                            disabled={financialFieldsDisabled}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setInstallmentPreviewOpen(true)}
                                                        disabled={financialFieldsDisabled || !installmentPreviewData}
                                                        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        <Eye size={13} />
                                                        Pré-visualizar
                                                    </button>
                                                </div>
                                        )}
                                    </div>
                                </div>
                                <div className="h-px bg-white/[0.06]" />
                                <TransactionDetailsField details={details} disabled={submitting} />
                            </section>
                        )}
                        </AnimatedTransactionFormPanel>
                    </div>

                <footer className="mt-4 flex shrink-0 flex-col gap-3 border-t border-white/[0.06] pt-4">
                    <div className="flex justify-between">
                        <div className="flex gap-1">
                            {isEditing && (
                                <>
                                    <FooterButton onClick={() => void runAction(remove)} disabled={submitting || transactionSaved}>
                                        <Trash2 size={15} /> Excluir
                                    </FooterButton>
                                    <FooterButton onClick={() => void runAction(duplicate)} disabled={submitting || transactionSaved}>
                                        <Copy size={15} /> Duplicar
                                    </FooterButton>
                                    <FooterButton onClick={() => void runAction(ignore, true)} disabled={submitting || transactionSaved}>
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
                                onClick={() => void runAction(submit, true)}
                                disabled={submitting}
                                className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? "Salvando..." : transactionSaved ? "Salvar detalhes" : "Salvar e fechar"}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
import { duplicateTransactionDraft } from "./duplicateTransactionDraft";
