import { useEffect, useMemo, useState } from "react";
import {
    DEFAULT_WALLET_ID,
    type Transaction,
    type TransactionStatus,
    type TransactionType,
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceFavoriteWallet,
    useFinanceTags,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";
import { getLocalDateFromOffset, getLocalTodayDate } from "../../lib/localDate";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";

interface UseTransactionFormOptions {
    type?: TransactionType;
    transaction?: Transaction | null;
}

interface CategorySelection {
    rootCategoryId: string;
    subCategoryId: string;
}

export interface TransactionFormState {
    isEditing: boolean;
    isTransfer: boolean;
    sourceTransaction: Transaction | null;
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
    setDate: (value: string) => void;
    setDateOffset: (offsetInDays: number) => void;
    toggleTag: (tagId: string) => void;
    submit: () => Promise<boolean>;
    remove: () => Promise<boolean>;
    duplicate: () => Promise<boolean>;
}

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
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

export function useTransactionForm({ type, transaction }: UseTransactionFormOptions = {}): TransactionFormState {
    const wallets = useFinanceWallets();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const categories = useFinanceCategories();
    const beneficiaries = useFinanceBeneficiaries();
    const allTags = useFinanceTags();
    const { addTransaction, deleteTransaction } = useFinanceActions();
    const isEditing = Boolean(transaction);

    const [amountInput, setAmountInputState] = useState(() => (transaction ? formatAmountInputFromValue(transaction.value) : "R$ 0,00"));
    const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? "paid");
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [walletId, setWalletId] = useState(transaction?.inWallet ?? favoriteWalletId);
    const [rootCategoryId, setRootCategoryId] = useState("");
    const [subCategoryId, setSubCategoryId] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState(transaction?.beneficiaryId ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? []);
    const [date, setDate] = useState(transaction?.date ?? getLocalTodayDate());
    const [hydratedTransactionId, setHydratedTransactionId] = useState<string | null>(null);

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
        () => categories.filter((item) => item.type === categoryType && (item.isActive || selectedCategoryIdsToKeep.has(item.id))),
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
        setHydratedTransactionId(null);
    }, [favoriteWalletId, transaction?.id]);

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
        const fallbackWalletId =
            wallets.find((wallet) => wallet.id === favoriteWalletId)?.id ??
            wallets[wallets.length - 1]?.id ??
            DEFAULT_WALLET_ID;

        if (!wallets.some((wallet) => wallet.id === walletId)) {
            setWalletId(fallbackWalletId);
        }
    }, [favoriteWalletId, walletId, wallets]);

    useEffect(() => {
        if (transaction && hydratedTransactionId !== transaction.id) {
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
    }, [categoryType, hydratedTransactionId, rootCategories, rootCategoryId, transaction]);

    useEffect(() => {
        if (subCategoryId && !subCategories.some((item) => item.id === subCategoryId)) {
            setSubCategoryId("");
        }
    }, [subCategoryId, subCategories]);

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

        const selectedCategoryId = subCategoryId || rootCategoryId || null;

        return {
            type: transaction?.type ?? resolvedType,
            value: numericValue,
            date: date || getLocalTodayDate(),
            inWallet: walletId,
            categoryId: selectedCategoryId,
            beneficiaryId: beneficiaryId || null,
            tagIds: selectedTagIds,
            description: description || "Transacao",
            status,
            notes: description || undefined,
        };
    };

    const submit = async () => {
        if (transaction) {
            const draft = buildDraft();
            if (!draft) {
                return false;
            }

            await addTransaction(draft);
            await deleteTransaction(transaction);
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

    return {
        isEditing,
        isTransfer,
        sourceTransaction: transaction ?? null,
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
        availableCategories,
        rootCategories,
        subCategories,
        wallets,
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
        setDate,
        setDateOffset,
        toggleTag,
        submit,
        remove,
        duplicate,
    };
}
