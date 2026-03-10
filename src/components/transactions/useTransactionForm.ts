import { useEffect, useMemo, useState } from "react";
import {
    DEFAULT_WALLET_ID,
    type TransactionType,
    useFinanceActions,
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceFavoriteWallet,
    useFinanceTags,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { normalizeComparisonText } from "../../context/finance/helpers";

export interface TransactionFormState {
    price: string;
    name: string;
    description: string;
    checked: boolean;
    walletId: string;
    rootCategoryId: string;
    subCategoryId: string;
    beneficiaryId: string;
    selectedTagIds: string[];
    date: string;
    resolvedType: TransactionType;
    rootCategories: ReturnType<typeof useFinanceCategories>;
    subCategories: ReturnType<typeof useFinanceCategories>;
    wallets: ReturnType<typeof useFinanceWallets>;
    beneficiaries: ReturnType<typeof useFinanceBeneficiaries>;
    tags: ReturnType<typeof useFinanceTags>;
    setPrice: (value: string) => void;
    setName: (value: string) => void;
    setDescription: (value: string) => void;
    setChecked: (value: boolean) => void;
    setWalletId: (value: string) => void;
    setRootCategoryId: (value: string) => void;
    setSubCategoryId: (value: string) => void;
    setBeneficiaryId: (value: string) => void;
    setDate: (value: string) => void;
    toggleTag: (tagId: string) => void;
    submit: () => void;
}

export function useTransactionForm(type?: TransactionType): TransactionFormState {
    const wallets = useFinanceWallets();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const categories = useFinanceCategories();
    const beneficiaries = useFinanceBeneficiaries();
    const tags = useFinanceTags();
    const { addTransaction } = useFinanceActions();

    const [price, setPrice] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [checked, setChecked] = useState(false);
    const [walletId, setWalletId] = useState(favoriteWalletId);
    const [rootCategoryId, setRootCategoryId] = useState("");
    const [subCategoryId, setSubCategoryId] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState("");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const resolvedType: TransactionType = useMemo(() => {
        if (type) {
            return type;
        }
        return Number(price) < 0 ? "spending" : "income";
    }, [price, type]);

    const categoryType = resolvedType === "income" ? "income" : "expense";

    const rootCategories = useMemo(
        () => categories.filter((item) => item.type === categoryType && item.parentId === null),
        [categories, categoryType],
    );

    const subCategories = useMemo(
        () => categories.filter((item) => item.type === categoryType && item.parentId === rootCategoryId),
        [categories, categoryType, rootCategoryId],
    );

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
        const fallback = rootCategories.find((item) => normalizeComparisonText(item.name) === (categoryType === "expense" ? "sem categoria" : "outras receitas")) ?? rootCategories[0];
        if (!fallback) {
            setRootCategoryId("");
            setSubCategoryId("");
            return;
        }

        if (!rootCategories.some((item) => item.id === rootCategoryId)) {
            setRootCategoryId(fallback.id);
        }
    }, [categoryType, rootCategories, rootCategoryId]);

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

    const submit = () => {
        const numericValue = Number(price);
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return;
        }

        const selectedCategoryId = subCategoryId || rootCategoryId || null;
        addTransaction({
            id: `${date}-${name || "transacao"}-${Math.floor(Math.random() * 1000)}`,
            type: resolvedType,
            value: numericValue,
            date: date || new Date().toISOString().split("T")[0],
            inWallet: walletId,
            categoryId: selectedCategoryId,
            beneficiaryId: beneficiaryId || null,
            tagIds: selectedTagIds,
            description: description || name,
            status: checked,
            notes: description || undefined,
        });
    };

    return {
        price,
        name,
        description,
        checked,
        walletId,
        rootCategoryId,
        subCategoryId,
        beneficiaryId,
        selectedTagIds,
        date,
        resolvedType,
        rootCategories,
        subCategories,
        wallets,
        beneficiaries,
        tags,
        setPrice,
        setName,
        setDescription,
        setChecked,
        setWalletId,
        setRootCategoryId,
        setSubCategoryId,
        setBeneficiaryId,
        setDate,
        toggleTag,
        submit,
    };
}
