import { createTransactionSnapshot } from "./transactionCreation/createTransactionSnapshot";
import { getNextSortOrder, compareBySortOrderNameAndId, compareCategoriesByTypeParentSort } from "./registryOrdering";
import { recalculateGroupTotals } from "./transactionSeries/helpers";
import { deleteTransactionsSnapshot } from "./transactionSeries/deleteTransactions";
import { updateTransactionsBulkSnapshot } from "./transactionSeries/bulkUpdate";
import { assertInvoiceMutation } from "./invoiceMutations";
import { materializeOccurrence } from "./recurrence/materializeOccurrence";
import { syncCreditCardInvoices } from "./syncCreditCardInvoices";
import { applyTransactionStatus } from "./transactionStatus";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthListener } from "../../hooks/useAuthListener";
import type { FamilySummary, SharedWishlistSnapshot } from "../familyTypes";
import {
    buildInvoicePaymentNote,
    type Beneficiary,
    calculateFinanceSummary,
    calculateCreditCardInvoiceOpenAmount,
    calculateTotalBalance,
    type Category,
    type CreditCard,
    type CreditCardInvoice,
    createFinanceSnapshot,
    createLedgerEntriesForPaidTransaction,
    DEFAULT_BENEFICIARY_NAME,
    DEFAULT_PLANNING_STATE,
    DEFAULT_WALLET,
    DEFAULT_WALLET_ID,
    parseInvoicePaymentNote,
    type FinanceSnapshot,
    type LedgerEntry,
    type PlanningState,
    normalizeBeneficiary,
    normalizeCategory,
    normalizeCreditCard,
    normalizeCreditCardInvoice,
    normalizeFinanceSnapshot,
    normalizePlanningState,
    normalizeStoredTransaction,
    normalizeTag,
    normalizeTransactionGroup,
    normalizeTransactionStatus,
    normalizeWishItem,
    normalizeWallet,
    normalizeWalletId,
    type StoredTransaction,
    type Tag,
    type Transaction,
    type TransactionDraft,
    type TransactionGroup,
    type TransactionSeriesScope,
    type TransactionStatus,
    type TransactionTag,
    type WishItem,
    toTransactionList,
    type Wallet,
    resolveLedgerEntryDateIso,
    resolveCreditCardInvoiceStatus,
    SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID,
} from "../financeTypes";
import type {
    BulkUpdateTransactionsDraft,
    FinanceStoreValue,
    PayCreditCardInvoiceDraft,
    PersistFields,
    SetCreditCardInvoicesPaidStateDraft,
    UpdateInvoicePaymentTransactionDraft,
    UpdateTransactionDraft,
} from "./contextTypes";
import {
    createId,
    ensureWalletId,
    findCurrentUserSelfBeneficiary,
    findBeneficiaryByName,
    getTodayDate,
    roundToCents,
} from "./helpers";
import {
    collectCategoryDescendantIds,
    findUncategorizedRootCategory,
    permanentlyDeleteBeneficiaryData,
    permanentlyDeleteCategoryData,
    permanentlyDeleteCreditCardData,
    permanentlyDeleteTagData,
    permanentlyDeleteWalletData,
} from "./permanentDeletion";
import { getDefaultCategoryIconName } from "../../lib/categoryIcons";
import { buildFinanceBackupFile, downloadFinanceBackupFile, saveLocalFinanceBackup } from "../../lib/financeBackup";
import { readLocalPreferenceSection, writeLocalPreferenceSection } from "../../lib/localPreferences";
import { parseAppDate } from "../../lib/localDate";
import {
    arePlanningLocalPreferencesEqual,
    areSyncedPlanningFieldsEqual,
    extractPlanningLocalPreferences,
    mergePlanningLocalPreferences,
    normalizePlanningLocalPreferences,
    PLANNING_LOCAL_PREFERENCES_SECTION,
} from "../../lib/planningLocalPreferences";
import { buildUserProfileData, type UserProfileData } from "../../lib/userProfile";
import {
    createEmptySupabaseFinanceData,
    loadSupabaseFinanceData,
    loadSupabaseFinanceIncrementally,
    saveSupabaseFinanceData,
    subscribeToFinanceRevisionChanges,
    type SupabaseFinanceData,
} from "../../supabase/finance";
import {
    acceptSupabaseFamilyInvite,
    createSupabaseFamily,
    createSupabaseFamilyInvite,
    loadCurrentFamilyContext,
    removeSupabaseFamilyMember,
    subscribeToFamilyShareRevisionChanges,
} from "../../supabase/family";
import { getFinanceClientId, publishFinanceRevisionToTabs, subscribeToFinanceRevisionMessages } from "./crossTabSync";
import { mergeSupabaseFinanceData } from "./financeSyncMerge";
import { buildInvoiceSettlement } from "./invoiceSettlement";
import { toSupabaseFinanceData, useFinanceSyncQueue } from "./useFinanceSyncQueue";
import {
    persistTransactionSeriesSnapshotAtomically,
    updateTransactionSeriesSnapshot,
    validateTransactionSeriesUpdateInvariants,
} from "./transactionSeries";

function resolveFavoriteWalletId(candidate: unknown, wallets: Wallet[]): string {
    const normalizedCandidate = typeof candidate === "string" ? normalizeWalletId(candidate.trim()) : DEFAULT_WALLET_ID;
    if (wallets.some((wallet) => wallet.id === normalizedCandidate && wallet.isActive)) {
        return normalizedCandidate;
    }

    return (
        wallets.find((wallet) => wallet.id === DEFAULT_WALLET_ID && wallet.isActive)?.id ??
        wallets.find((wallet) => wallet.isActive)?.id ??
        wallets.find((wallet) => wallet.id === DEFAULT_WALLET_ID)?.id ??
        wallets[0]?.id ??
        DEFAULT_WALLET_ID
    );
}

function resolveFavoriteCreditCardId(candidate: unknown, creditCards: CreditCard[]): string | null {
    const normalizedCandidate = typeof candidate === "string" ? candidate.trim() : "";
    if (normalizedCandidate && creditCards.some((card) => card.id === normalizedCandidate && card.isActive)) {
        return normalizedCandidate;
    }

    return creditCards.find((card) => card.isActive)?.id ?? creditCards[0]?.id ?? null;
}

interface PreparedFinanceSnapshot {
    snapshot: FinanceSnapshot;
    favoriteWalletId: string;
    changed: boolean;
}

function prepareFinanceSnapshot(params: {
    financeSource: SupabaseFinanceData | null;
    userId: string;
    profile: UserProfileData;
    sharedBeneficiaries?: Beneficiary[];
}): PreparedFinanceSnapshot {
    const rawFavoriteWalletId = params.financeSource?.favoriteWalletId;
    const source = params.financeSource;
    const snapshot = source ? createFinanceSnapshot(
        source.wallets, source.creditCards, source.creditCardInvoices, source.favoriteCreditCardId,
        source.transactionGroups, source.transactions, source.ledgerEntries, source.beneficiaries,
        source.categories, source.tags, source.wishItems, source.transactionTags, source.planning,
    ) : normalizeFinanceSnapshot(null, params.userId, {
        defaultBeneficiaryName: params.profile.displayName,
        defaultBeneficiaryAvatarImage: params.profile.photoURL,
        sharedBeneficiaries: params.sharedBeneficiaries ?? [],
    }).snapshot;
    const favoriteWalletId = resolveFavoriteWalletId(rawFavoriteWalletId, snapshot.wallets);
    return { snapshot, favoriteWalletId, changed: !source };
}

function applyLocalPlanningPreferences(snapshot: FinanceSnapshot, userId: string | null | undefined): FinanceSnapshot {
    const fallbackPreferences = extractPlanningLocalPreferences(snapshot.planning);
    const localPreferences = readLocalPreferenceSection(
        userId,
        PLANNING_LOCAL_PREFERENCES_SECTION,
        fallbackPreferences,
        normalizePlanningLocalPreferences,
    );

    if (!localPreferences.exists) {
        writeLocalPreferenceSection(userId, PLANNING_LOCAL_PREFERENCES_SECTION, fallbackPreferences);
    }

    return {
        ...snapshot,
        planning: mergePlanningLocalPreferences(snapshot.planning, localPreferences.value),
    };
}

