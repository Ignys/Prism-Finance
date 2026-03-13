import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuthListener } from "../../hooks/useAuthListener";
import { db } from "../../firebase/firebaseClient";
import { mergeFinanceFields, readFinanceFromUserData } from "../../firebase/userService";
import {
    type Beneficiary,
    calculateFinanceSummary,
    calculateTotalBalance,
    type Category,
    createFinanceSnapshot,
    createLedgerEntriesForPaidTransaction,
    DEFAULT_BENEFICIARY_ID,
    DEFAULT_BENEFICIARY_NAME,
    DEFAULT_WALLET,
    DEFAULT_WALLET_ID,
    findDefaultCategoryId,
    type FinanceSnapshot,
    type LedgerEntry,
    normalizeBeneficiary,
    normalizeCategory,
    normalizeFinanceSnapshot,
    normalizeStoredTransaction,
    normalizeTag,
    normalizeTransactionGroup,
    normalizeTransactionStatus,
    normalizeWallet,
    normalizeWalletId,
    type StoredTransaction,
    type Tag,
    type Transaction,
    type TransactionDraft,
    type TransactionGroup,
    type TransactionTag,
    toTransactionList,
    type Wallet,
} from "../financeTypes";
import type { FinanceStoreValue, PersistFields } from "./contextTypes";
import {
    createId,
    ensureWalletId,
    findBeneficiaryByName,
    findCategoryByName,
    getTodayDate,
    resolveGroupType,
    roundToCents,
    toCategoryTypeFromGroupType,
} from "./helpers";
import { getDefaultCategoryIconName } from "../../lib/categoryIcons";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function resolveFavoriteWalletId(candidate: unknown, wallets: Wallet[]): string {
    const normalizedCandidate = typeof candidate === "string" ? normalizeWalletId(candidate.trim()) : DEFAULT_WALLET_ID;
    if (wallets.some((wallet) => wallet.id === normalizedCandidate)) {
        return normalizedCandidate;
    }

    return wallets.find((wallet) => wallet.id === DEFAULT_WALLET_ID)?.id ?? wallets[0]?.id ?? DEFAULT_WALLET_ID;
}

function getNextSortOrder<T extends { sortOrder: number }>(items: T[]): number {
    if (items.length < 1) {
        return 0;
    }
    const maxSortOrder = Math.max(...items.map((item) => item.sortOrder));
    return Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : items.length;
}

function compareBySortOrderNameAndId<T extends { sortOrder: number; name: string; id: string }>(a: T, b: T): number {
    if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
    }

    const nameComparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    if (nameComparison !== 0) {
        return nameComparison;
    }

    return a.id.localeCompare(b.id);
}

function compareCategoriesByTypeParentSort(a: Category, b: Category): number {
    if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
    }

    if (a.parentId === b.parentId) {
        return compareBySortOrderNameAndId(a, b);
    }

    if (a.parentId === null) {
        return -1;
    }
    if (b.parentId === null) {
        return 1;
    }

    return a.parentId.localeCompare(b.parentId);
}

function collectCategoryDescendantIds(categories: Category[], rootId: string): Set<string> {
    const descendants = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
        const parentId = queue.shift();
        if (!parentId) {
            continue;
        }

        categories.forEach((category) => {
            if (category.parentId === parentId && !descendants.has(category.id)) {
                descendants.add(category.id);
                queue.push(category.id);
            }
        });
    }

    return descendants;
}

