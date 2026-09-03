import { useEffect, useMemo, useState } from "react";
import {
    DEFAULT_WALLET_ID,
    SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID,
    type TransactionMode,
    type TransactionSeriesScope,
    type Transaction,
    type TransactionStatus,
    type TransactionType,
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceFavoriteWallet,
    useFinanceSession,
    useFinanceTags,
    useFinanceTransactionGroups,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { createId, findCurrentUserSelfBeneficiary, normalizeComparisonText } from "../../context/finance/helpers";
import { getLocalDateFromOffset, getLocalTodayDate, parseDateOnlyToLocalDate } from "../../lib/localDate";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";

interface UseTransactionFormOptions {
    type?: TransactionType;
    transaction?: Transaction | null;
    mode?: "default" | "invoice_payment_edit";
    prefill?: {
        initialDate?: string;
        initialAmount?: number;
        initialCategoryId?: string;
        initialDescription?: string;
    };
}

interface CategorySelection {
    rootCategoryId: string;
    subCategoryId: string;
}

export interface TransactionFormState {
    isEditing: boolean;
    isInvoicePaymentEdit: boolean;
    isTransfer: boolean;
    isSeriesTransaction: boolean;
    sourceTransaction: Transaction | null;
    transactionId: string;
    amountInput: string;
    status: TransactionStatus;
    description: string;
    walletId: string;
    rootCategoryId: string;
    subCategoryId: string;
    beneficiaryId: string;
    selectedTagIds: string[];
    date: string;
    resolvedType: TransactionType;
    transactionMode: TransactionMode;
    installmentCountInput: string;
    editScope: TransactionSeriesScope;
    availableCategories: ReturnType<typeof useFinanceCategories>;
    rootCategories: ReturnType<typeof useFinanceCategories>;
    subCategories: ReturnType<typeof useFinanceCategories>;
    wallets: ReturnType<typeof useFinanceWallets>;
    beneficiaries: ReturnType<typeof useFinanceBeneficiaries>;
    tags: ReturnType<typeof useFinanceTags>;
    hasSubCategories: boolean;
    setAmountInput: (value: string) => void;
    setStatus: (value: TransactionStatus) => void;
    setDescription: (value: string) => void;
    setWalletId: (value: string) => void;
    setRootCategoryId: (value: string) => void;
    setSubCategoryId: (value: string) => void;
    setBeneficiaryId: (value: string) => void;
    setSelectedTagIds: (value: string[]) => void;
    setDate: (value: string) => void;
    setDateOffset: (offsetInDays: number) => void;
    setTransactionMode: (value: TransactionMode) => void;
    setInstallmentCountInput: (value: string) => void;
    setEditScope: (value: TransactionSeriesScope) => void;
    prepareNextSubmission: () => void;
    toggleTag: (tagId: string) => void;
    submit: () => Promise<boolean>;
    saveAndContinue: () => Promise<boolean>;
    remove: () => Promise<boolean>;
    duplicate: () => Promise<boolean>;
    ignore: () => Promise<boolean>;
    cancelTransaction: () => Promise<boolean>;
}

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function getDefaultDescriptionByType(type: TransactionType): string {
    if (type === "income") {
        return "Receita";
    }

    if (type === "spending") {
        return "Despesa";
    }

    return "Transferencia";
}

function findCategorySelectionFromTransaction(transaction: Transaction, availableCategories: ReturnType<typeof useFinanceCategories>): CategorySelection | null {
    const categoryId = transaction.category.id;
    if (categoryId) {
        const matchingCategory = availableCategories.find((item) => item.id === categoryId);
        if (matchingCategory?.parentId) {
            return {
                rootCategoryId: matchingCategory.parentId,
                subCategoryId: matchingCategory.id,
            };
        }

        if (matchingCategory) {
            return {
                rootCategoryId: matchingCategory.id,
                subCategoryId: "",
            };
        }
    }

    const normalizedParentLabel = normalizeComparisonText(transaction.category.parentLabel ?? "");
    const labelParts = transaction.category.label.split("/");
    const normalizedSubLabel = normalizeComparisonText(labelParts[labelParts.length - 1] ?? "");
    const normalizedRootLabel = normalizeComparisonText(transaction.category.label);

    if (normalizedParentLabel) {
        const rootByName = availableCategories.find((item) => item.parentId === null && normalizeComparisonText(item.name) === normalizedParentLabel);
        if (!rootByName) {
            return null;
        }

        const subByName = availableCategories.find(
            (item) => item.parentId === rootByName.id && normalizeComparisonText(item.name) === normalizedSubLabel,
        );

        return {
            rootCategoryId: rootByName.id,
            subCategoryId: subByName?.id ?? "",
        };
    }

    const rootByLabel = availableCategories.find((item) => item.parentId === null && normalizeComparisonText(item.name) === normalizedRootLabel);
    if (!rootByLabel) {
        return null;
    }

    return {
        rootCategoryId: rootByLabel.id,
        subCategoryId: "",
    };
}

function findCategorySelectionById(categoryId: string, availableCategories: ReturnType<typeof useFinanceCategories>): CategorySelection | null {
    const matchingCategory = availableCategories.find((item) => item.id === categoryId);
    if (!matchingCategory) {
        return null;
    }

    if (matchingCategory.parentId) {
        return {
            rootCategoryId: matchingCategory.parentId,
            subCategoryId: matchingCategory.id,
        };
    }

    return {
        rootCategoryId: matchingCategory.id,
        subCategoryId: "",
    };
}

function resolveInitialDate(prefillDate?: string): string {
    const normalizedPrefillDate = prefillDate?.trim() ?? "";
    if (!normalizedPrefillDate) {
        return getLocalTodayDate();
    }

    return parseDateOnlyToLocalDate(normalizedPrefillDate) ? normalizedPrefillDate : getLocalTodayDate();
}

export function useTransactionForm({ type, transaction, mode = "default", prefill }: UseTransactionFormOptions = {}): TransactionFormState {
    const wallets = useFinanceWallets();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const categories = useFinanceCategories();
    const { user } = useFinanceSession();
    const beneficiaries = useFinanceBeneficiaries();
    const transactionGroups = useFinanceTransactionGroups();
    const allTags = useFinanceTags();
    const { addTransaction, deleteTransactionWithScope, updateInvoicePaymentTransaction, updateTransaction } = useFinanceActions();
    const isEditing = Boolean(transaction);
    const isInvoicePaymentEdit = mode === "invoice_payment_edit" && Boolean(transaction);
    const sourceGroup = useMemo(
        () => (transaction ? transactionGroups.find((item) => item.id === transaction.groupId) ?? null : null),
        [transaction, transactionGroups],
    );
    const isSeriesTransaction = Boolean(sourceGroup && sourceGroup.transactionMode !== "single");

    const [amountInput, setAmountInputState] = useState(() =>
        transaction ? formatAmountInputFromValue(transaction.value) : typeof prefill?.initialAmount === "number" ? formatAmountInputFromValue(prefill.initialAmount) : "R$ 0,00",
    );
    const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? "paid");
    const [description, setDescription] = useState(transaction?.description ?? prefill?.initialDescription ?? "");
    const [walletId, setWalletId] = useState(transaction?.inWallet ?? favoriteWalletId);
    const [rootCategoryId, setRootCategoryId] = useState("");
    const [subCategoryId, setSubCategoryId] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState(transaction?.beneficiaryId ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? []);
    const [date, setDate] = useState(transaction?.date ?? resolveInitialDate(prefill?.initialDate));
    const [transactionMode, setTransactionModeState] = useState<TransactionMode>(() => sourceGroup?.transactionMode ?? "single");
    const [installmentCountInput, setInstallmentCountInput] = useState(() =>
        sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2",
    );
    const [editScope, setEditScopeState] = useState<TransactionSeriesScope>("single");
    const [draftTransactionId, setDraftTransactionId] = useState(() => createId("tx"));
    const [hydratedTransactionId, setHydratedTransactionId] = useState<string | null>(null);
    const [hydratedPrefillCategoryId, setHydratedPrefillCategoryId] = useState<string | null>(null);
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const selectableWallets = useMemo(
        () => wallets.filter((wallet) => wallet.isActive || (isEditing && wallet.id === walletId)),
        [isEditing, walletId, wallets],
    );

    const amountValue = useMemo(() => parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput)), [amountInput]);

    const resolvedType: TransactionType = useMemo(() => {
        if (transaction?.type) {
            return transaction.type;
        }
        if (type) {
            return type;
        }
        return "income";
    }, [transaction?.type, type]);

    const isTransfer = resolvedType === "transfer";

    const categoryType = resolvedType === "income" ? "income" : "expense";

    const selectedCategoryIdsToKeep = useMemo(() => {
        const ids = new Set<string>();
        const selectedCategoryId = transaction?.category.id;
        if (!selectedCategoryId) {
            return ids;
        }

        const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
        if (!selectedCategory) {
            return ids;
        }

        ids.add(selectedCategory.id);
        if (selectedCategory.parentId) {
            ids.add(selectedCategory.parentId);
        }

        return ids;
    }, [categories, transaction?.category.id]);

    const availableCategories = useMemo(
        () =>
            categories.filter(
                (item) =>
                    item.type === categoryType &&
                    item.id !== SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID &&
                    (item.isActive || selectedCategoryIdsToKeep.has(item.id)),
            ),
        [categories, categoryType, selectedCategoryIdsToKeep],
    );

    const rootCategories = useMemo(() => availableCategories.filter((item) => item.parentId === null), [availableCategories]);

    const subCategories = useMemo(
        () => availableCategories.filter((item) => item.parentId === rootCategoryId),
        [availableCategories, rootCategoryId],
    );

    const hasSubCategories = subCategories.length > 0;

    const tags = useMemo(() => allTags.filter((tag) => tag.isActive || selectedTagIds.includes(tag.id)), [allTags, selectedTagIds]);

    useEffect(() => {
        if (!transaction) {
            return;
        }

        setAmountInputState(formatAmountInputFromValue(transaction.value));
        setStatus(transaction.status);
        setDescription(transaction.description ?? "");
        setWalletId(transaction.inWallet ?? favoriteWalletId);
        setBeneficiaryId(transaction.beneficiaryId ?? "");
        setSelectedTagIds(transaction.tagIds ?? []);
        setDate(transaction.date ?? getLocalTodayDate());
        setTransactionModeState(sourceGroup?.transactionMode ?? "single");
        setInstallmentCountInput(sourceGroup?.transactionMode === "installment" && sourceGroup.installmentCount ? String(sourceGroup.installmentCount) : "2");
        setEditScopeState("single");
        setHydratedTransactionId(null);
    }, [favoriteWalletId, sourceGroup?.installmentCount, sourceGroup?.transactionMode, transaction?.id]);

    useEffect(() => {
        if (!transaction) {
            return;
        }

        if (hydratedTransactionId === transaction.id) {
            return;
        }

        if (availableCategories.length < 1) {
            return;
        }

        const categorySelection = findCategorySelectionFromTransaction(transaction, availableCategories);
        if (categorySelection) {
            setRootCategoryId(categorySelection.rootCategoryId);
            setSubCategoryId(categorySelection.subCategoryId);
        }

        setHydratedTransactionId(transaction.id);
    }, [availableCategories, hydratedTransactionId, transaction]);

    useEffect(() => {
        if (transaction) {
            return;
        }

        const initialCategoryId = prefill?.initialCategoryId?.trim() ?? "";
        if (!initialCategoryId || hydratedPrefillCategoryId === initialCategoryId || availableCategories.length < 1) {
            return;
        }

        const categorySelection = findCategorySelectionById(initialCategoryId, availableCategories);
        if (categorySelection) {
            setRootCategoryId(categorySelection.rootCategoryId);
            setSubCategoryId(categorySelection.subCategoryId);
        }

        setHydratedPrefillCategoryId(initialCategoryId);
    }, [availableCategories, hydratedPrefillCategoryId, prefill?.initialCategoryId, transaction]);

    useEffect(() => {
        const fallbackWalletId =
            activeWallets.find((wallet) => wallet.id === favoriteWalletId)?.id ??
            activeWallets[0]?.id ??
            wallets.find((wallet) => wallet.id === favoriteWalletId)?.id ??
            wallets[wallets.length - 1]?.id ??
            DEFAULT_WALLET_ID;

        if (!selectableWallets.some((wallet) => wallet.id === walletId)) {
            setWalletId(fallbackWalletId);
            return;
        }

        if (!isEditing && wallets.some((wallet) => wallet.id === walletId && !wallet.isActive)) {
            setWalletId(fallbackWalletId);
        }
    }, [activeWallets, favoriteWalletId, isEditing, selectableWallets, walletId, wallets]);

    useEffect(() => {
        if (transaction && hydratedTransactionId !== transaction.id) {
            return;
        }

        const initialCategoryId = prefill?.initialCategoryId?.trim() ?? "";
        if (!transaction && initialCategoryId && hydratedPrefillCategoryId !== initialCategoryId) {
            return;
        }

        const fallback = rootCategories.find((item) => normalizeComparisonText(item.name) === (categoryType === "expense" ? "sem categoria" : "outras receitas")) ?? rootCategories[0];
        if (!fallback) {
            setRootCategoryId("");
            setSubCategoryId("");
            return;
        }

        if (!rootCategories.some((item) => item.id === rootCategoryId)) {
            setRootCategoryId(fallback.id);
        }
    }, [categoryType, hydratedPrefillCategoryId, hydratedTransactionId, prefill?.initialCategoryId, rootCategories, rootCategoryId, transaction]);

    useEffect(() => {
        if (subCategoryId && !subCategories.some((item) => item.id === subCategoryId)) {
            setSubCategoryId("");
        }
    }, [subCategoryId, subCategories]);

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

    const setTransactionMode = (value: TransactionMode) => {
        setTransactionModeState(value === "installment" || value === "recurring" ? value : "single");
    };

    const setEditScope = (value: TransactionSeriesScope) => {
        if (value === "all" || value === "this_and_next") {
            setEditScopeState(value);
            return;
        }
        setEditScopeState("single");
    };

    const buildDraft = (statusOverride?: TransactionStatus) => {
        const numericValue = amountValue;
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return null;
        }
        const trimmedDescription = description.trim();
        const fallbackDescription = getDefaultDescriptionByType(transaction?.type ?? resolvedType);

        const selectedCategoryId = subCategoryId || rootCategoryId || null;
        const resolvedTransactionMode: TransactionMode =
            isTransfer
                ? "single"
                : transactionMode === "installment"
                  ? "installment"
                : transactionMode === "recurring"
                  ? "recurring"
                  : "single";
        const parsedInstallmentCount = Number(installmentCountInput);
        const resolvedInstallmentCount =
            resolvedTransactionMode === "installment" && Number.isInteger(parsedInstallmentCount) && parsedInstallmentCount >= 2
                ? parsedInstallmentCount
                : null;
        if (resolvedTransactionMode === "installment" && !resolvedInstallmentCount) {
            return null;
        }

        const finalStatus = statusOverride ?? status;

        return {
            id: transaction ? undefined : draftTransactionId,
            type: transaction?.type ?? resolvedType,
            value: numericValue,
            date: date || getLocalTodayDate(),
            inWallet: walletId,
            paymentMethod: "wallet" as const,
            creditCardId: null,
            categoryId: selectedCategoryId,
            beneficiaryId: beneficiaryId || null,
            tagIds: selectedTagIds,
            description: trimmedDescription || fallbackDescription,
            status: finalStatus,
            notes: trimmedDescription || undefined,
            transactionMode: resolvedTransactionMode,
            installmentCount: resolvedInstallmentCount,
            recurrenceRule:
                resolvedTransactionMode === "recurring"
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

    const saveAndContinue = async () => {
        const draft = buildDraft();
        if (!draft) {
            return false;
        }

        await addTransaction(draft);
        return true;
    }

    const submit = async () => {
        if (transaction) {
            if (isInvoicePaymentEdit) {
                const trimmedDescription = description.trim();
                const transactionDescription = transaction.description?.trim() ?? "";
                await updateInvoicePaymentTransaction({
                    transactionId: transaction.id,
                    description: trimmedDescription || transactionDescription || "Pagamento de fatura",
                    beneficiaryId: beneficiaryId || null,
                    date: date || transaction.date || getLocalTodayDate(),
                });
                return true;
            }

            const draft = buildDraft();
            if (!draft) {
                return false;
            }

            await updateTransaction({
                transaction,
                draft,
                scope: editScope,
            });
            return true;
        }

        const draft = buildDraft();
        if (!draft) {
            return false;
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
        if (isInvoicePaymentEdit) {
            return false;
        }

        const draft = buildDraft();
        if (!draft) {
            return false;
        }

        await addTransaction(draft);
        return true;
    };

    const ignore = async () => {
        if (!transaction || isInvoicePaymentEdit) {
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

    const cancelTransaction = async () => {
        if (!transaction || isInvoicePaymentEdit) {
            return false;
        }

        const draft = buildDraft("cancelled");
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

    const prepareNextSubmission = () => {
        if (!transaction) {
            setDraftTransactionId(createId("tx"));
        }
    };

    return {
        isEditing,
        isInvoicePaymentEdit,
        isTransfer,
        isSeriesTransaction,
        sourceTransaction: transaction ?? null,
        transactionId: transaction?.id ?? draftTransactionId,
        amountInput,
        status,
        description,
        walletId,
        rootCategoryId,
        subCategoryId,
        beneficiaryId,
        selectedTagIds,
        date,
        resolvedType,
        transactionMode,
        installmentCountInput,
        editScope,
        availableCategories,
        rootCategories,
        subCategories,
        wallets: selectableWallets,
        beneficiaries,
        tags,
        hasSubCategories,
        setAmountInput,
        setStatus,
        setDescription,
        setWalletId,
        setRootCategoryId,
        setSubCategoryId,
        setBeneficiaryId,
        setSelectedTagIds,
        setDate,
        setDateOffset,
        setTransactionMode,
        setInstallmentCountInput,
        setEditScope,
        prepareNextSubmission,
        toggleTag,
        saveAndContinue,
        submit,
        remove,
        duplicate,
        ignore,
        cancelTransaction,
    };
}