function compareCreditCardsByCreatedAt(a: CreditCard, b: CreditCard): number {
    if (a.createdAt === b.createdAt) {
        return a.id.localeCompare(b.id);
    }
    return a.createdAt.localeCompare(b.createdAt);
}

function normalizeSeriesScope(scope: TransactionSeriesScope | null | undefined): TransactionSeriesScope {
    if (scope === "all" || scope === "this_and_next") {
        return scope;
    }
    return "single";
}

export function useFinanceStore(): FinanceStoreValue {
    const { user, loading: authLoading, profileVersion } = useAuthListener();

    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [family, setFamily] = useState<FamilySummary | null>(null);
    const [sharedWishlists, setSharedWishlists] = useState<SharedWishlistSnapshot[]>([]);
    const [favoriteWalletId, setFavoriteWalletId] = useState(DEFAULT_WALLET_ID);
    const [favoriteCreditCardId, setFavoriteCreditCardId] = useState<string | null>(null);
    const [wallets, setWallets] = useState<Wallet[]>([DEFAULT_WALLET]);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [creditCardInvoices, setCreditCardInvoices] = useState<CreditCardInvoice[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [wishItems, setWishItems] = useState<WishItem[]>([]);
    const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
    const [storedTransactions, setStoredTransactions] = useState<StoredTransaction[]>([]);
    const [transactionTags, setTransactionTags] = useState<TransactionTag[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
    const [planning, setPlanning] = useState<PlanningState>(DEFAULT_PLANNING_STATE);
    const [financeLoading, setFinanceLoading] = useState(true);

    const profileRef = useRef(profile);
    const walletsRef = useRef(wallets);
    const familyRef = useRef(family);
    const sharedWishlistsRef = useRef(sharedWishlists);
    const favoriteWalletIdRef = useRef(favoriteWalletId);
    const favoriteCreditCardIdRef = useRef(favoriteCreditCardId);
    const creditCardsRef = useRef(creditCards);
    const creditCardInvoicesRef = useRef(creditCardInvoices);
    const beneficiariesRef = useRef(beneficiaries);
    const categoriesRef = useRef(categories);
    const tagsRef = useRef(tags);
    const wishItemsRef = useRef(wishItems);
    const transactionGroupsRef = useRef(transactionGroups);
    const storedTransactionsRef = useRef(storedTransactions);
    const transactionTagsRef = useRef(transactionTags);
    const ledgerEntriesRef = useRef(ledgerEntries);
    const planningRef = useRef(planning);
    const financeClientId = useMemo(() => getFinanceClientId(), []);
    const currentRevisionRef = useRef(0);
    const lastAcknowledgedDataRef = useRef<SupabaseFinanceData | null>(null);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    useEffect(() => {
        walletsRef.current = wallets;
    }, [wallets]);

    useEffect(() => {
        familyRef.current = family;
    }, [family]);

    useEffect(() => {
        sharedWishlistsRef.current = sharedWishlists;
    }, [sharedWishlists]);

    useEffect(() => {
        favoriteWalletIdRef.current = favoriteWalletId;
    }, [favoriteWalletId]);

    useEffect(() => {
        favoriteCreditCardIdRef.current = favoriteCreditCardId;
    }, [favoriteCreditCardId]);

    useEffect(() => {
        creditCardsRef.current = creditCards;
    }, [creditCards]);

    useEffect(() => {
        creditCardInvoicesRef.current = creditCardInvoices;
    }, [creditCardInvoices]);

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
        wishItemsRef.current = wishItems;
    }, [wishItems]);

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

    useEffect(() => {
        planningRef.current = planning;
    }, [planning]);

    const setSnapshotState = useCallback((snapshot: FinanceSnapshot) => {
        walletsRef.current = snapshot.wallets;
        creditCardsRef.current = snapshot.creditCards;
        creditCardInvoicesRef.current = snapshot.creditCardInvoices;
        favoriteCreditCardIdRef.current = snapshot.favoriteCreditCardId;
        beneficiariesRef.current = snapshot.beneficiaries;
        categoriesRef.current = snapshot.categories;
        tagsRef.current = snapshot.tags;
        wishItemsRef.current = snapshot.wishItems;
        transactionGroupsRef.current = snapshot.transactionGroups;
        storedTransactionsRef.current = snapshot.transactions;
        transactionTagsRef.current = snapshot.transactionTags;
        ledgerEntriesRef.current = snapshot.ledgerEntries;
        planningRef.current = snapshot.planning;

        setWallets(snapshot.wallets);
        setCreditCards(snapshot.creditCards);
        setCreditCardInvoices(snapshot.creditCardInvoices);
        setFavoriteCreditCardId(snapshot.favoriteCreditCardId);
        setBeneficiaries(snapshot.beneficiaries);
        setCategories(snapshot.categories);
        setTags(snapshot.tags);
        setWishItems(snapshot.wishItems);
        setTransactionGroups(snapshot.transactionGroups);
        setStoredTransactions(snapshot.transactions);
        setTransactionTags(snapshot.transactionTags);
        setLedgerEntries(snapshot.ledgerEntries);
        setPlanning(snapshot.planning);
    }, []);

    const setFamilyState = useCallback((nextFamily: FamilySummary | null, nextSharedWishlists: SharedWishlistSnapshot[]) => {
        familyRef.current = nextFamily;
        sharedWishlistsRef.current = nextSharedWishlists;
        setFamily(nextFamily);
        setSharedWishlists(nextSharedWishlists);
    }, []);

    const saveLocalSnapshotBackup = useCallback(
        (snapshot: FinanceSnapshot, trigger: string, favoriteWalletIdOverride?: string | null) => {
            if (!user) {
                return;
            }

            const resolvedProfile = profileRef.current ?? buildUserProfileData(user);
            saveLocalFinanceBackup({
                uid: user.uid,
                email: user.email ?? null,
                displayName: resolvedProfile.displayName,
                favoriteWalletId: favoriteWalletIdOverride ?? favoriteWalletIdRef.current,
                finance: snapshot,
                trigger,
            });
        },
        [user],
    );

    const buildSnapshot = useCallback((overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => {
        return createFinanceSnapshot(
            overrides.wallets ?? walletsRef.current,
            overrides.creditCards ?? creditCardsRef.current,
            overrides.creditCardInvoices ?? creditCardInvoicesRef.current,
            overrides.favoriteCreditCardId ?? favoriteCreditCardIdRef.current,
            overrides.transactionGroups ?? transactionGroupsRef.current,
            overrides.transactions ?? storedTransactionsRef.current,
            overrides.ledgerEntries ?? ledgerEntriesRef.current,
            overrides.beneficiaries ?? beneficiariesRef.current,
            overrides.categories ?? categoriesRef.current,
            overrides.tags ?? tagsRef.current,
            overrides.wishItems ?? wishItemsRef.current,
            overrides.transactionTags ?? transactionTagsRef.current,
            overrides.planning ?? planningRef.current,
        );
    }, []);

    const applySupabaseFinanceData = useCallback(
        (params: { financeData: SupabaseFinanceData | null; revision: number; profile: UserProfileData; trigger: string }) => {
            const preparedFinance = prepareFinanceSnapshot({
                financeSource: params.financeData,
                userId: user?.uid ?? "",
                profile: params.profile,
            });
            const localSnapshot = applyLocalPlanningPreferences(preparedFinance.snapshot, user?.uid);
            const acknowledgedData = params.financeData ?? createEmptySupabaseFinanceData();

            currentRevisionRef.current = params.revision;
            lastAcknowledgedDataRef.current = acknowledgedData;
            favoriteWalletIdRef.current = preparedFinance.favoriteWalletId;
            setProfile(params.profile);
            setSnapshotState(localSnapshot);
            setFavoriteWalletId(preparedFinance.favoriteWalletId);
            saveLocalSnapshotBackup(localSnapshot, params.trigger, preparedFinance.favoriteWalletId);

            return {
                preparedFinance: {
                    ...preparedFinance,
                    snapshot: localSnapshot,
                },
                acknowledgedData,
            };
        },
        [saveLocalSnapshotBackup, setFamilyState, setSnapshotState, user?.uid],
    );

    const applyConfirmedRevision = useCallback(
        (financeData: SupabaseFinanceData, revision: number) => {
            const resolvedProfile = profileRef.current ?? (user ? buildUserProfileData(user) : null);
            if (resolvedProfile) {
                applySupabaseFinanceData({
                    financeData,
                    revision,
                    profile: resolvedProfile,
                    trigger: "sync-accepted",
                });
            } else {
                currentRevisionRef.current = revision;
                lastAcknowledgedDataRef.current = financeData;
            }
            if (user) {
                publishFinanceRevisionToTabs(user.uid, revision, financeClientId);
            }
        },
        [applySupabaseFinanceData, financeClientId, user],
    );

    const mergeAndPrepareFinanceData = useCallback(
        (params: { baseData: SupabaseFinanceData; remoteData: SupabaseFinanceData; targetData: SupabaseFinanceData }): SupabaseFinanceData => {
            const resolvedProfile = profileRef.current ?? (user ? buildUserProfileData(user) : null);
            const mergedData = mergeSupabaseFinanceData(params);
            if (!resolvedProfile) {
                return mergedData;
            }

            const preparedFinance = prepareFinanceSnapshot({
                financeSource: mergedData,
                userId: user?.uid ?? "",
                profile: resolvedProfile,
            });

            return toSupabaseFinanceData(preparedFinance.snapshot, preparedFinance.favoriteWalletId);
        },
        [user],
    );

    const applyConflictMergedData = useCallback(
        (financeData: SupabaseFinanceData, baseData: SupabaseFinanceData, revision: number) => {
            const resolvedProfile = profileRef.current ?? (user ? buildUserProfileData(user) : null);
            if (!resolvedProfile) {
                return;
            }

            const preparedFinance = prepareFinanceSnapshot({
                financeSource: financeData,
                userId: user?.uid ?? "",
                profile: resolvedProfile,
            });
            const localSnapshot = applyLocalPlanningPreferences(preparedFinance.snapshot, user?.uid);

            currentRevisionRef.current = revision;
            lastAcknowledgedDataRef.current = baseData;
            favoriteWalletIdRef.current = preparedFinance.favoriteWalletId;
            setProfile(resolvedProfile);
            setSnapshotState(localSnapshot);
            setFavoriteWalletId(preparedFinance.favoriteWalletId);
            saveLocalSnapshotBackup(localSnapshot, "revision-conflict-merge", preparedFinance.favoriteWalletId);
        },
        [saveLocalSnapshotBackup, setFamilyState, setSnapshotState, user],
    );

    const backupPendingData = useCallback(async (financeData: SupabaseFinanceData) => {
        if (!user) throw new Error("Entre na sua conta para salvar a cópia local.");
        const resolvedProfile = profileRef.current ?? buildUserProfileData(user);
        const prepared = prepareFinanceSnapshot({ financeSource: financeData, userId: user.uid, profile: resolvedProfile });
        const backup = { uid: user.uid, finance: prepared.snapshot, favoriteWalletId: prepared.favoriteWalletId };
        await saveLocalFinanceBackup({ ...backup, trigger: "before-sync-recovery" });
        downloadFinanceBackupFile(buildFinanceBackupFile(backup), "prism-alteracoes-nao-sincronizadas");
    }, [user]);

    const financeSync = useFinanceSyncQueue({
        userId: user?.uid ?? null,
        clientId: financeClientId,
        saveFinanceData: saveSupabaseFinanceData,
        loadFinanceData: loadSupabaseFinanceData,
        mergeFinanceData: mergeAndPrepareFinanceData,
        onSyncAccepted: applyConfirmedRevision,
        onConflictMerged: applyConflictMergedData,
        backupPendingData,
    });
    const {
        enqueueSync: enqueueFinanceSync,
        getPendingSyncData,
        hydratedUserId: pendingSyncHydratedUserId,
        hasPendingSync: hasPendingFinanceSync,
        retrySync: retryFinanceSync,
    } = financeSync;

    const refreshFamilyState = useCallback(
        async () => {
            if (!user) {
                setFamilyState(null, []);
                return;
            }

            const familyContext = await loadCurrentFamilyContext();
            setFamilyState(familyContext.family, familyContext.sharedWishlists);
        },
        [setFamilyState, user],
    );

    useEffect(() => {
        const familyId = family?.id;
        if (!familyId || !user) {
            return;
        }

        return subscribeToFamilyShareRevisionChanges(familyId, (change) => {
            if (change.updatedBy !== user.uid) {
                void refreshFamilyState().catch((error) => {
                    console.error("Failed to refresh shared family data:", error);
                });
            }
        });
    }, [family?.id, refreshFamilyState, user]);

    useEffect(() => {
        let isActive = true;

        const loadFinance = async () => {
            if (!user) {
                if (isActive) {
                    const empty = normalizeFinanceSnapshot(null, null).snapshot;
                    setProfile(null);
                    setSnapshotState(empty);
                    setFamilyState(null, []);
                    setFavoriteWalletId(resolveFavoriteWalletId(DEFAULT_WALLET_ID, empty.wallets));
                    setFinanceLoading(false);
                }
                return;
            }

            if (pendingSyncHydratedUserId !== user.uid) {
                setFinanceLoading(true);
                return;
            }

            setFinanceLoading(true);

            const profile = buildUserProfileData(user, {
                preferCurrentProfilePhoto: true,
            });
            const pendingSyncFinance = getPendingSyncData();

            try {
                if (isActive) {
                    setProfile(profile);
                }
                const supabaseFinance = await loadSupabaseFinanceData(user.uid);
                const remoteAcknowledgedData = supabaseFinance.data ?? createEmptySupabaseFinanceData();
                const financeSource = pendingSyncFinance ?? supabaseFinance.data;
                const preparedFinance = prepareFinanceSnapshot({
                    financeSource,
                    userId: user.uid,
                    profile,
                });
                const localSnapshot = applyLocalPlanningPreferences(preparedFinance.snapshot, user.uid);
                const familyContext = await loadCurrentFamilyContext().catch((error) => {
                    console.error("Failed to load family data:", error);
                    return { family: null, sharedWishlists: [] };
                });

                if (!isActive) {
                    return;
                }

                currentRevisionRef.current = supabaseFinance.revision;
                lastAcknowledgedDataRef.current = remoteAcknowledgedData;
                favoriteWalletIdRef.current = preparedFinance.favoriteWalletId;
                setSnapshotState(localSnapshot);
                setFavoriteWalletId(preparedFinance.favoriteWalletId);
                setFamilyState(familyContext.family, familyContext.sharedWishlists);
                saveLocalSnapshotBackup(localSnapshot, "load-success", preparedFinance.favoriteWalletId);

                if (!pendingSyncFinance && (!supabaseFinance.data || preparedFinance.changed)) {
                    enqueueFinanceSync(toSupabaseFinanceData(localSnapshot, preparedFinance.favoriteWalletId), {
                        baseRevision: supabaseFinance.revision,
                        baseData: remoteAcknowledgedData,
                    });
                } else if (pendingSyncFinance) {
                    retryFinanceSync();
                }
            } catch (error) {
                console.error("Failed to load finance data:", error);
                if (isActive) {
                    setProfile(profile);
                    const fallback = prepareFinanceSnapshot({
                        financeSource: pendingSyncFinance,
                        userId: user.uid,
                        profile,
                    });
                    setSnapshotState(fallback.snapshot);
                    setFamilyState(null, []);
                    setFavoriteWalletId(fallback.favoriteWalletId);
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
    }, [enqueueFinanceSync, getPendingSyncData, pendingSyncHydratedUserId, profileVersion, refreshFamilyState, retryFinanceSync, saveLocalSnapshotBackup, setFamilyState, setSnapshotState, user]);

    const refreshFromConfirmedRevision = useCallback(
        async (revision: number, trigger: string, updatedBy: string | null) => {
            if (!user || revision <= currentRevisionRef.current) {
                return;
            }

            if (updatedBy === financeClientId) {
                currentRevisionRef.current = Math.max(currentRevisionRef.current, revision);
                return;
            }

            if (hasPendingFinanceSync) {
                retryFinanceSync();
                return;
            }

            try {
                const acknowledgedData = lastAcknowledgedDataRef.current;
                const incremental = acknowledgedData
                    ? await loadSupabaseFinanceIncrementally(acknowledgedData, currentRevisionRef.current)
                    : null;
                const loadedFinance = !incremental || incremental.requiresFullReload
                    ? await loadSupabaseFinanceData(user.uid)
                    : { data: incremental.data, revision: incremental.revision, tombstones: [] };
                if (loadedFinance.revision <= currentRevisionRef.current) {
                    return;
                }
                if (getPendingSyncData()) {
                    retryFinanceSync();
                    return;
                }

                const resolvedProfile = profileRef.current ?? buildUserProfileData(user);
                applySupabaseFinanceData({
                    financeData: loadedFinance.data,
                    revision: loadedFinance.revision,
                    profile: resolvedProfile,
                    trigger,
                });
                setFinanceLoading(false);
            } catch (error) {
                console.error("Failed to refresh finance data after revision update:", error);
            }
        },
        [applySupabaseFinanceData, financeClientId, getPendingSyncData, hasPendingFinanceSync, retryFinanceSync, user],
    );

    useEffect(() => {
        if (!user) {
            currentRevisionRef.current = 0;
            lastAcknowledgedDataRef.current = null;
            return;
        }

        return subscribeToFinanceRevisionChanges(user.uid, (change) => {
            void refreshFromConfirmedRevision(change.revision, "supabase-realtime", change.updatedBy);
        });
    }, [refreshFromConfirmedRevision, user]);

    useEffect(() => {
        if (!user) {
            return;
        }

        return subscribeToFinanceRevisionMessages(user.uid, (message) => {
            void refreshFromConfirmedRevision(message.revision, "cross-tab-revision", message.updatedBy);
        });
    }, [refreshFromConfirmedRevision, user]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handleStorage = () => {
            const localPreferences = readLocalPreferenceSection(
                user?.uid,
                PLANNING_LOCAL_PREFERENCES_SECTION,
                extractPlanningLocalPreferences(planningRef.current),
                normalizePlanningLocalPreferences,
            );
            if (!localPreferences.exists) {
                return;
            }

            const nextPlanning = mergePlanningLocalPreferences(planningRef.current, localPreferences.value);
            if (arePlanningLocalPreferencesEqual(planningRef.current, nextPlanning)) {
                return;
            }

            setSnapshotState(buildSnapshot({ planning: nextPlanning }));
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [buildSnapshot, setSnapshotState, user?.uid]);

    const persistFinanceFields = useCallback(
        (fields: PersistFields) => {
            if (!user) {
                return;
            }

            const snapshot = buildSnapshot({
                wallets: fields.wallets,
                creditCards: fields.creditCards,
                creditCardInvoices: fields.creditCardInvoices,
                favoriteCreditCardId: fields.favoriteCreditCardId,
                transactionGroups: fields.transactionGroups,
                transactions: fields.transactions,
                ledgerEntries: fields.ledgerEntries,
                beneficiaries: fields.beneficiaries,
                categories: fields.categories,
                tags: fields.tags,
                wishItems: fields.wishItems,
                transactionTags: fields.transactionTags,
                planning: fields.planning,
            });

            const resolvedFavoriteWalletId = fields.favoriteWalletId ?? favoriteWalletIdRef.current;
            if (lastAcknowledgedDataRef.current) assertInvoiceMutation(lastAcknowledgedDataRef.current, snapshot);
            const financeData = toSupabaseFinanceData(snapshot, resolvedFavoriteWalletId);
            saveLocalSnapshotBackup(snapshot, "persist-fields", resolvedFavoriteWalletId);
            enqueueFinanceSync(financeData, {
                baseRevision: currentRevisionRef.current,
                baseData: lastAcknowledgedDataRef.current ?? financeData,
            });
        },
        [buildSnapshot, enqueueFinanceSync, saveLocalSnapshotBackup, user],
    );

    const persistFullSnapshot = useCallback(
        (snapshot: FinanceSnapshot) => {
            persistFinanceFields({
                wallets: snapshot.wallets,
                creditCards: snapshot.creditCards,
                creditCardInvoices: snapshot.creditCardInvoices,
                favoriteCreditCardId: snapshot.favoriteCreditCardId,
                transactionGroups: snapshot.transactionGroups,
                transactions: snapshot.transactions,
                ledgerEntries: snapshot.ledgerEntries,
                beneficiaries: snapshot.beneficiaries,
                beneficiaryOrder: snapshot.beneficiaries.map((beneficiary) => beneficiary.id),
                categories: snapshot.categories,
                tags: snapshot.tags,
                wishItems: snapshot.wishItems,
                transactionTags: snapshot.transactionTags,
                planning: snapshot.planning,
                favoriteWalletId: favoriteWalletIdRef.current,
            });
        },
        [persistFinanceFields],
    );

    const createFamily = useCallback(
        async (familyName?: string) => {
            await createSupabaseFamily(familyName);
            await refreshFamilyState();
        },
        [refreshFamilyState],
    );

    const generateFamilyInvite = useCallback(async () => {
        const familyId = familyRef.current?.id;
        if (!familyId) {
            throw new Error("Crie ou entre em uma familia antes de gerar um convite.");
        }
        const invite = await createSupabaseFamilyInvite(familyId);
        await refreshFamilyState();
        return invite;
    }, [refreshFamilyState]);

    const joinFamilyByCode = useCallback(
        async (code: string) => {
            await acceptSupabaseFamilyInvite(code);
            await refreshFamilyState();
        },
        [refreshFamilyState],
    );

    const removeFamilyMember = useCallback(
        async (memberUid: string) => {
            const familyId = familyRef.current?.id;
            if (!familyId) {
                return;
            }
            await removeSupabaseFamilyMember(familyId, memberUid);
            await refreshFamilyState();
        },
        [refreshFamilyState],
    );

    const updateFinance = useCallback(
        async (newFinance: FinanceSnapshot) => {
            const resolvedProfile = profileRef.current ?? (user ? buildUserProfileData(user) : null);
            const normalized = normalizeFinanceSnapshot(newFinance, user?.uid ?? null, {
                defaultBeneficiaryName: resolvedProfile?.displayName,
                defaultBeneficiaryAvatarImage: resolvedProfile?.photoURL ?? null,
                sharedBeneficiaries: beneficiariesRef.current.filter((beneficiary) => beneficiary.source === "family_shared"),
            }).snapshot;
            setSnapshotState(normalized);
            await persistFullSnapshot(normalized);
        },
        [persistFullSnapshot, setSnapshotState, user],
    );

    const updatePlanningState = useCallback(
        async (nextPlanning: PlanningState) => {
            const previousPlanning = planningRef.current;
            const normalizedPlanning = normalizePlanningState(nextPlanning);
            const snapshot = buildSnapshot({ planning: normalizedPlanning });
            setSnapshotState(snapshot);

            if (!arePlanningLocalPreferencesEqual(previousPlanning, normalizedPlanning)) {
                writeLocalPreferenceSection(user?.uid, PLANNING_LOCAL_PREFERENCES_SECTION, extractPlanningLocalPreferences(normalizedPlanning));
            }

            if (!areSyncedPlanningFieldsEqual(previousPlanning, normalizedPlanning)) {
                await persistFinanceFields({
                    planning: snapshot.planning,
                });
            }
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, user?.uid],
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

    const setWalletActive = useCallback(
        async (walletId: string, isActive: boolean) => {
            const normalizedWalletId = normalizeWalletId(walletId);
            if (normalizedWalletId === DEFAULT_WALLET_ID && !isActive) {
                return;
            }

            let changed = false;
            const nextWallets = walletsRef.current.map((wallet) => {
                if (wallet.id !== normalizedWalletId || wallet.isActive === isActive) {
                    return wallet;
                }

                changed = true;
                return {
                    ...wallet,
                    isActive,
                };
            });

            if (!changed) {
                return;
            }

            const nextFavoriteWalletId = resolveFavoriteWalletId(favoriteWalletIdRef.current, nextWallets);
            const snapshot = buildSnapshot({ wallets: nextWallets });
            setSnapshotState(snapshot);
            setFavoriteWalletId(nextFavoriteWalletId);

            await persistFinanceFields({
                wallets: snapshot.wallets,
                ledgerEntries: snapshot.ledgerEntries,
                favoriteWalletId: nextFavoriteWalletId,
            });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const deleteWallet = useCallback(
        async (walletId: string) => {
            const normalizedWalletId = normalizeWalletId(walletId);
            if (normalizedWalletId === DEFAULT_WALLET_ID) {
                return;
            }

            const targetWallet = walletsRef.current.find((wallet) => wallet.id === normalizedWalletId);
            if (!targetWallet || !targetWallet.isActive) {
                return;
            }

            await setWalletActive(normalizedWalletId, false);
        },
        [setWalletActive],
    );

    const permanentlyDeleteWallet = useCallback(
        async (walletId: string) => {
            const normalizedWalletId = normalizeWalletId(walletId);
            if (normalizedWalletId === DEFAULT_WALLET_ID) {
                return;
            }

            const targetWallet = walletsRef.current.find((wallet) => wallet.id === normalizedWalletId);
            if (!targetWallet || targetWallet.isActive) {
                return;
            }

            const deleted = permanentlyDeleteWalletData({
                walletId: normalizedWalletId,
                wallets: walletsRef.current,
                creditCards: creditCardsRef.current,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                transactionTags: transactionTagsRef.current,
                ledgerEntries: ledgerEntriesRef.current,
            });

            const nextGroups = recalculateGroupTotals(deleted.transactionGroups, deleted.transactions);
            const nextFavoriteWalletId = resolveFavoriteWalletId(favoriteWalletIdRef.current, deleted.wallets);
            const nextFavoriteCreditCardId = resolveFavoriteCreditCardId(favoriteCreditCardIdRef.current, deleted.creditCards);
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: deleted.creditCards,
                transactionGroups: nextGroups,
                transactions: deleted.transactions,
                existingInvoices: creditCardInvoicesRef.current,
            });
            const finalGroups = recalculateGroupTotals(nextGroups, syncedInvoices.transactions);

            const snapshot = buildSnapshot({
                wallets: deleted.wallets,
                creditCards: deleted.creditCards,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                transactions: syncedInvoices.transactions,
                transactionGroups: finalGroups,
                transactionTags: deleted.transactionTags,
                ledgerEntries: deleted.ledgerEntries,
                favoriteCreditCardId: nextFavoriteCreditCardId,
            });

            setSnapshotState(snapshot);
            setFavoriteWalletId(nextFavoriteWalletId);
            favoriteWalletIdRef.current = nextFavoriteWalletId;
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
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

    const addCreditCard = useCallback(
        async (newCreditCard: CreditCard) => {
            const normalizedCard = normalizeCreditCard(newCreditCard, new Set(walletsRef.current.map((wallet) => wallet.id)));
            const nextCreditCards = (creditCardsRef.current.some((item) => item.id === normalizedCard.id)
                ? creditCardsRef.current.map((item) => (item.id === normalizedCard.id ? normalizedCard : item))
                : [...creditCardsRef.current, normalizedCard]
            ).sort(compareCreditCardsByCreatedAt);

            const nextFavoriteCreditCardId = resolveFavoriteCreditCardId(favoriteCreditCardIdRef.current, nextCreditCards);
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: nextCreditCards,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                existingInvoices: creditCardInvoicesRef.current,
            });

            const snapshot = buildSnapshot({
                creditCards: nextCreditCards,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                transactions: syncedInvoices.transactions,
                favoriteCreditCardId: nextFavoriteCreditCardId,
            });
            setSnapshotState(snapshot);

            await persistFinanceFields({
                creditCards: snapshot.creditCards,
                creditCardInvoices: snapshot.creditCardInvoices,
                transactions: snapshot.transactions,
                favoriteCreditCardId: snapshot.favoriteCreditCardId,
            });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const setFavoriteCreditCard = useCallback(
        async (creditCardId: string) => {
            const nextFavoriteCreditCardId = resolveFavoriteCreditCardId(creditCardId, creditCardsRef.current);
            if (favoriteCreditCardIdRef.current === nextFavoriteCreditCardId) {
                return;
            }

            setFavoriteCreditCardId(nextFavoriteCreditCardId);
            await persistFinanceFields({ favoriteCreditCardId: nextFavoriteCreditCardId });
        },
        [persistFinanceFields],
    );

    const setCreditCardActive = useCallback(
        async (creditCardId: string, isActive: boolean) => {
            let changed = false;
            const nextCreditCards = creditCardsRef.current
                .map((card) => {
                    if (card.id !== creditCardId || card.isActive === isActive) {
                        return card;
                    }

                    changed = true;
                    return {
                        ...card,
                        isActive,
                    };
                })
                .sort(compareCreditCardsByCreatedAt);

            if (!changed) {
                return;
            }

            const nextFavoriteCreditCardId = resolveFavoriteCreditCardId(favoriteCreditCardIdRef.current, nextCreditCards);
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: nextCreditCards,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                existingInvoices: creditCardInvoicesRef.current,
            });
            const snapshot = buildSnapshot({
                creditCards: nextCreditCards,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                transactions: syncedInvoices.transactions,
                favoriteCreditCardId: nextFavoriteCreditCardId,
            });
            setSnapshotState(snapshot);

            await persistFinanceFields({
                creditCards: snapshot.creditCards,
                creditCardInvoices: snapshot.creditCardInvoices,
                transactions: snapshot.transactions,
                favoriteCreditCardId: snapshot.favoriteCreditCardId,
            });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const deleteCreditCard = useCallback(
        async (creditCardId: string) => {
            const targetCard = creditCardsRef.current.find((card) => card.id === creditCardId);
            if (!targetCard || !targetCard.isActive) {
                return;
            }

            await setCreditCardActive(creditCardId, false);
        },
        [setCreditCardActive],
    );

    const permanentlyDeleteCreditCard = useCallback(
        async (creditCardId: string) => {
            const targetCard = creditCardsRef.current.find((card) => card.id === creditCardId);
            if (!targetCard || targetCard.isActive) {
                return;
            }

            const deleted = permanentlyDeleteCreditCardData({
                creditCardId,
                creditCards: creditCardsRef.current,
                creditCardInvoices: creditCardInvoicesRef.current,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                transactionTags: transactionTagsRef.current,
                ledgerEntries: ledgerEntriesRef.current,
            });

            const nextGroups = recalculateGroupTotals(deleted.transactionGroups, deleted.transactions);
            const nextFavoriteCreditCardId = resolveFavoriteCreditCardId(favoriteCreditCardIdRef.current, deleted.creditCards);
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: deleted.creditCards,
                transactionGroups: nextGroups,
                transactions: deleted.transactions,
                existingInvoices: deleted.creditCardInvoices,
            });
            const finalGroups = recalculateGroupTotals(nextGroups, syncedInvoices.transactions);

            const snapshot = buildSnapshot({
                creditCards: deleted.creditCards,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                transactions: syncedInvoices.transactions,
                transactionGroups: finalGroups,
                transactionTags: deleted.transactionTags,
                ledgerEntries: deleted.ledgerEntries,
                favoriteCreditCardId: nextFavoriteCreditCardId,
            });

            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const payCreditCardInvoice = useCallback(
        async ({ invoiceId, walletId, amount, paymentDate, settleWithoutWallet }: PayCreditCardInvoiceDraft) => {
            const invoice = creditCardInvoicesRef.current.find((item) => item.id === invoiceId);
            if (!invoice) {
                return;
            }

            const safeAmount = roundToCents(Number(amount));
            if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
                return;
            }

            const openAmount = calculateCreditCardInvoiceOpenAmount(invoice);
            if (safeAmount > openAmount) {
                return;
            }

            const resolvedWalletId = settleWithoutWallet || walletId === null ? null : ensureWalletId(normalizeWalletId(walletId), walletsRef.current);
            if (resolvedWalletId !== null && !walletsRef.current.some((item) => item.id === resolvedWalletId)) {
                return;
            }

            const safePaymentDate = parseAppDate(paymentDate) ? paymentDate : getTodayDate();
            const nowIso = new Date().toISOString();
            const ledgerDateIso = resolveLedgerEntryDateIso(safePaymentDate, nowIso);
            const linkedCard = creditCardsRef.current.find((card) => card.id === invoice.creditCardId) ?? null;
            const paymentDescription = `Fatura do ${linkedCard?.name ?? "cartão de crédito"}`;
            const invoicePaymentCategory =
                categoriesRef.current.find((category) => category.id === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && category.type === "expense") ??
                categoriesRef.current.find((category) => category.type === "expense") ??
                null;
            if (!invoicePaymentCategory) {
                return;
            }

            const categoryParent = invoicePaymentCategory.parentId ? categoriesRef.current.find((item) => item.id === invoicePaymentCategory.parentId) ?? null : null;
            const beneficiary =
                findCurrentUserSelfBeneficiary(beneficiariesRef.current, user?.uid) ??
                findBeneficiaryByName(beneficiariesRef.current, DEFAULT_BENEFICIARY_NAME) ??
                beneficiariesRef.current[0] ??
                null;
            const transactionId = createId("tx-invoice-payment");
            const groupId = `group-${transactionId}`;
            const invoicePaymentNote = buildInvoicePaymentNote({
                invoiceId: invoice.id,
                creditCardId: invoice.creditCardId,
            });
            const paymentGroup = normalizeTransactionGroup(
                {
                    id: groupId,
                    userId: user?.uid ?? null,
                    beneficiaryId: beneficiary?.id ?? null,
                    beneficiaryName: beneficiary?.name ?? DEFAULT_BENEFICIARY_NAME,
                    categoryId: invoicePaymentCategory.id,
                    categoryName: categoryParent?.name ?? invoicePaymentCategory.name,
                    subcategoryName: categoryParent ? invoicePaymentCategory.name : null,
                    title: paymentDescription,
                    notes: invoicePaymentNote,
                    type: "expense",
                    transactionMode: "single",
                    totalAmount: safeAmount,
                    installmentCount: null,
                    recurrenceRule: null,
                    recurrenceEndDate: null,
                    sourceWalletId: resolvedWalletId,
                    destinationWalletId: null,
                    creditCardId: null,
                    createdAt: nowIso,
                },
                new Set(walletsRef.current.map((item) => item.id)),
            );
            const paymentTransaction = normalizeStoredTransaction({
                id: transactionId,
                groupId,
                installmentNumber: null,
                amount: safeAmount,
                scheduledDate: safePaymentDate,
                status: "paid",
                paidAt: ledgerDateIso,
                invoiceId: null,
                paymentForInvoiceId: invoice.id,
                notes: invoicePaymentNote,
                createdAt: nowIso,
            });

            const nextInvoices = creditCardInvoicesRef.current.map((item) => {
                if (item.id !== invoice.id) {
                    return item;
                }

                const nextPaidAmount = roundToCents(Math.min(item.totalAmount, item.paidAmount + safeAmount));
                const nextStatus = linkedCard
                    ? resolveCreditCardInvoiceStatus({
                          invoiceCycleKey: item.cycleKey,
                          cardClosingDay: linkedCard.closingDay,
                          cardDueDay: linkedCard.dueDay,
                          totalAmount: item.totalAmount,
                          paidAmount: nextPaidAmount,
                      })
                    : nextPaidAmount >= item.totalAmount && item.totalAmount > 0
                      ? "paid"
                      : "open";

                return normalizeCreditCardInvoice(
                    {
                        ...item,
                        paidAmount: nextPaidAmount,
                        status: nextStatus,
                        paidAt: nextStatus === "paid" ? ledgerDateIso : null,
                        updatedAt: nowIso,
                    },
                    new Set(creditCardsRef.current.map((card) => card.id)),
                );
            });
            const nextGroups = [...transactionGroupsRef.current, paymentGroup];
            const nextTransactions = [...storedTransactionsRef.current, paymentTransaction];
            const nextLedgerEntries = [...ledgerEntriesRef.current, ...createLedgerEntriesForPaidTransaction(paymentTransaction, paymentGroup)];

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                creditCardInvoices: nextInvoices,
                ledgerEntries: nextLedgerEntries,
            });

            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState, user?.uid],
    );

    const setCreditCardInvoicesPaidState = useCallback(
        async ({ invoiceIds, markAsPaid }: SetCreditCardInvoicesPaidStateDraft) => {
            const settlement = buildInvoiceSettlement({
                invoiceIds,
                markAsPaid,
                userId: user?.uid ?? null,
                invoices: creditCardInvoicesRef.current,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                ledgerEntries: ledgerEntriesRef.current,
                beneficiaries: beneficiariesRef.current,
                categories: categoriesRef.current,
            });
            if (!settlement.changed) {
                return;
            }

            const snapshot = buildSnapshot({
                creditCardInvoices: settlement.invoices,
                transactionGroups: settlement.transactionGroups,
                transactions: settlement.transactions,
                ledgerEntries: settlement.ledgerEntries,
            });

            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const updateInvoicePaymentTransaction = useCallback(
        async ({ transactionId, description, beneficiaryId, date }: UpdateInvoicePaymentTransactionDraft) => {
            const transactionToUpdate = storedTransactionsRef.current.find((item) => item.id === transactionId);
            if (!transactionToUpdate) {
                return;
            }

            const invoicePaymentMeta = parseInvoicePaymentNote(transactionToUpdate.notes);
            if (!invoicePaymentMeta) {
                return;
            }

            const groupToUpdate = transactionGroupsRef.current.find((item) => item.id === transactionToUpdate.groupId);
            if (!groupToUpdate) {
                return;
            }

            const nowIso = new Date().toISOString();
            const safeDate = parseAppDate(date) ? date : transactionToUpdate.scheduledDate;
            const paidAt = resolveLedgerEntryDateIso(safeDate, transactionToUpdate.paidAt ?? nowIso);
            const safeDescription = description.trim() || groupToUpdate.title || "Pagamento de fatura";

            const requestedBeneficiaryId = beneficiaryId?.trim() ?? "";
            const resolvedBeneficiary =
                (requestedBeneficiaryId ? beneficiariesRef.current.find((item) => item.id === requestedBeneficiaryId) : null) ??
                findCurrentUserSelfBeneficiary(beneficiariesRef.current, user?.uid) ??
                findBeneficiaryByName(beneficiariesRef.current, DEFAULT_BENEFICIARY_NAME) ??
                beneficiariesRef.current[0] ??
                null;

            const nextGroup = normalizeTransactionGroup(
                {
                    ...groupToUpdate,
                    beneficiaryId: resolvedBeneficiary?.id ?? groupToUpdate.beneficiaryId,
                    beneficiaryName: resolvedBeneficiary?.name ?? groupToUpdate.beneficiaryName,
                    title: safeDescription,
                    notes: groupToUpdate.notes || buildInvoicePaymentNote(invoicePaymentMeta),
                },
                new Set(walletsRef.current.map((wallet) => wallet.id)),
            );

            const nextTransaction = normalizeStoredTransaction({
                ...transactionToUpdate,
                scheduledDate: safeDate,
                status: "paid",
                paidAt,
                notes: transactionToUpdate.notes || buildInvoicePaymentNote(invoicePaymentMeta),
            });

            const nextGroups = transactionGroupsRef.current.map((item) => (item.id === nextGroup.id ? nextGroup : item));
            const nextTransactions = storedTransactionsRef.current.map((item) => (item.id === nextTransaction.id ? nextTransaction : item));
            const nextLedgerEntries = ledgerEntriesRef.current.filter((item) => item.transactionId !== nextTransaction.id);
            nextLedgerEntries.push(...createLedgerEntriesForPaidTransaction(nextTransaction, nextGroup));

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                ledgerEntries: nextLedgerEntries,
            });

            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const addBeneficiary = useCallback(
        async (newBeneficiary: Beneficiary) => {
            const existingBeneficiary = beneficiariesRef.current.find((item) => item.id === newBeneficiary.id) ?? null;
            if (existingBeneficiary?.source === "family_shared") {
                return;
            }

            const beneficiary = normalizeBeneficiary({
                ...newBeneficiary,
                userId: newBeneficiary.userId ?? user?.uid ?? null,
                familyId: newBeneficiary.familyId ?? null,
                source: newBeneficiary.source ?? "personal",
                isSelfProfile: newBeneficiary.isSelfProfile ?? false,
                sortOrder: existingBeneficiary?.sortOrder ?? newBeneficiary.sortOrder ?? getNextSortOrder(beneficiariesRef.current),
                createdAt: newBeneficiary.createdAt ?? new Date().toISOString(),
            });

            const nextBeneficiaries = (beneficiariesRef.current.some((item) => item.id === beneficiary.id)
                ? beneficiariesRef.current.map((item) => (item.id === beneficiary.id ? beneficiary : item))
                : [...beneficiariesRef.current, beneficiary]
            ).sort(compareBySortOrderNameAndId);

            const snapshot = buildSnapshot({ beneficiaries: nextBeneficiaries });
            setSnapshotState(snapshot);
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries, beneficiaryOrder: snapshot.beneficiaries.map((beneficiary) => beneficiary.id) });
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

    const addWishItem = useCallback(
        async (newWishItem: WishItem) => {
            const existingWishItem = wishItemsRef.current.find((item) => item.id === newWishItem.id) ?? null;
            const wishItem = normalizeWishItem({
                ...newWishItem,
                userId: newWishItem.userId ?? user?.uid ?? null,
                isActive: newWishItem.isActive ?? true,
                createdAt: existingWishItem?.createdAt ?? newWishItem.createdAt ?? new Date().toISOString(),
            });

            if (!wishItem.categoryId.trim() || !wishItem.description.trim() || wishItem.value <= 0) {
                return;
            }

            const nextWishItems = (wishItemsRef.current.some((item) => item.id === wishItem.id)
                ? wishItemsRef.current.map((item) => (item.id === wishItem.id ? wishItem : item))
                : [wishItem, ...wishItemsRef.current]
            ).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

            const snapshot = buildSnapshot({ wishItems: nextWishItems });
            setSnapshotState(snapshot);
            await persistFinanceFields({ wishItems: snapshot.wishItems });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, user?.uid],
    );

    const removeWishItem = useCallback(
        async (wishItemId: string) => {
            const nextWishItems = wishItemsRef.current.filter((item) => item.id !== wishItemId);
            if (nextWishItems.length === wishItemsRef.current.length) {
                return;
            }

            const snapshot = buildSnapshot({ wishItems: nextWishItems });
            setSnapshotState(snapshot);
            await persistFinanceFields({ wishItems: snapshot.wishItems });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
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
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries, beneficiaryOrder: finalIds });
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
            const targetBeneficiary = beneficiariesRef.current.find((beneficiary) => beneficiary.id === beneficiaryId);
            if (!targetBeneficiary || targetBeneficiary.source === "family_shared" || targetBeneficiary.isSelfProfile) {
                return;
            }

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
            await persistFinanceFields({ beneficiaries: snapshot.beneficiaries, beneficiaryOrder: snapshot.beneficiaries.map((beneficiary) => beneficiary.id) });
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState],
    );

    const permanentlyDeleteBeneficiary = useCallback(
        async (beneficiaryId: string) => {
            const targetBeneficiary = beneficiariesRef.current.find((beneficiary) => beneficiary.id === beneficiaryId);
            if (!targetBeneficiary || targetBeneficiary.isActive || targetBeneficiary.source === "family_shared" || targetBeneficiary.isSelfProfile) {
                return;
            }

            let nextBeneficiaries = [...beneficiariesRef.current];
            const fallbackBeneficiary =
                findCurrentUserSelfBeneficiary(nextBeneficiaries, user?.uid) ??
                findBeneficiaryByName(nextBeneficiaries, DEFAULT_BENEFICIARY_NAME) ??
                (() => {
                    const resolvedProfile = profileRef.current ?? (user ? buildUserProfileData(user) : null);
                    const created = normalizeBeneficiary({
                        id: createId("beneficiary"),
                        userId: user?.uid ?? null,
                        familyId: null,
                        source: "personal",
                        isSelfProfile: false,
                        name: resolvedProfile?.displayName ?? DEFAULT_BENEFICIARY_NAME,
                        type: "person",
                        avatarColor: null,
                        avatarImage: resolvedProfile?.photoURL ?? null,
                        isActive: true,
                        sortOrder: getNextSortOrder(nextBeneficiaries),
                        createdAt: new Date().toISOString(),
                    });
                    nextBeneficiaries = [...nextBeneficiaries, created];
                    return created;
                })();

            const deleted = permanentlyDeleteBeneficiaryData({
                beneficiaryId,
                beneficiaries: nextBeneficiaries,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                fallbackBeneficiary,
            });

            const snapshot = buildSnapshot({
                beneficiaries: deleted.beneficiaries.sort(compareBySortOrderNameAndId),
                transactionGroups: deleted.transactionGroups,
                transactions: deleted.transactions,
            });
            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState, user],
    );

    const setCategoryActive = useCallback(
        async (categoryId: string, isActive: boolean) => {
            const targetCategory = categoriesRef.current.find((category) => category.id === categoryId);
            if (!targetCategory) {
                return;
            }

            if (categoryId === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && !isActive) {
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

                    if (category.id === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && !isActive) {
                        return {
                            ...category,
                            isActive: true,
                        };
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

    const permanentlyDeleteCategory = useCallback(
        async (categoryId: string) => {
            const targetCategory = categoriesRef.current.find((category) => category.id === categoryId);
            if (!targetCategory || targetCategory.isActive || categoryId === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID) {
                return;
            }

            let nextCategories = [...categoriesRef.current];
            const affectedIds = collectCategoryDescendantIds(nextCategories, categoryId);
            affectedIds.add(categoryId);
            nextCategories = nextCategories.filter((category) => !affectedIds.has(category.id));

            const fallbackCategory =
                findUncategorizedRootCategory(nextCategories, targetCategory.type) ??
                (() => {
                    const created = normalizeCategory({
                        id: createId("category"),
                        userId: user?.uid ?? null,
                        parentId: null,
                        name: "Sem categoria",
                        type: targetCategory.type,
                        icon: getDefaultCategoryIconName(targetCategory.type),
                        color: null,
                        isActive: true,
                        isSystem: false,
                        sortOrder: getNextSortOrder(nextCategories.filter((category) => category.type === targetCategory.type && category.parentId === null)),
                        createdAt: new Date().toISOString(),
                    });
                    nextCategories = [...nextCategories, created];
                    return created;
                })();

            const deleted = permanentlyDeleteCategoryData({
                categoryId,
                categories: categoriesRef.current,
                transactionGroups: transactionGroupsRef.current,
                transactions: storedTransactionsRef.current,
                wishItems: wishItemsRef.current,
                fallbackCategory,
            });

            const snapshot = buildSnapshot({
                categories: [...nextCategories].sort(compareCategoriesByTypeParentSort),
                transactionGroups: deleted.transactionGroups,
                transactions: deleted.transactions,
                wishItems: deleted.wishItems,
            });
            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState, user],
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

    const permanentlyDeleteTag = useCallback(
        async (tagId: string) => {
            const targetTag = tagsRef.current.find((tag) => tag.id === tagId);
            if (!targetTag || targetTag.isActive) {
                return;
            }

            const deleted = permanentlyDeleteTagData({
                tagId,
                tags: tagsRef.current,
                transactionTags: transactionTagsRef.current,
                transactionGroups: transactionGroupsRef.current,
            });

            const snapshot = buildSnapshot({
                tags: deleted.tags.sort(compareBySortOrderNameAndId),
                transactionTags: deleted.transactionTags,
                transactionGroups: deleted.transactionGroups,
            });
            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const clearTransactions = useCallback(async () => {
        const snapshot = buildSnapshot({
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            transactionTags: [],
            creditCardInvoices: [],
        });
        setSnapshotState(snapshot);

        await persistFinanceFields({
            wallets: snapshot.wallets,
            transactionGroups: [],
            transactions: [],
            ledgerEntries: [],
            transactionTags: [],
            creditCardInvoices: [],
        });
    }, [buildSnapshot, persistFinanceFields, setSnapshotState]);

    const addTransaction = useCallback(async (draft: TransactionDraft) => {
        const snapshot = createTransactionSnapshot(buildSnapshot(), draft, {
            userId: user?.uid, displayName: user ? buildUserProfileData(user).displayName : DEFAULT_BENEFICIARY_NAME,
        });
        persistFullSnapshot(snapshot);
        setSnapshotState(snapshot);
    }, [buildSnapshot, persistFullSnapshot, setSnapshotState, user]);

    const materializeTransaction = useCallback(async (transactionId: string) => {
        const before = buildSnapshot();
        const next = materializeOccurrence(before, transactionId);
        if (next === before) return;
        const invoices = syncCreditCardInvoices({ creditCards: next.creditCards, transactionGroups: next.transactionGroups, transactions: next.transactions, existingInvoices: next.creditCardInvoices });
        const snapshot = buildSnapshot({ ...next, transactions: invoices.transactions, creditCardInvoices: invoices.creditCardInvoices });
        persistFullSnapshot(snapshot);
        setSnapshotState(snapshot);
    }, [buildSnapshot, persistFullSnapshot, setSnapshotState]);

    const setTransactionStatus = useCallback(
        async (transaction: Transaction, status: TransactionStatus) => {
            const before = materializeOccurrence(buildSnapshot(), transaction.id);
            const updated = applyTransactionStatus(before, transaction.id, normalizeTransactionStatus(status));
            if (updated === before) return;
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: updated.creditCards,
                transactionGroups: updated.transactionGroups,
                transactions: updated.transactions,
                existingInvoices: updated.creditCardInvoices,
            });
            const snapshot = buildSnapshot({
                ...updated,
                transactions: syncedInvoices.transactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
            });
            persistFullSnapshot(snapshot);
            setSnapshotState(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const markTransactionAsPaid = useCallback(
        async (transaction: Transaction) => {
            const current = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!current || current.status === "pending") await setTransactionStatus(transaction, "paid");
        },
        [setTransactionStatus],
    );

    const deleteTransactionWithScope = useCallback(async (transaction: Transaction, scope: TransactionSeriesScope = "single") => {
        const snapshot = buildSnapshot(deleteTransactionsSnapshot(buildSnapshot(), transaction.id, scope));
        persistFullSnapshot(snapshot);
        setSnapshotState(snapshot);
    }, [buildSnapshot, persistFullSnapshot, setSnapshotState]);

    const deleteTransaction = useCallback(
        async (transaction: Transaction) => {
            await deleteTransactionWithScope(transaction, "single");
        },
        [deleteTransactionWithScope],
    );

    const updateTransactionsBulk = useCallback(async (draft: BulkUpdateTransactionsDraft) => {
        const before = buildSnapshot();
        const updated = updateTransactionsBulkSnapshot(before, draft);
        const invoices = syncCreditCardInvoices({ creditCards: updated.creditCards, transactionGroups: updated.transactionGroups, transactions: updated.transactions, existingInvoices: updated.creditCardInvoices });
        const snapshot = buildSnapshot({ ...updated, transactions: invoices.transactions, creditCardInvoices: invoices.creditCardInvoices });
        assertInvoiceMutation(before, snapshot);
        persistFullSnapshot(snapshot);
        setSnapshotState(snapshot);
    }, [buildSnapshot, persistFullSnapshot, setSnapshotState]);

    const updateTransaction = useCallback(
        async ({ transaction, draft, scope = "single" }: UpdateTransactionDraft) => {
            const beforeSnapshot = materializeOccurrence(buildSnapshot(), transaction.id);
            const transactionToUpdate = beforeSnapshot.transactions.find((item) => item.id === transaction.id)!;
            const normalizedScope = normalizeSeriesScope(scope);
            const nowIso = new Date().toISOString();
            const transformed = updateTransactionSeriesSnapshot({
                snapshot: beforeSnapshot,
                transactionId: transactionToUpdate.id,
                wasProjected: !storedTransactionsRef.current.some((item) => item.id === transactionToUpdate.id),
                draft,
                scope: normalizedScope,
                createGroupId: () => createId("group"),
                now: nowIso,
            });
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: transformed.snapshot.creditCards,
                transactionGroups: transformed.snapshot.transactionGroups,
                transactions: transformed.snapshot.transactions,
                existingInvoices: transformed.snapshot.creditCardInvoices,
            });
            const snapshot = buildSnapshot({
                transactionGroups: recalculateGroupTotals(transformed.snapshot.transactionGroups, syncedInvoices.transactions),
                transactions: syncedInvoices.transactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: transformed.snapshot.ledgerEntries,
                transactionTags: transformed.snapshot.transactionTags,
            });

            validateTransactionSeriesUpdateInvariants({
                before: beforeSnapshot,
                after: snapshot,
                affectedTransactionIds: transformed.affectedTransactionIds,
                metadataOnly: transformed.metadataOnly,
                preservePaidTransactions: normalizedScope !== "single",
            });

            await persistTransactionSeriesSnapshotAtomically({
                snapshot,
                persist: persistFullSnapshot,
                commit: setSnapshotState,
            });
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

    useEffect(() => {
        const resolvedFavoriteCreditCardId = resolveFavoriteCreditCardId(favoriteCreditCardIdRef.current, creditCards);
        if (resolvedFavoriteCreditCardId === favoriteCreditCardIdRef.current) {
            return;
        }

        setFavoriteCreditCardId(resolvedFavoriteCreditCardId);
        void persistFinanceFields({ favoriteCreditCardId: resolvedFavoriteCreditCardId });
    }, [creditCards, persistFinanceFields]);

    const loading = authLoading || financeLoading;
    const transactions = useMemo(
        () => toTransactionList(storedTransactions, transactionGroups, categories, beneficiaries, tags, transactionTags),
        [beneficiaries, categories, storedTransactions, tags, transactionGroups, transactionTags],
    );
    const summary = useMemo(() => calculateFinanceSummary(wallets, transactionGroups, storedTransactions), [storedTransactions, transactionGroups, wallets]);
    const balance = useMemo(() => calculateTotalBalance(wallets), [wallets]);

    return useMemo(
        () => ({
            user,
            profile,
            loading,
            profileVersion,
            family,
            sharedWishlists,
            favoriteWalletId,
            favoriteCreditCardId,
            wallets,
            creditCards,
            creditCardInvoices,
            beneficiaries,
            categories,
            tags,
            wishItems,
            transactionGroups,
            storedTransactions,
            transactionTags,
            ledgerEntries,
            transactions,
            planning,
            despesas: summary.despesas,
            receitas: summary.receitas,
            balance,
            sync: financeSync,
            setStartBalance,
            setFavoriteWallet,
            setWalletActive,
            deleteWallet,
            permanentlyDeleteWallet,
            updateFinance,
            addTransaction,
            updateTransaction,
            updateTransactionsBulk,
            materializeTransaction,
            markTransactionAsPaid,
            setTransactionStatus,
            deleteTransaction,
            deleteTransactionWithScope,
            updateInvoicePaymentTransaction,
            updatePlanningState,
            clearTransactions,
            addWallet,
            addBeneficiary,
            addCategory,
            addTag,
            addWishItem,
            reorderBeneficiaries,
            reorderCategories,
            reorderTags,
            setBeneficiaryActive,
            permanentlyDeleteBeneficiary,
            setCategoryActive,
            permanentlyDeleteCategory,
            setTagActive,
            permanentlyDeleteTag,
            addCreditCard,
            setFavoriteCreditCard,
            setCreditCardActive,
            deleteCreditCard,
            permanentlyDeleteCreditCard,
            payCreditCardInvoice,
            setCreditCardInvoicesPaidState,
            removeWishItem,
            createFamily,
            generateFamilyInvite,
            joinFamilyByCode,
            removeFamilyMember,
        }),
        [
            addBeneficiary,
            addCategory,
            addCreditCard,
            addTag,
            addWishItem,
            addTransaction,
            updateTransaction,
            updateTransactionsBulk,
            addWallet,
            createFamily,
            deleteWallet,
            balance,
            beneficiaries,
            categories,
            clearTransactions,
            creditCardInvoices,
            creditCards,
            deleteTransaction,
            deleteTransactionWithScope,
            updateInvoicePaymentTransaction,
            family,
            favoriteCreditCardId,
            favoriteWalletId,
            financeSync,
            generateFamilyInvite,
            joinFamilyByCode,
            ledgerEntries,
            loading,
            materializeTransaction,
            markTransactionAsPaid,
            setTransactionStatus,
            permanentlyDeleteBeneficiary,
            permanentlyDeleteCategory,
            permanentlyDeleteCreditCard,
            permanentlyDeleteTag,
            permanentlyDeleteWallet,
            payCreditCardInvoice,
            profile,
            removeFamilyMember,
            setCreditCardInvoicesPaidState,
            removeWishItem,
            planning,
            profileVersion,
            reorderBeneficiaries,
            reorderCategories,
            reorderTags,
            setBeneficiaryActive,
            setCategoryActive,
            setFavoriteCreditCard,
            setCreditCardActive,
            deleteCreditCard,
            setTagActive,
            setFavoriteWallet,
            setWalletActive,
            setStartBalance,
            storedTransactions,
            summary.despesas,
            summary.receitas,
            sharedWishlists,
            tags,
            wishItems,
            transactionGroups,
            transactionTags,
            transactions,
            updateFinance,
            updatePlanningState,
            user,
            wallets,
        ],
    );
}