export function useFinanceStore(): FinanceStoreValue {
    const { user, loading: authLoading } = useAuthListener();

    const [favoriteWalletId, setFavoriteWalletId] = useState(DEFAULT_WALLET_ID);
    const [wallets, setWallets] = useState<Wallet[]>([DEFAULT_WALLET]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
    const [storedTransactions, setStoredTransactions] = useState<StoredTransaction[]>([]);
    const [transactionTags, setTransactionTags] = useState<TransactionTag[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [financeLoading, setFinanceLoading] = useState(true);

    const walletsRef = useRef(wallets);
    const favoriteWalletIdRef = useRef(favoriteWalletId);
    const beneficiariesRef = useRef(beneficiaries);
    const categoriesRef = useRef(categories);
    const tagsRef = useRef(tags);
    const transactionGroupsRef = useRef(transactionGroups);
    const storedTransactionsRef = useRef(storedTransactions);
    const transactionTagsRef = useRef(transactionTags);
    const ledgerEntriesRef = useRef(ledgerEntries);

    useEffect(() => {
        walletsRef.current = wallets;
    }, [wallets]);

    useEffect(() => {
        favoriteWalletIdRef.current = favoriteWalletId;
    }, [favoriteWalletId]);

    useEffect(() => {
        beneficiariesRef.current = beneficiaries;
    }, [beneficiaries]);

    useEffect(() => {
        categoriesRef.current = categories;
    }, [categories]);

    useEffect(() => {
        tagsRef.current = tags;
    }, [tags]);

    useEffect(() => {
        transactionGroupsRef.current = transactionGroups;
    }, [transactionGroups]);

    useEffect(() => {
        storedTransactionsRef.current = storedTransactions;
    }, [storedTransactions]);

    useEffect(() => {
        transactionTagsRef.current = transactionTags;
    }, [transactionTags]);

    useEffect(() => {
        ledgerEntriesRef.current = ledgerEntries;
    }, [ledgerEntries]);

    const setSnapshotState = useCallback((snapshot: FinanceSnapshot) => {
        setWallets(snapshot.wallets);
        setBeneficiaries(snapshot.beneficiaries);
        setCategories(snapshot.categories);
        setTags(snapshot.tags);
        setTransactionGroups(snapshot.transactionGroups);
        setStoredTransactions(snapshot.transactions);
        setTransactionTags(snapshot.transactionTags);
        setLedgerEntries(snapshot.ledgerEntries);
    }, []);

    const buildSnapshot = useCallback((overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => {
        return createFinanceSnapshot(
            overrides.wallets ?? walletsRef.current,
            overrides.transactionGroups ?? transactionGroupsRef.current,
            overrides.transactions ?? storedTransactionsRef.current,
            overrides.ledgerEntries ?? ledgerEntriesRef.current,
            overrides.beneficiaries ?? beneficiariesRef.current,
            overrides.categories ?? categoriesRef.current,
            overrides.tags ?? tagsRef.current,
            overrides.transactionTags ?? transactionTagsRef.current,
        );
    }, []);

    useEffect(() => {
        let isActive = true;

        const loadFinance = async () => {
            if (!user) {
                if (isActive) {
                    const empty = normalizeFinanceSnapshot(null, null).snapshot;
                    setSnapshotState(empty);
                    setFavoriteWalletId(resolveFavoriteWalletId(DEFAULT_WALLET_ID, empty.wallets));
                    setFinanceLoading(false);
                }
                return;
            }

            setFinanceLoading(true);

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                const rawUserData = snap.exists() ? (snap.data() as unknown) : null;
                const { finance: rawFinance, hasLegacyDotFields } = readFinanceFromUserData(rawUserData);
                const normalizedFinance = normalizeFinanceSnapshot(rawFinance, user.uid);
                const snapshot = normalizedFinance.snapshot;
                const rawFavoriteWalletId = isRecord(rawFinance) ? rawFinance.favoriteWalletId : undefined;
                const normalizedFavoriteWalletId = resolveFavoriteWalletId(rawFavoriteWalletId, snapshot.wallets);
                const favoriteChanged = normalizedFavoriteWalletId !== rawFavoriteWalletId;

                if (!isActive) {
                    return;
                }

                setSnapshotState(snapshot);
                setFavoriteWalletId(normalizedFavoriteWalletId);

                if (normalizedFinance.changed || favoriteChanged || hasLegacyDotFields) {
                    await mergeFinanceFields(user.uid, {
                        wallets: snapshot.wallets,
                        transactionGroups: snapshot.transactionGroups,
                        transactions: snapshot.transactions,
                        ledgerEntries: snapshot.ledgerEntries,
                        beneficiaries: snapshot.beneficiaries,
                        categories: snapshot.categories,
                        tags: snapshot.tags,
                        transactionTags: snapshot.transactionTags,
                        favoriteWalletId: normalizedFavoriteWalletId,
                    });
                }
            } catch (error) {
                console.error("Failed to load finance data:", error);
                if (isActive) {
                    const empty = normalizeFinanceSnapshot(null, user.uid).snapshot;
                    setSnapshotState(empty);
                    setFavoriteWalletId(resolveFavoriteWalletId(DEFAULT_WALLET_ID, empty.wallets));
                }
            } finally {
                if (isActive) {
                    setFinanceLoading(false);
                }
            }
        };

        void loadFinance();

        return () => {
            isActive = false;
        };
    }, [setSnapshotState, user]);

    const persistFinanceFields = useCallback(
        async (fields: PersistFields) => {
            if (!user) {
                return;
            }
            await mergeFinanceFields(user.uid, fields);
        },
        [user],
    );

    const persistFullSnapshot = useCallback(
        async (snapshot: FinanceSnapshot) => {
            await persistFinanceFields({
                wallets: snapshot.wallets,
                transactionGroups: snapshot.transactionGroups,
                transactions: snapshot.transactions,
                ledgerEntries: snapshot.ledgerEntries,
                beneficiaries: snapshot.beneficiaries,
                categories: snapshot.categories,
                tags: snapshot.tags,
                transactionTags: snapshot.transactionTags,
                favoriteWalletId: favoriteWalletIdRef.current,
            });
        },
        [persistFinanceFields],
    );

    const updateFinance = useCallback(
        async (newFinance: FinanceSnapshot) => {
            const normalized = normalizeFinanceSnapshot(newFinance, user?.uid ?? null).snapshot;
            setSnapshotState(normalized);
            await persistFullSnapshot(normalized);
        },
        [persistFullSnapshot, setSnapshotState, user?.uid],
    );

    const setStartBalance = useCallback(
        async (walletId: string, newStartBalance: number) => {
            const normalizedWalletId = normalizeWalletId(walletId);
            const safeStartBalance = roundToCents(Number(newStartBalance));
            if (!Number.isFinite(safeStartBalance)) {
                return;
            }

            const nextWallets = walletsRef.current.map((wallet) => {
                if (wallet.id !== normalizedWalletId) {
                    return wallet;
                }

                return {
                    ...wallet,
                    initialBalance: safeStartBalance,
                };
            });

            const snapshot = buildSnapshot({ wallets: nextWallets });
            setSnapshotState(snapshot);

            await persistFinanceFields({
                wallets: snapshot.wallets,
                ledgerEntries: snapshot.ledgerEntries,
            });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const setFavoriteWallet = useCallback(
        async (walletId: string) => {
            const nextFavoriteWalletId = resolveFavoriteWalletId(walletId, walletsRef.current);
            if (favoriteWalletIdRef.current === nextFavoriteWalletId) {
                return;
            }

            setFavoriteWalletId(nextFavoriteWalletId);
            await persistFinanceFields({ favoriteWalletId: nextFavoriteWalletId });
        },
        [persistFinanceFields],
    );

    const addWallet = useCallback(
        async (newWallet: Wallet) => {
            const wallet = normalizeWallet(newWallet);
            const nextWallets = walletsRef.current.some((item) => item.id === wallet.id)
                ? walletsRef.current.map((item) => (item.id === wallet.id ? wallet : item))
                : [...walletsRef.current, wallet];

            const snapshot = buildSnapshot({ wallets: nextWallets });
            setSnapshotState(snapshot);

            await persistFinanceFields({
                wallets: snapshot.wallets,
                ledgerEntries: snapshot.ledgerEntries,
            });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const addBeneficiary = useCallback(
        async (newBeneficiary: Beneficiary) => {
            const existingBeneficiary = beneficiariesRef.current.find((item) => item.id === newBeneficiary.id) ?? null;
            const beneficiary = normalizeBeneficiary({
                ...newBeneficiary,
                userId: newBeneficiary.userId ?? user?.uid ?? null,
                sortOrder: existingBeneficiary?.sortOrder ?? newBeneficiary.sortOrder ?? getNextSortOrder(beneficiariesRef.current),
                createdAt: newBeneficiary.createdAt ?? new Date().toISOString(),
            });

            const nextBeneficiaries = (beneficiariesRef.current.some((item) => item.id === beneficiary.id)
                ? beneficiariesRef.current.map((item) => (item.id === beneficiary.id ? beneficiary : item))
                : [...beneficiariesRef.current, beneficiary]
            ).sort(compareBySortOrderNameAndId);

            const snapshot = buildSnapshot({ beneficiaries: nextBeneficiaries });
            setSnapshotState(snapshot);
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, user?.uid],
    );

    const addCategory = useCallback(
        async (newCategory: Category) => {
            const parent = newCategory.parentId ? categoriesRef.current.find((item) => item.id === newCategory.parentId) : null;
            const existingCategory = categoriesRef.current.find((item) => item.id === newCategory.id) ?? null;
            const resolvedParentId = parent?.id ?? null;
            const resolvedType = parent?.type ?? newCategory.type;
            const keepsSiblingGroup =
                existingCategory?.parentId === resolvedParentId &&
                existingCategory?.type === resolvedType;
            const siblingGroup = categoriesRef.current.filter(
                (item) => item.parentId === resolvedParentId && item.type === resolvedType && item.id !== existingCategory?.id,
            );
            const category = normalizeCategory({
                ...newCategory,
                userId: newCategory.userId ?? user?.uid ?? null,
                parentId: resolvedParentId,
                type: resolvedType,
                sortOrder: keepsSiblingGroup ? existingCategory?.sortOrder ?? newCategory.sortOrder ?? 0 : getNextSortOrder(siblingGroup),
                createdAt: newCategory.createdAt ?? new Date().toISOString(),
            });

            const nextCategories = (categoriesRef.current.some((item) => item.id === category.id)
                ? categoriesRef.current.map((item) => (item.id === category.id ? category : item))
                : [...categoriesRef.current, category]
            ).sort(compareCategoriesByTypeParentSort);

            const snapshot = buildSnapshot({ categories: nextCategories });
            setSnapshotState(snapshot);
            await persistFinanceFields({ categories: snapshot.categories });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, user?.uid],
    );

    const addTag = useCallback(
        async (newTag: Tag) => {
            const existingTag = tagsRef.current.find((item) => item.id === newTag.id) ?? null;
            const tag = normalizeTag({
                ...newTag,
                userId: newTag.userId ?? user?.uid ?? null,
                sortOrder: existingTag?.sortOrder ?? newTag.sortOrder ?? getNextSortOrder(tagsRef.current),
                createdAt: newTag.createdAt ?? new Date().toISOString(),
            });

            const nextTags = (tagsRef.current.some((item) => item.id === tag.id)
                ? tagsRef.current.map((item) => (item.id === tag.id ? tag : item))
                : [...tagsRef.current, tag]
            ).sort(compareBySortOrderNameAndId);

            const snapshot = buildSnapshot({ tags: nextTags });
            setSnapshotState(snapshot);
            await persistFinanceFields({ tags: snapshot.tags });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, user?.uid],
    );

    const reorderBeneficiaries = useCallback(
        async (beneficiaryIds: string[]) => {
            const existingById = new Map(beneficiariesRef.current.map((item) => [item.id, item]));
            const uniqueOrderedIds: string[] = [];
            const seen = new Set<string>();

            beneficiaryIds.forEach((beneficiaryId) => {
                if (seen.has(beneficiaryId) || !existingById.has(beneficiaryId)) {
                    return;
                }
                seen.add(beneficiaryId);
                uniqueOrderedIds.push(beneficiaryId);
            });

            if (uniqueOrderedIds.length < 1) {
                return;
            }

            const sortedBeneficiaries = [...beneficiariesRef.current].sort(compareBySortOrderNameAndId);
            const omittedIds = sortedBeneficiaries.map((item) => item.id).filter((id) => !seen.has(id));
            const finalIds = [...uniqueOrderedIds, ...omittedIds];
            const nextOrderById = new Map(finalIds.map((id, index) => [id, index]));
            const nextBeneficiaries = finalIds
                .map((beneficiaryId) => existingById.get(beneficiaryId))
                .filter((beneficiary): beneficiary is Beneficiary => Boolean(beneficiary))
                .map((beneficiary) => ({
                    ...beneficiary,
                    sortOrder: nextOrderById.get(beneficiary.id) ?? beneficiary.sortOrder,
                }));

            const snapshot = buildSnapshot({ beneficiaries: nextBeneficiaries });
            setSnapshotState(snapshot);
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const reorderCategories = useCallback(
        async (categoryIds: string[]) => {
            const existingById = new Map(categoriesRef.current.map((item) => [item.id, item]));
            const uniqueOrderedIds: string[] = [];
            const seen = new Set<string>();

            categoryIds.forEach((categoryId) => {
                if (seen.has(categoryId) || !existingById.has(categoryId)) {
                    return;
                }
                seen.add(categoryId);
                uniqueOrderedIds.push(categoryId);
            });

            const anchorCategory = uniqueOrderedIds.length > 0 ? existingById.get(uniqueOrderedIds[0]) : null;
            if (!anchorCategory) {
                return;
            }

            const siblingCategories = categoriesRef.current
                .filter((item) => item.type === anchorCategory.type && item.parentId === anchorCategory.parentId)
                .sort(compareBySortOrderNameAndId);
            const siblingIdSet = new Set(siblingCategories.map((item) => item.id));
            const scopedOrderedIds = uniqueOrderedIds.filter((id) => siblingIdSet.has(id));
            if (scopedOrderedIds.length < 1) {
                return;
            }

            const scopedOrderedSet = new Set(scopedOrderedIds);
            const omittedIds = siblingCategories.map((item) => item.id).filter((id) => !scopedOrderedSet.has(id));
            const finalIds = [...scopedOrderedIds, ...omittedIds];
            const nextOrderById = new Map(finalIds.map((id, index) => [id, index]));

            const nextCategories = categoriesRef.current
                .map((category) => {
                if (!siblingIdSet.has(category.id)) {
                    return category;
                }

                return {
                    ...category,
                    sortOrder: nextOrderById.get(category.id) ?? category.sortOrder,
                };
                })
                .sort(compareCategoriesByTypeParentSort);

            const snapshot = buildSnapshot({ categories: nextCategories });
            setSnapshotState(snapshot);
            await persistFinanceFields({ categories: snapshot.categories });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const reorderTags = useCallback(
        async (tagIds: string[]) => {
            const existingById = new Map(tagsRef.current.map((item) => [item.id, item]));
            const uniqueOrderedIds: string[] = [];
            const seen = new Set<string>();

            tagIds.forEach((tagId) => {
                if (seen.has(tagId) || !existingById.has(tagId)) {
                    return;
                }
                seen.add(tagId);
                uniqueOrderedIds.push(tagId);
            });

            if (uniqueOrderedIds.length < 1) {
                return;
            }

            const sortedTags = [...tagsRef.current].sort(compareBySortOrderNameAndId);
            const omittedIds = sortedTags.map((item) => item.id).filter((id) => !seen.has(id));
            const finalIds = [...uniqueOrderedIds, ...omittedIds];
            const nextOrderById = new Map(finalIds.map((id, index) => [id, index]));
            const nextTags = finalIds
                .map((tagId) => existingById.get(tagId))
                .filter((tag): tag is Tag => Boolean(tag))
                .map((tag) => ({
                    ...tag,
                    sortOrder: nextOrderById.get(tag.id) ?? tag.sortOrder,
                }));

            const snapshot = buildSnapshot({ tags: nextTags });
            setSnapshotState(snapshot);
            await persistFinanceFields({ tags: snapshot.tags });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const setBeneficiaryActive = useCallback(
        async (beneficiaryId: string, isActive: boolean) => {
            let changed = false;
            const nextBeneficiaries = beneficiariesRef.current
                .map((beneficiary) => {
                    if (beneficiary.id !== beneficiaryId || beneficiary.isActive === isActive) {
                        return beneficiary;
                    }
                    changed = true;
                    return { ...beneficiary, isActive };
                })
                .sort(compareBySortOrderNameAndId);

            if (!changed) {
                return;
            }

            const snapshot = buildSnapshot({ beneficiaries: nextBeneficiaries });
            setSnapshotState(snapshot);
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const setCategoryActive = useCallback(
        async (categoryId: string, isActive: boolean) => {
            const targetCategory = categoriesRef.current.find((category) => category.id === categoryId);
            if (!targetCategory) {
                return;
            }

            if (targetCategory.isSystem && !isActive) {
                return;
            }

            const affectedIds = collectCategoryDescendantIds(categoriesRef.current, categoryId);
            affectedIds.add(categoryId);

            let changed = false;
            const nextCategories = categoriesRef.current
                .map((category) => {
                    if (!affectedIds.has(category.id)) {
                        return category;
                    }

                    if (category.isSystem && !isActive) {
                        return category;
                    }

                    if (category.isActive === isActive) {
                        return category;
                    }

                    changed = true;
                    return {
                        ...category,
                        isActive,
                    };
                })
                .sort(compareCategoriesByTypeParentSort);

            if (!changed) {
                return;
            }

            const snapshot = buildSnapshot({ categories: nextCategories });
            setSnapshotState(snapshot);
            await persistFinanceFields({ categories: snapshot.categories });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const setTagActive = useCallback(
        async (tagId: string, isActive: boolean) => {
            let changed = false;
            const nextTags = tagsRef.current
                .map((tag) => {
                    if (tag.id !== tagId || tag.isActive === isActive) {
                        return tag;
                    }
                    changed = true;
                    return { ...tag, isActive };
                })
                .sort(compareBySortOrderNameAndId);

            if (!changed) {
                return;
            }

            const snapshot = buildSnapshot({ tags: nextTags });
            setSnapshotState(snapshot);
            await persistFinanceFields({ tags: snapshot.tags });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const clearTransactions = useCallback(async () => {
        const snapshot = buildSnapshot({
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            transactionTags: [],
        });
        setSnapshotState(snapshot);

        await persistFinanceFields({
            wallets: snapshot.wallets,
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            transactionTags: [],
        });
    }, [buildSnapshot, persistFinanceFields, setSnapshotState]);

    const addTransaction = useCallback(
        async (newTransaction: TransactionDraft) => {
            const signedValue = Number(newTransaction.amount ?? newTransaction.value ?? 0);
            if (!Number.isFinite(signedValue) || signedValue === 0) {
                return;
            }

            const nowIso = new Date().toISOString();
            const absoluteAmount = roundToCents(Math.abs(signedValue));
            const groupType = resolveGroupType(newTransaction.type, signedValue);
            const status = normalizeTransactionStatus(newTransaction.status);
            const categoryType = toCategoryTypeFromGroupType(groupType);

            let nextCategories = [...categoriesRef.current];
            let nextBeneficiaries = [...beneficiariesRef.current];

            const categoriesById = new Map(nextCategories.map((item) => [item.id, item]));
            const beneficiariesById = new Map(nextBeneficiaries.map((item) => [item.id, item]));

            const createCategory = (name: string, parentId: string | null) => {
                const category = normalizeCategory({
                    id: createId("category"),
                    userId: user?.uid ?? null,
                    parentId,
                    name,
                    type: categoryType,
                    icon: getDefaultCategoryIconName(categoryType),
                    color: null,
                    isActive: true,
                    isSystem: false,
                    sortOrder: getNextSortOrder(nextCategories.filter((item) => item.parentId === parentId && item.type === categoryType)),
                    createdAt: nowIso,
                });
                nextCategories = [...nextCategories, category];
                categoriesById.set(category.id, category);
                return category;
            };

            let finalCategory: Category | null = null;
            const draftCategoryId = newTransaction.categoryId ? newTransaction.categoryId.trim() : "";
            if (draftCategoryId) {
                const existing = categoriesById.get(draftCategoryId);
                if (existing && existing.type === categoryType) {
                    finalCategory = existing;
                }
            }

            if (!finalCategory) {
                const principal = newTransaction.category?.principal?.trim();
                const sub = newTransaction.category?.sub?.trim();
                if (principal) {
                    const root = findCategoryByName(nextCategories, categoryType, principal, null) ?? createCategory(principal, null);
                    finalCategory = sub ? findCategoryByName(nextCategories, categoryType, sub, root.id) ?? createCategory(sub, root.id) : root;
                }
            }

            if (!finalCategory) {
                const fallbackId = findDefaultCategoryId(groupType, nextCategories);
                finalCategory = categoriesById.get(fallbackId) ?? null;
            }

            if (!finalCategory) {
                finalCategory = createCategory("Sem categoria", null);
            }

            const parentCategory = finalCategory.parentId ? categoriesById.get(finalCategory.parentId) : null;
            const categoryName = parentCategory?.name ?? finalCategory.name;
            const subcategoryName = parentCategory ? finalCategory.name : null;

            const createBeneficiary = (name: string) => {
                const beneficiary = normalizeBeneficiary({
                    id: createId("beneficiary"),
                    userId: user?.uid ?? null,
                    name,
                    type: "person",
                    avatarColor: null,
                    isActive: true,
                    sortOrder: getNextSortOrder(nextBeneficiaries),
                    createdAt: nowIso,
                });
                nextBeneficiaries = [...nextBeneficiaries, beneficiary];
                beneficiariesById.set(beneficiary.id, beneficiary);
                return beneficiary;
            };

            let finalBeneficiary: Beneficiary | null = null;
            const draftBeneficiaryId = newTransaction.beneficiaryId ? newTransaction.beneficiaryId.trim() : "";
            if (draftBeneficiaryId) {
                finalBeneficiary = beneficiariesById.get(draftBeneficiaryId) ?? null;
            }

            if (!finalBeneficiary) {
                const beneficiaryName = newTransaction.beneficiary?.trim();
                if (beneficiaryName) {
                    finalBeneficiary = findBeneficiaryByName(nextBeneficiaries, beneficiaryName) ?? createBeneficiary(beneficiaryName);
                }
            }

            if (!finalBeneficiary) {
                finalBeneficiary =
                    beneficiariesById.get(DEFAULT_BENEFICIARY_ID) ??
                    findBeneficiaryByName(nextBeneficiaries, DEFAULT_BENEFICIARY_NAME) ??
                    createBeneficiary(DEFAULT_BENEFICIARY_NAME);
            }

            const description = (newTransaction.description || "").trim();
            const sourceWalletId = ensureWalletId(
                normalizeWalletId(newTransaction.inWallet || newTransaction.walletId || DEFAULT_WALLET_ID),
                walletsRef.current,
            );
            const destinationWalletIdRaw = newTransaction.destinationWalletId ? normalizeWalletId(newTransaction.destinationWalletId) : null;
            const destinationWalletId = destinationWalletIdRaw ? ensureWalletId(destinationWalletIdRaw, walletsRef.current) : null;

            const transactionId = newTransaction.id && newTransaction.id.trim() ? newTransaction.id.trim() : createId("tx");
            const groupId = newTransaction.groupId && newTransaction.groupId.trim() ? newTransaction.groupId.trim() : `group-${transactionId}`;
            const existingGroup = transactionGroupsRef.current.find((group) => group.id === groupId);

            const group = existingGroup
                ? {
                      ...existingGroup,
                      totalAmount: roundToCents(existingGroup.totalAmount + absoluteAmount),
                  }
                : normalizeTransactionGroup(
                      {
                          id: groupId,
                          userId: user?.uid ?? null,
                          beneficiaryId: finalBeneficiary.id,
                          beneficiaryName: finalBeneficiary.name,
                          categoryId: finalCategory.id,
                          categoryName,
                          subcategoryName,
                          title: description || categoryName,
                          notes: newTransaction.notes || null,
                          type: groupType,
                          transactionMode: "single",
                          totalAmount: absoluteAmount,
                          installmentCount: null,
                          recurrenceRule: null,
                          recurrenceEndDate: null,
                          sourceWalletId,
                          destinationWalletId,
                          creditCardId: null,
                          createdAt: nowIso,
                      },
                      new Set(walletsRef.current.map((wallet) => wallet.id)),
                  );

            const nextGroups = existingGroup
                ? transactionGroupsRef.current.map((item) => (item.id === groupId ? group : item))
                : [...transactionGroupsRef.current, group];

            const transaction = normalizeStoredTransaction({
                id: transactionId,
                groupId,
                installmentNumber: null,
                amount: absoluteAmount,
                scheduledDate: newTransaction.scheduledDate || newTransaction.date || getTodayDate(),
                status,
                paidAt: status === "paid" ? nowIso : null,
                invoiceId: null,
                notes: newTransaction.notes || null,
                createdAt: nowIso,
            });

            const validTagIds = Array.from(new Set(newTransaction.tagIds ?? [])).filter((tagId) => tagsRef.current.some((tag) => tag.id === tagId));
            const nextTransactionTags = [...transactionTagsRef.current];
            validTagIds.forEach((tagId) => {
                if (!nextTransactionTags.some((item) => item.transactionId === transaction.id && item.tagId === tagId)) {
                    nextTransactionTags.push({ transactionId: transaction.id, tagId });
                }
            });

            const nextTransactions = [...storedTransactionsRef.current, transaction];
            const newLedgerEntries = status === "paid" ? createLedgerEntriesForPaidTransaction(transaction, group) : [];
            const nextLedgerEntries = [...ledgerEntriesRef.current, ...newLedgerEntries];

            const snapshot = buildSnapshot({
                categories: [...nextCategories].sort(compareCategoriesByTypeParentSort),
                beneficiaries: [...nextBeneficiaries].sort(compareBySortOrderNameAndId),
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                ledgerEntries: nextLedgerEntries,
                transactionTags: nextTransactionTags,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState, user?.uid],
    );

    const markTransactionAsPaid = useCallback(
        async (transaction: Transaction) => {
            const transactionToUpdate = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!transactionToUpdate || transactionToUpdate.status !== "pending") {
                return;
            }

            const group = transactionGroupsRef.current.find((item) => item.id === transactionToUpdate.groupId);
            if (!group) {
                return;
            }

            const nowIso = new Date().toISOString();
            const nextTransaction = normalizeStoredTransaction({
                ...transactionToUpdate,
                status: "paid",
                paidAt: nowIso,
            });

            const nextTransactions = storedTransactionsRef.current.map((item) => (item.id === transactionToUpdate.id ? nextTransaction : item));
            const nextLedgerEntries = ledgerEntriesRef.current.filter((item) => item.transactionId !== transactionToUpdate.id);
            nextLedgerEntries.push(...createLedgerEntriesForPaidTransaction(nextTransaction, group));

            const snapshot = buildSnapshot({
                transactions: nextTransactions,
                ledgerEntries: nextLedgerEntries,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const deleteTransaction = useCallback(
        async (transaction: Transaction) => {
            const transactionToDelete = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!transactionToDelete) {
                return;
            }

            const nextTransactions = storedTransactionsRef.current.filter((item) => item.id !== transactionToDelete.id);
            const nextLedgerEntries = ledgerEntriesRef.current.filter((item) => item.transactionId !== transactionToDelete.id);
            const nextTransactionTags = transactionTagsRef.current.filter((item) => item.transactionId !== transactionToDelete.id);

            const remainingOfGroup = nextTransactions.filter((item) => item.groupId === transactionToDelete.groupId);
            const nextGroups = transactionGroupsRef.current
                .map((group) => {
                    if (group.id !== transactionToDelete.groupId) {
                        return group;
                    }

                    if (remainingOfGroup.length === 0) {
                        return null;
                    }

                    const groupTotal = remainingOfGroup.reduce((sum, item) => sum + item.amount, 0);
                    return {
                        ...group,
                        totalAmount: roundToCents(groupTotal),
                    };
                })
                .filter((group): group is TransactionGroup => group !== null);

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                ledgerEntries: nextLedgerEntries,
                transactionTags: nextTransactionTags,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    useEffect(() => {
        const resolvedFavoriteWalletId = resolveFavoriteWalletId(favoriteWalletIdRef.current, wallets);
        if (resolvedFavoriteWalletId === favoriteWalletIdRef.current) {
            return;
        }

        setFavoriteWalletId(resolvedFavoriteWalletId);
        void persistFinanceFields({ favoriteWalletId: resolvedFavoriteWalletId });
    }, [persistFinanceFields, wallets]);

    const loading = authLoading || financeLoading;
    const transactions = useMemo(
        () => toTransactionList(storedTransactions, transactionGroups, categories, beneficiaries, tags, transactionTags),
        [beneficiaries, categories, storedTransactions, tags, transactionGroups, transactionTags],
    );
    const summary = useMemo(() => calculateFinanceSummary(transactionGroups, storedTransactions), [transactionGroups, storedTransactions]);
    const balance = useMemo(() => calculateTotalBalance(wallets), [wallets]);

    return useMemo(
        () => ({
            user,
            loading,
            favoriteWalletId,
            wallets,
            beneficiaries,
            categories,
            tags,
            transactionGroups,
            storedTransactions,
            transactionTags,
            ledgerEntries,
            transactions,
            despesas: summary.despesas,
            receitas: summary.receitas,
            balance,
            setStartBalance,
            setFavoriteWallet,
            updateFinance,
            addTransaction,
            markTransactionAsPaid,
            deleteTransaction,
            clearTransactions,
            addWallet,
            addBeneficiary,
            addCategory,
            addTag,
            reorderBeneficiaries,
            reorderCategories,
            reorderTags,
            setBeneficiaryActive,
            setCategoryActive,
            setTagActive,
        }),
        [
            addBeneficiary,
            addCategory,
            addTag,
            addTransaction,
            addWallet,
            balance,
            beneficiaries,
            categories,
            clearTransactions,
            deleteTransaction,
            favoriteWalletId,
            ledgerEntries,
            loading,
            markTransactionAsPaid,
            reorderBeneficiaries,
            reorderCategories,
            reorderTags,
            setBeneficiaryActive,
            setCategoryActive,
            setTagActive,
            setFavoriteWallet,
            setStartBalance,
            storedTransactions,
            summary.despesas,
            summary.receitas,
            tags,
            transactionGroups,
            transactionTags,
            transactions,
            updateFinance,
            user,
            wallets,
        ],
    );
}
