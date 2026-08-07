import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthListener } from "../../hooks/useAuthListener";
import type { FamilySummary, SharedWishlistSnapshot } from "../familyTypes";
import {
    buildInvoicePaymentNote,
    type Beneficiary,
    buildCreditCardInvoiceId,
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
    findDefaultCategoryId,
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
    type TransactionMode,
    type TransactionSeriesScope,
    type TransactionStatus,
    type TransactionTag,
    type WishItem,
    toTransactionList,
    type Wallet,
    parseCreditCardInvoiceId,
    resolveLedgerEntryDateIso,
    resolveCreditCardInvoiceStatus,
    resolveCreditCardInvoiceCycle,
    resolveCreditCardInvoiceCycleFromCycleKey,
    resolveExpectedCreditCardInvoiceId,
    resolveTransactionCreditCardId,
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
    findCategoryByName,
    getTodayDate,
    resolveGroupType,
    roundToCents,
    splitAmountAcrossInstallments,
    toCategoryTypeFromGroupType,
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
import { saveLocalFinanceBackup } from "../../lib/financeBackup";
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
import { loadSupabaseFinanceData, saveSupabaseFinanceData, subscribeToFinanceRevisionChanges, type SupabaseFinanceData } from "../../supabase/finance";
import { getFinanceClientId, publishFinanceRevisionToTabs, subscribeToFinanceRevisionMessages } from "./crossTabSync";
import { mergeSupabaseFinanceData } from "./financeSyncMerge";
import { ensureRecurringTransactionsHorizon } from "./recurringTransactions";
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
    const normalizedFinance = normalizeFinanceSnapshot(params.financeSource, params.userId, {
        defaultBeneficiaryName: params.profile.displayName,
        defaultBeneficiaryAvatarImage: params.profile.photoURL,
        sharedBeneficiaries: params.sharedBeneficiaries ?? [],
    });
    const recurringHydration = ensureRecurringTransactionsHorizon({
        groups: normalizedFinance.snapshot.transactionGroups,
        transactions: normalizedFinance.snapshot.transactions,
        transactionTags: normalizedFinance.snapshot.transactionTags,
        tags: normalizedFinance.snapshot.tags,
    });
    const syncedInvoices = syncCreditCardInvoices({
        creditCards: normalizedFinance.snapshot.creditCards,
        transactionGroups: recurringHydration.groups,
        transactions: recurringHydration.transactions,
        existingInvoices: normalizedFinance.snapshot.creditCardInvoices,
    });
    const snapshot = createFinanceSnapshot(
        normalizedFinance.snapshot.wallets,
        normalizedFinance.snapshot.creditCards,
        syncedInvoices.creditCardInvoices,
        normalizedFinance.snapshot.favoriteCreditCardId,
        recurringHydration.groups,
        syncedInvoices.transactions,
        normalizedFinance.snapshot.ledgerEntries,
        normalizedFinance.snapshot.beneficiaries,
        normalizedFinance.snapshot.categories,
        normalizedFinance.snapshot.tags,
        normalizedFinance.snapshot.wishItems,
        recurringHydration.transactionTags,
        normalizedFinance.snapshot.planning,
    );
    const favoriteWalletId = resolveFavoriteWalletId(rawFavoriteWalletId, snapshot.wallets);

    return {
        snapshot,
        favoriteWalletId,
        changed: normalizedFinance.changed || recurringHydration.changed || syncedInvoices.changed || favoriteWalletId !== rawFavoriteWalletId,
    };
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

function compareCreditCardInvoicesByDueDate(a: CreditCardInvoice, b: CreditCardInvoice): number {
    if (a.dueDate === b.dueDate) {
        return a.id.localeCompare(b.id);
    }
    return a.dueDate.localeCompare(b.dueDate);
}

function normalizeSeriesScope(scope: TransactionSeriesScope | null | undefined): TransactionSeriesScope {
    if (scope === "all" || scope === "this_and_next") {
        return scope;
    }
    return "single";
}

function resolveGroupCategoryFields(group: TransactionGroup, category: Category | null, categoriesById: Map<string, Category>): Pick<TransactionGroup, "categoryId" | "categoryName" | "subcategoryName"> {
    if (!category) {
        return {
            categoryId: group.categoryId,
            categoryName: group.categoryName,
            subcategoryName: group.subcategoryName,
        };
    }

    const parentCategory = category.parentId ? categoriesById.get(category.parentId) ?? null : null;

    return {
        categoryId: category.id,
        categoryName: parentCategory?.name ?? category.name,
        subcategoryName: parentCategory ? category.name : null,
    };
}

function resolveGroupBeneficiaryFields(group: TransactionGroup, beneficiary: Beneficiary | null): Pick<TransactionGroup, "beneficiaryId" | "beneficiaryName"> {
    if (!beneficiary) {
        return {
            beneficiaryId: group.beneficiaryId,
            beneficiaryName: group.beneficiaryName,
        };
    }

    return {
        beneficiaryId: beneficiary.id,
        beneficiaryName: beneficiary.name,
    };
}

function addRecurringExcludedDates(group: TransactionGroup, dates: string[], walletIds: Set<string>): TransactionGroup {
    if (group.transactionMode !== "recurring" || dates.length < 1) {
        return group;
    }

    const existingRule = group.recurrenceRule && typeof group.recurrenceRule === "object" ? group.recurrenceRule : {};
    const excludedDates = new Set<string>();

    if (Array.isArray((existingRule as Record<string, unknown>).excludedDates)) {
        for (const value of (existingRule as Record<string, unknown>).excludedDates as unknown[]) {
            if (typeof value === "string" && parseAppDate(value)) {
                excludedDates.add(value);
            }
        }
    }

    dates.forEach((date) => {
        if (parseAppDate(date)) {
            excludedDates.add(date);
        }
    });

    return normalizeTransactionGroup(
        {
            ...group,
            recurrenceRule: {
                ...existingRule,
                excludedDates: Array.from(excludedDates),
            },
        },
        walletIds,
    );
}

function compareDateValue(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function parseInvoiceCycleKey(cycleKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(cycleKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        year,
        monthIndex: month - 1,
    };
}

function shiftInvoiceCycleKey(cycleKey: string, offset: number): string {
    const parsedCycleKey = parseInvoiceCycleKey(cycleKey);
    if (!parsedCycleKey || !Number.isFinite(offset) || offset === 0) {
        return cycleKey;
    }

    const shifted = new Date(parsedCycleKey.year, parsedCycleKey.monthIndex + offset, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function getInstallmentOrderValue(transaction: Pick<StoredTransaction, "installmentNumber">): number {
    const installmentNumber = transaction.installmentNumber;
    return Number.isInteger(installmentNumber) && Number(installmentNumber) > 0 ? Number(installmentNumber) : Number.MAX_SAFE_INTEGER;
}

function compareTransactionsWithinSeries(a: StoredTransaction, b: StoredTransaction, transactionMode: TransactionMode | null | undefined): number {
    if (transactionMode === "installment") {
        const installmentComparison = getInstallmentOrderValue(a) - getInstallmentOrderValue(b);
        if (installmentComparison !== 0) {
            return installmentComparison;
        }

        if (a.createdAt === b.createdAt) {
            return a.id.localeCompare(b.id);
        }
        return a.createdAt.localeCompare(b.createdAt);
    }

    if (a.scheduledDate === b.scheduledDate) {
        return a.id.localeCompare(b.id);
    }
    return a.scheduledDate.localeCompare(b.scheduledDate);
}

function isTransactionAtOrAfterSeriesAnchor(candidate: StoredTransaction, anchor: StoredTransaction, transactionMode: TransactionMode | null | undefined): boolean {
    if (transactionMode === "installment") {
        return getInstallmentOrderValue(candidate) >= getInstallmentOrderValue(anchor);
    }

    return compareDateValue(candidate.scheduledDate, anchor.scheduledDate) >= 0;
}

function addDaysToDateValue(dateValue: string, days: number): string {
    const parsed = parseAppDate(dateValue);
    if (!parsed || !Number.isFinite(days)) {
        return dateValue;
    }

    const shifted = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

function normalizeIgnoredInstallmentsCount(value: unknown, installmentCount: number | null): number {
    if (!installmentCount || installmentCount < 2) {
        return 0;
    }

    const parsedValue = Number(value);
    const safeValue = Number.isFinite(parsedValue) ? Math.floor(parsedValue) : 0;
    return Math.max(0, Math.min(installmentCount - 1, safeValue));
}

function recalculateGroupTotals(groups: TransactionGroup[], transactions: StoredTransaction[]): TransactionGroup[] {
    const amountsByGroupId = new Map<string, number>();
    const transactionCountByGroupId = new Map<string, number>();

    transactions.forEach((transaction) => {
        amountsByGroupId.set(transaction.groupId, roundToCents((amountsByGroupId.get(transaction.groupId) ?? 0) + Math.abs(transaction.amount)));
        transactionCountByGroupId.set(transaction.groupId, (transactionCountByGroupId.get(transaction.groupId) ?? 0) + 1);
    });

    return groups.map((group) => {
        const nextTotalAmount = roundToCents(amountsByGroupId.get(group.id) ?? 0);
        if (group.transactionMode === "installment") {
            const nextInstallmentCount = transactionCountByGroupId.get(group.id) ?? 0;
            return {
                ...group,
                totalAmount: nextTotalAmount,
                installmentCount: nextInstallmentCount > 0 ? nextInstallmentCount : null,
            };
        }

        return {
            ...group,
            totalAmount: nextTotalAmount,
        };
    });
}

function syncCreditCardInvoices(params: {
    creditCards: CreditCard[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    existingInvoices: CreditCardInvoice[];
}): { transactions: StoredTransaction[]; creditCardInvoices: CreditCardInvoice[]; changed: boolean } {
    const { creditCards, transactionGroups, transactions, existingInvoices } = params;
    const nowIso = new Date().toISOString();
    const creditCardIds = new Set(creditCards.map((card) => card.id));
    const creditCardById = new Map(creditCards.map((card) => [card.id, card]));
    const groupsById = new Map(transactionGroups.map((group) => [group.id, group]));
    const existingInvoicesById = new Map(
        existingInvoices.filter((invoice) => creditCardIds.has(invoice.creditCardId)).map((invoice) => [invoice.id, invoice]),
    );

    let changed = existingInvoicesById.size !== existingInvoices.length;

    const invoiceMetaById = new Map<
        string,
        {
            creditCardId: string;
            cycleKey: string;
            closingDate: string;
            dueDate: string;
            createdAt: string;
        }
    >();
    const invoiceTotalsById = new Map<string, number>();

    const nextTransactions = transactions.map((transaction) => {
        const group = groupsById.get(transaction.groupId);
        const creditCardId = resolveTransactionCreditCardId(transaction, group);

        if (!creditCardId || !creditCardIds.has(creditCardId)) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return normalizeStoredTransaction({
                ...transaction,
                invoiceId: null,
            });
        }

        const card = creditCards.find((item) => item.id === creditCardId);
        if (!card) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return normalizeStoredTransaction({
                ...transaction,
                invoiceId: null,
            });
        }

        const requestedInvoiceId = transaction.invoiceId?.trim() ?? "";
        const parsedRequestedInvoice = requestedInvoiceId ? parseCreditCardInvoiceId(requestedInvoiceId) : null;
        const hasExplicitCycle = Boolean(parsedRequestedInvoice && parsedRequestedInvoice.creditCardId === card.id);
        const resolvedCycle =
            hasExplicitCycle && parsedRequestedInvoice
                ? resolveCreditCardInvoiceCycleFromCycleKey(parsedRequestedInvoice.cycleKey, card.closingDay, card.dueDay)
                : resolveCreditCardInvoiceCycle(transaction.scheduledDate, card.closingDay, card.dueDay);
        const resolvedInvoiceId = hasExplicitCycle && requestedInvoiceId ? requestedInvoiceId : buildCreditCardInvoiceId(card.id, resolvedCycle.cycleKey);
        const existingInvoice = existingInvoicesById.get(resolvedInvoiceId);
        const includeInInvoice = transaction.status !== "cancelled" && transaction.status !== "skipped";

        invoiceMetaById.set(resolvedInvoiceId, {
            creditCardId: card.id,
            cycleKey: existingInvoice?.cycleKey ?? resolvedCycle.cycleKey,
            closingDate: resolvedCycle.closingDate,
            dueDate: resolvedCycle.dueDate,
            createdAt: existingInvoice?.createdAt ?? transaction.createdAt,
        });

        if (includeInInvoice) {
            invoiceTotalsById.set(resolvedInvoiceId, roundToCents((invoiceTotalsById.get(resolvedInvoiceId) ?? 0) + Math.abs(transaction.amount)));
        }

        if (transaction.invoiceId === resolvedInvoiceId) {
            return transaction;
        }

        changed = true;
        return normalizeStoredTransaction({
            ...transaction,
            invoiceId: resolvedInvoiceId,
        });
    });

    const nextInvoices = Array.from(invoiceMetaById.entries())
        .map(([invoiceId, meta]) => {
            const existing = existingInvoicesById.get(invoiceId);
            const totalAmount = roundToCents(invoiceTotalsById.get(invoiceId) ?? 0);
            const paidAmount = roundToCents(Math.min(totalAmount, Math.max(0, existing?.paidAmount ?? 0)));
            const linkedCard = creditCardById.get(meta.creditCardId);
            const status =
                linkedCard
                    ? resolveCreditCardInvoiceStatus({
                          invoiceCycleKey: meta.cycleKey,
                          cardClosingDay: linkedCard.closingDay,
                          cardDueDay: linkedCard.dueDay,
                          totalAmount,
                          paidAmount,
                      })
                    : paidAmount >= totalAmount && totalAmount > 0
                      ? "paid"
                      : "open";
            const paidAt = status === "paid" ? existing?.paidAt ?? nowIso : null;

            const invoice = normalizeCreditCardInvoice(
                {
                    id: invoiceId,
                    creditCardId: meta.creditCardId,
                    cycleKey: meta.cycleKey,
                    closingDate: meta.closingDate,
                    dueDate: meta.dueDate,
                    totalAmount,
                    paidAmount,
                    status,
                    paidAt,
                    createdAt: existing?.createdAt ?? meta.createdAt,
                    updatedAt: nowIso,
                },
                creditCardIds,
            );

            if (
                !existing ||
                existing.totalAmount !== invoice.totalAmount ||
                existing.paidAmount !== invoice.paidAmount ||
                existing.status !== invoice.status ||
                existing.creditCardId !== invoice.creditCardId ||
                existing.cycleKey !== invoice.cycleKey ||
                existing.closingDate !== invoice.closingDate ||
                existing.dueDate !== invoice.dueDate ||
                existing.paidAt !== invoice.paidAt
            ) {
                changed = true;
            }

            return invoice;
        })
        .sort(compareCreditCardInvoicesByDueDate);

    if (nextInvoices.length !== existingInvoicesById.size) {
        changed = true;
    }

    return {
        transactions: nextTransactions,
        creditCardInvoices: nextInvoices,
        changed,
    };
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
            const acknowledgedData = toSupabaseFinanceData(preparedFinance.snapshot, preparedFinance.favoriteWalletId);

            currentRevisionRef.current = params.revision;
            lastAcknowledgedDataRef.current = acknowledgedData;
            favoriteWalletIdRef.current = preparedFinance.favoriteWalletId;
            setProfile(params.profile);
            setSnapshotState(localSnapshot);
            setFavoriteWalletId(preparedFinance.favoriteWalletId);
            setFamilyState(null, []);
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
            currentRevisionRef.current = revision;
            lastAcknowledgedDataRef.current = financeData;
            if (user) {
                publishFinanceRevisionToTabs(user.uid, revision, financeClientId);
            }
        },
        [financeClientId, user],
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
            setFamilyState(null, []);
            saveLocalSnapshotBackup(localSnapshot, "revision-conflict-merge", preparedFinance.favoriteWalletId);
        },
        [saveLocalSnapshotBackup, setFamilyState, setSnapshotState, user],
    );

    const financeSync = useFinanceSyncQueue({
        userId: user?.uid ?? null,
        clientId: financeClientId,
        saveFinanceData: saveSupabaseFinanceData,
        loadFinanceData: loadSupabaseFinanceData,
        mergeFinanceData: mergeAndPrepareFinanceData,
        onSyncAccepted: applyConfirmedRevision,
        onConflictMerged: applyConflictMergedData,
    });
    const {
        enqueueSync: enqueueFinanceSync,
        getPendingSyncData,
        hasPendingSync: hasPendingFinanceSync,
        retrySync: retryFinanceSync,
    } = financeSync;

    const syncCurrentUserFamilyBeneficiary = useCallback(
        async (familyId: string, snapshotOverride?: FinanceSnapshot, profileOverride?: UserProfileData | null) => {
            void familyId;
            void snapshotOverride;
            void profileOverride;
            return null;
        },
        [],
    );

    const syncCurrentUserSharedWishlist = useCallback(
        async (familyId: string, snapshotOverride?: FinanceSnapshot) => {
            void familyId;
            void snapshotOverride;
            return null;
        },
        [],
    );

    const refreshFamilyState = useCallback(
        async (rawUserData?: unknown) => {
            void rawUserData;
            setFamilyState(null, []);
            return {
                family: null,
                sharedWishlists: [],
                sharedBeneficiaries: [],
            };
        },
        [setFamilyState],
    );

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

            setFinanceLoading(true);

            try {
                const profile = buildUserProfileData(user, {
                    preferCurrentProfilePhoto: true,
                });
                if (isActive) {
                    setProfile(profile);
                }
                const pendingSyncFinance = getPendingSyncData();
                const supabaseFinance = await loadSupabaseFinanceData(user.uid);
                const remotePreparedFinance = prepareFinanceSnapshot({
                    financeSource: supabaseFinance.data,
                    userId: user.uid,
                    profile,
                });
                const remoteAcknowledgedData = toSupabaseFinanceData(remotePreparedFinance.snapshot, remotePreparedFinance.favoriteWalletId);
                const financeSource = pendingSyncFinance ?? supabaseFinance.data;
                const preparedFinance = prepareFinanceSnapshot({
                    financeSource,
                    userId: user.uid,
                    profile,
                });
                const localSnapshot = applyLocalPlanningPreferences(preparedFinance.snapshot, user.uid);

                if (!isActive) {
                    return;
                }

                currentRevisionRef.current = supabaseFinance.revision;
                lastAcknowledgedDataRef.current = remoteAcknowledgedData;
                favoriteWalletIdRef.current = preparedFinance.favoriteWalletId;
                setSnapshotState(localSnapshot);
                setFavoriteWalletId(preparedFinance.favoriteWalletId);
                setFamilyState(null, []);
                saveLocalSnapshotBackup(localSnapshot, "load-success", preparedFinance.favoriteWalletId);

                if (!pendingSyncFinance && (!supabaseFinance.data || preparedFinance.changed)) {
                    enqueueFinanceSync(toSupabaseFinanceData(localSnapshot, preparedFinance.favoriteWalletId), {
                        baseRevision: supabaseFinance.revision,
                        baseData: remoteAcknowledgedData,
                    });
                }
            } catch (error) {
                console.error("Failed to load finance data:", error);
                if (isActive) {
                    const profile = buildUserProfileData(user);
                    setProfile(profile);
                    const empty = normalizeFinanceSnapshot(null, user.uid, {
                        defaultBeneficiaryName: profile.displayName,
                        defaultBeneficiaryAvatarImage: profile.photoURL,
                    }).snapshot;
                    setSnapshotState(empty);
                    setFamilyState(null, []);
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
    }, [enqueueFinanceSync, getPendingSyncData, profileVersion, refreshFamilyState, saveLocalSnapshotBackup, setFamilyState, setSnapshotState, syncCurrentUserFamilyBeneficiary, user]);

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
                const loadedFinance = await loadSupabaseFinanceData(user.uid);
                if (loadedFinance.revision <= currentRevisionRef.current) {
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
        [applySupabaseFinanceData, financeClientId, hasPendingFinanceSync, retryFinanceSync, user],
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
        async (fields: PersistFields) => {
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
        async (snapshot: FinanceSnapshot) => {
            await persistFinanceFields({
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
            void familyName;
            throw new Error("Familia ainda nao foi migrada para Supabase.");
        },
        [],
    );

    const generateFamilyInvite = useCallback(async () => {
        throw new Error("Familia ainda nao foi migrada para Supabase.");
    }, []);

    const joinFamilyByCode = useCallback(
        async (code: string) => {
            void code;
            throw new Error("Familia ainda nao foi migrada para Supabase.");
        },
        [],
    );

    const removeFamilyMember = useCallback(
        async (memberUid: string) => {
            void memberUid;
            throw new Error("Familia ainda nao foi migrada para Supabase.");
        },
        [],
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
            if (familyRef.current?.id) {
                await syncCurrentUserSharedWishlist(familyRef.current.id, normalized);
                await syncCurrentUserFamilyBeneficiary(familyRef.current.id, normalized);
            }
        },
        [persistFullSnapshot, setSnapshotState, syncCurrentUserFamilyBeneficiary, syncCurrentUserSharedWishlist, user],
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

            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const payCreditCardInvoice = useCallback(
        async ({ invoiceId, walletId, amount, paymentDate }: PayCreditCardInvoiceDraft) => {
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

            const resolvedWalletId = ensureWalletId(normalizeWalletId(walletId), walletsRef.current);
            const wallet = walletsRef.current.find((item) => item.id === resolvedWalletId);
            if (!wallet) {
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

            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState, user?.uid],
    );

    const setCreditCardInvoicesPaidState = useCallback(
        async ({ invoiceIds, markAsPaid }: SetCreditCardInvoicesPaidStateDraft) => {
            const requestedInvoiceIds = new Set(invoiceIds.map((invoiceId) => invoiceId.trim()).filter(Boolean));
            if (requestedInvoiceIds.size < 1) {
                return;
            }

            const nowIso = new Date().toISOString();
            let changed = false;

            const nextInvoices = creditCardInvoicesRef.current.map((invoice) => {
                if (!requestedInvoiceIds.has(invoice.id)) {
                    return invoice;
                }

                const nextPaidAmount = markAsPaid ? invoice.totalAmount : 0;
                const nextStatus = markAsPaid && invoice.totalAmount > 0 ? "paid" : "open";
                const nextPaidAt = markAsPaid && invoice.totalAmount > 0 ? nowIso : null;

                if (invoice.paidAmount === nextPaidAmount && invoice.status === nextStatus && invoice.paidAt === nextPaidAt) {
                    return invoice;
                }

                changed = true;
                return normalizeCreditCardInvoice(
                    {
                        ...invoice,
                        paidAmount: nextPaidAmount,
                        status: nextStatus,
                        paidAt: nextPaidAt,
                        updatedAt: nowIso,
                    },
                    new Set(creditCardsRef.current.map((card) => card.id)),
                );
            });

            if (!changed) {
                return;
            }

            const snapshot = buildSnapshot({
                creditCardInvoices: nextInvoices,
            });

            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
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

            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
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
            if (beneficiary.isSelfProfile && familyRef.current?.id) {
                await syncCurrentUserFamilyBeneficiary(familyRef.current.id, snapshot);
            }
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, syncCurrentUserFamilyBeneficiary, user?.uid],
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
            if (familyRef.current?.id) {
                await syncCurrentUserSharedWishlist(familyRef.current.id, snapshot);
            }
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, syncCurrentUserSharedWishlist, user?.uid],
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
            if (familyRef.current?.id) {
                await syncCurrentUserSharedWishlist(familyRef.current.id, snapshot);
            }
        },
        [buildSnapshot, persistFinanceFields, setSnapshotState, syncCurrentUserSharedWishlist],
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
                fallbackBeneficiary,
            });

            const snapshot = buildSnapshot({
                beneficiaries: deleted.beneficiaries.sort(compareBySortOrderNameAndId),
                transactionGroups: deleted.transactionGroups,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
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
                fallbackCategory,
            });

            const snapshot = buildSnapshot({
                categories: [...nextCategories].sort(compareCategoriesByTypeParentSort),
                transactionGroups: deleted.transactionGroups,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
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
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
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
                    findCurrentUserSelfBeneficiary(nextBeneficiaries, user?.uid) ??
                    findBeneficiaryByName(nextBeneficiaries, DEFAULT_BENEFICIARY_NAME) ??
                    createBeneficiary(user ? buildUserProfileData(user).displayName : DEFAULT_BENEFICIARY_NAME);
            }

            const description = (newTransaction.description || "").trim();
            const scheduledDate = newTransaction.scheduledDate || newTransaction.date || getTodayDate();
            const wantsCreditCardPayment = newTransaction.paymentMethod === "credit_card" && groupType === "expense";
            const requestedCreditCardId = newTransaction.creditCardId?.trim() ?? "";
            const requestedCreditCard = wantsCreditCardPayment ? creditCardsRef.current.find((card) => card.id === requestedCreditCardId) ?? null : null;
            const fallbackCreditCard = wantsCreditCardPayment ? creditCardsRef.current.find((card) => card.id === favoriteCreditCardIdRef.current) ?? creditCardsRef.current[0] ?? null : null;
            const resolvedCreditCard = requestedCreditCard ?? fallbackCreditCard;
            const preferredWalletFromCard = resolvedCreditCard?.bankWalletId ?? null;
            const sourceWalletId = ensureWalletId(
                normalizeWalletId(newTransaction.inWallet || newTransaction.walletId || preferredWalletFromCard || DEFAULT_WALLET_ID),
                walletsRef.current,
            );
            const destinationWalletIdRaw = newTransaction.destinationWalletId ? normalizeWalletId(newTransaction.destinationWalletId) : null;
            const destinationWalletId = destinationWalletIdRaw ? ensureWalletId(destinationWalletIdRaw, walletsRef.current) : null;
            const validTagIds = Array.from(new Set(newTransaction.tagIds ?? [])).filter((tagId) => tagsRef.current.some((tag) => tag.id === tagId));

            const transactionId = newTransaction.id && newTransaction.id.trim() ? newTransaction.id.trim() : createId("tx");
            const groupId = newTransaction.groupId && newTransaction.groupId.trim() ? newTransaction.groupId.trim() : `group-${transactionId}`;
            const existingGroup = transactionGroupsRef.current.find((group) => group.id === groupId);
            const requestedMode = newTransaction.transactionMode;
            const normalizedRequestedMode: TransactionMode =
                requestedMode === "recurring" || requestedMode === "installment" || requestedMode === "single" ? requestedMode : "single";

            const transactionMode: TransactionMode =
                existingGroup?.transactionMode ??
                (groupType === "transfer"
                    ? "single"
                    : normalizedRequestedMode === "installment" && groupType === "expense"
                      ? "installment"
                      : normalizedRequestedMode === "recurring"
                        ? "recurring"
                        : "single");

            const resolvedGroupCreditCardId = existingGroup?.creditCardId ?? (groupType === "expense" ? resolvedCreditCard?.id ?? null : null);
            const rawInstallmentCount = Number(newTransaction.installmentCount ?? existingGroup?.installmentCount ?? 0);
            const installmentCount = transactionMode === "installment" && Number.isInteger(rawInstallmentCount) && rawInstallmentCount >= 2 ? rawInstallmentCount : null;
            const ignoredInstallmentsCount =
                transactionMode === "installment"
                    ? normalizeIgnoredInstallmentsCount(newTransaction.ignoredInstallmentsCount, installmentCount)
                    : 0;
            const existingRecurrenceRule =
                existingGroup?.recurrenceRule && typeof existingGroup.recurrenceRule === "object" ? existingGroup.recurrenceRule : {};
            const providedRecurrenceRule =
                newTransaction.recurrenceRule && typeof newTransaction.recurrenceRule === "object" ? newTransaction.recurrenceRule : {};
            const recurrenceRule =
                transactionMode === "recurring"
                    ? {
                          frequency: "monthly",
                          interval: 1,
                          anchorDate: scheduledDate,
                          amount: absoluteAmount,
                          tagIds: validTagIds,
                          excludedDates: Array.isArray((existingRecurrenceRule as Record<string, unknown>).excludedDates)
                              ? (existingRecurrenceRule as Record<string, unknown>).excludedDates
                              : [],
                          notes: newTransaction.notes ?? null,
                          ...existingRecurrenceRule,
                          ...providedRecurrenceRule,
                      }
                    : null;
            const group = existingGroup
                ? normalizeTransactionGroup(
                      {
                          ...existingGroup,
                          beneficiaryId: finalBeneficiary.id,
                          beneficiaryName: finalBeneficiary.name,
                          categoryId: finalCategory.id,
                          categoryName,
                          subcategoryName,
                          title: description || categoryName,
                          notes: newTransaction.notes || null,
                          sourceWalletId,
                          destinationWalletId,
                          creditCardId: resolvedGroupCreditCardId,
                          transactionMode,
                          installmentCount,
                          recurrenceRule,
                          recurrenceEndDate: transactionMode === "recurring" ? (newTransaction.recurrenceEndDate ?? existingGroup.recurrenceEndDate ?? null) : null,
                          totalAmount: roundToCents(existingGroup.totalAmount + absoluteAmount),
                      },
                      new Set(walletsRef.current.map((wallet) => wallet.id)),
                  )
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
                          transactionMode,
                          totalAmount: absoluteAmount,
                          installmentCount,
                          recurrenceRule,
                          recurrenceEndDate: transactionMode === "recurring" ? (newTransaction.recurrenceEndDate ?? null) : null,
                          sourceWalletId,
                          destinationWalletId,
                          creditCardId: resolvedGroupCreditCardId,
                          createdAt: nowIso,
                      },
                      new Set(walletsRef.current.map((wallet) => wallet.id)),
                  );

            const nextGroups = existingGroup
                ? transactionGroupsRef.current.map((item) => (item.id === groupId ? group : item))
                : [...transactionGroupsRef.current, group];

            const resolveTransactionInvoiceId = ({
                dateValue,
                allowRequestedInvoice,
                installmentOffset = 0,
            }: {
                dateValue: string;
                allowRequestedInvoice: boolean;
                installmentOffset?: number;
            }): string | null => {
                if (group.type !== "expense" || !group.creditCardId) {
                    return null;
                }

                const linkedCard = creditCardsRef.current.find((item) => item.id === group.creditCardId);
                if (!linkedCard) {
                    return null;
                }

                const shouldUseRequestedInvoice = allowRequestedInvoice || group.transactionMode === "installment";
                const requestedInvoiceId = shouldUseRequestedInvoice ? newTransaction.invoiceId?.trim() ?? "" : "";
                const parsedRequestedInvoice = requestedInvoiceId ? parseCreditCardInvoiceId(requestedInvoiceId) : null;
                if (parsedRequestedInvoice && parsedRequestedInvoice.creditCardId === linkedCard.id) {
                    const nextCycleKey = shiftInvoiceCycleKey(parsedRequestedInvoice.cycleKey, installmentOffset);
                    return buildCreditCardInvoiceId(linkedCard.id, nextCycleKey);
                }

                const expectedInvoiceId = resolveExpectedCreditCardInvoiceId({
                    creditCardId: linkedCard.id,
                    transactionDate: dateValue,
                    closingDay: linkedCard.closingDay,
                    dueDay: linkedCard.dueDay,
                });
                const parsedExpectedInvoice = expectedInvoiceId ? parseCreditCardInvoiceId(expectedInvoiceId) : null;
                const nextCycleKey = parsedExpectedInvoice ? shiftInvoiceCycleKey(parsedExpectedInvoice.cycleKey, installmentOffset) : "";
                return nextCycleKey ? buildCreditCardInvoiceId(linkedCard.id, nextCycleKey) : null;
            };

            const createdTransactions: StoredTransaction[] = [];
            if (group.transactionMode === "installment" && installmentCount) {
                const installmentAmounts = splitAmountAcrossInstallments(absoluteAmount, installmentCount);
                installmentAmounts.forEach((installmentAmount, index) => {
                    const transactionStatus = index < ignoredInstallmentsCount ? "skipped" : index === ignoredInstallmentsCount ? status : "pending";
                    const transaction = normalizeStoredTransaction({
                        id: index === 0 ? transactionId : createId("tx"),
                        groupId,
                        installmentNumber: index + 1,
                        amount: installmentAmount,
                        scheduledDate,
                        status: transactionStatus,
                        paidAt: transactionStatus === "paid" ? resolveLedgerEntryDateIso(scheduledDate, nowIso) : null,
                        invoiceId: resolveTransactionInvoiceId({ dateValue: scheduledDate, allowRequestedInvoice: false, installmentOffset: index }),
                        notes: newTransaction.notes || null,
                        createdAt: nowIso,
                    });
                    createdTransactions.push(transaction);
                });
            } else {
                const transaction = normalizeStoredTransaction({
                    id: transactionId,
                    groupId,
                    installmentNumber: null,
                    amount: absoluteAmount,
                    scheduledDate,
                    status,
                    paidAt: status === "paid" ? resolveLedgerEntryDateIso(scheduledDate, nowIso) : null,
                    invoiceId: resolveTransactionInvoiceId({ dateValue: scheduledDate, allowRequestedInvoice: group.transactionMode === "single" }),
                    notes: newTransaction.notes || null,
                    createdAt: nowIso,
                });
                createdTransactions.push(transaction);
            }

            const nextTransactions = [...storedTransactionsRef.current, ...createdTransactions];
            const nextTransactionTags = [...transactionTagsRef.current];
            createdTransactions.forEach((transaction) => {
                validTagIds.forEach((tagId) => {
                    if (!nextTransactionTags.some((item) => item.transactionId === transaction.id && item.tagId === tagId)) {
                        nextTransactionTags.push({ transactionId: transaction.id, tagId });
                    }
                });
            });

            const hydratedRecurring = ensureRecurringTransactionsHorizon({
                groups: nextGroups,
                transactions: nextTransactions,
                transactionTags: nextTransactionTags,
                tags: tagsRef.current,
            });
            const nextGroupsWithTotals = recalculateGroupTotals(hydratedRecurring.groups, hydratedRecurring.transactions);
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: creditCardsRef.current,
                transactionGroups: nextGroupsWithTotals,
                transactions: hydratedRecurring.transactions,
                existingInvoices: creditCardInvoicesRef.current,
            });
            const resolvedGroup = nextGroupsWithTotals.find((item) => item.id === group.id) ?? group;
            const newLedgerEntries = createdTransactions
                .filter((transaction) => transaction.status === "paid")
                .flatMap((transaction) => createLedgerEntriesForPaidTransaction(transaction, resolvedGroup));
            const nextLedgerEntries = [...ledgerEntriesRef.current, ...newLedgerEntries];
            const finalGroups = recalculateGroupTotals(nextGroupsWithTotals, syncedInvoices.transactions);

            const snapshot = buildSnapshot({
                categories: [...nextCategories].sort(compareCategoriesByTypeParentSort),
                beneficiaries: [...nextBeneficiaries].sort(compareBySortOrderNameAndId),
                transactionGroups: finalGroups,
                transactions: syncedInvoices.transactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: nextLedgerEntries,
                transactionTags: hydratedRecurring.transactionTags,
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
                paidAt: resolveLedgerEntryDateIso(transactionToUpdate.scheduledDate, nowIso),
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

    const setTransactionStatus = useCallback(
        async (transaction: Transaction, status: TransactionStatus) => {
            const transactionToUpdate = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!transactionToUpdate) {
                return;
            }

            const nextStatus = normalizeTransactionStatus(status);
            if (transactionToUpdate.status === nextStatus) {
                return;
            }

            const group = transactionGroupsRef.current.find((item) => item.id === transactionToUpdate.groupId) ?? null;
            const nowIso = new Date().toISOString();
            const nextTransaction = normalizeStoredTransaction({
                ...transactionToUpdate,
                status: nextStatus,
                paidAt: nextStatus === "paid" ? resolveLedgerEntryDateIso(transactionToUpdate.scheduledDate, nowIso) : null,
            });
            let nextGroups = recalculateGroupTotals(transactionGroupsRef.current, storedTransactionsRef.current.map((item) => (item.id === nextTransaction.id ? nextTransaction : item)));
            let nextTransactions = storedTransactionsRef.current.map((item) => (item.id === nextTransaction.id ? nextTransaction : item));
            const nextLedgerEntries = ledgerEntriesRef.current.filter((item) => item.transactionId !== transactionToUpdate.id);

            if (nextStatus === "paid" && group) {
                nextLedgerEntries.push(...createLedgerEntriesForPaidTransaction(nextTransaction, group));
            }

            const syncedInvoices = syncCreditCardInvoices({
                creditCards: creditCardsRef.current,
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                existingInvoices: creditCardInvoicesRef.current,
            });

            nextGroups = recalculateGroupTotals(nextGroups, syncedInvoices.transactions);
            nextTransactions = syncedInvoices.transactions;

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: nextLedgerEntries,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const deleteTransactionWithScope = useCallback(
        async (transaction: Transaction, scope: TransactionSeriesScope = "single") => {
            const transactionToDelete = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!transactionToDelete) {
                return;
            }

            const normalizedScope = normalizeSeriesScope(scope);
            const walletIds = new Set(walletsRef.current.map((wallet) => wallet.id));
            const nowIso = new Date().toISOString();
            const group = transactionGroupsRef.current.find((item) => item.id === transactionToDelete.groupId) ?? null;
            const groupTransactions = storedTransactionsRef.current
                .filter((item) => item.groupId === transactionToDelete.groupId)
                .sort((a, b) => compareTransactionsWithinSeries(a, b, group?.transactionMode));

            const targetTransactionIds = new Set<string>();
            if (!group || normalizedScope === "single") {
                targetTransactionIds.add(transactionToDelete.id);
            } else if (normalizedScope === "all") {
                groupTransactions.forEach((item) => targetTransactionIds.add(item.id));
            } else {
                groupTransactions
                    .filter((item) => isTransactionAtOrAfterSeriesAnchor(item, transactionToDelete, group.transactionMode))
                    .forEach((item) => targetTransactionIds.add(item.id));
                targetTransactionIds.add(transactionToDelete.id);
            }

            let nextGroups = [...transactionGroupsRef.current];
            let nextTransactions = [...storedTransactionsRef.current];

            if (group?.transactionMode === "recurring" && normalizedScope === "single") {
                const existingRule = group.recurrenceRule && typeof group.recurrenceRule === "object" ? group.recurrenceRule : {};
                const excludedDates = new Set<string>();

                if (Array.isArray((existingRule as Record<string, unknown>).excludedDates)) {
                    for (const value of (existingRule as Record<string, unknown>).excludedDates as unknown[]) {
                        if (typeof value === "string" && parseAppDate(value)) {
                            excludedDates.add(value);
                        }
                    }
                }

                excludedDates.add(transactionToDelete.scheduledDate);

                nextGroups = nextGroups.map((item) =>
                    item.id === group.id
                        ? normalizeTransactionGroup(
                              {
                                  ...item,
                                  recurrenceRule: {
                                      ...existingRule,
                                      excludedDates: Array.from(excludedDates),
                                  },
                              },
                              walletIds,
                          )
                        : item,
                );
            }

            if (group?.transactionMode === "recurring" && normalizedScope === "this_and_next") {
                const recurrenceEndDate = addDaysToDateValue(transactionToDelete.scheduledDate, -1);
                nextGroups = nextGroups.map((item) =>
                    item.id === group.id
                        ? normalizeTransactionGroup(
                              {
                                  ...item,
                                  recurrenceEndDate,
                              },
                              walletIds,
                          )
                        : item,
                );
            }

            const removedTransactions = nextTransactions.filter((item) => targetTransactionIds.has(item.id));
            nextTransactions = nextTransactions.filter((item) => !targetTransactionIds.has(item.id));
            const nextLedgerEntries = ledgerEntriesRef.current.filter((item) => !item.transactionId || !targetTransactionIds.has(item.transactionId));
            let nextTransactionTags = transactionTagsRef.current.filter((item) => !targetTransactionIds.has(item.transactionId));

            const groupsWithTransactions = new Set(nextTransactions.map((item) => item.groupId));
            nextGroups = nextGroups.filter((item) => groupsWithTransactions.has(item.id));
            nextGroups = recalculateGroupTotals(nextGroups, nextTransactions);

            const paymentReversalByInvoiceId = new Map<string, number>();
            removedTransactions.forEach((item) => {
                const invoicePaymentMeta = parseInvoicePaymentNote(item.notes);
                if (!invoicePaymentMeta) {
                    return;
                }

                paymentReversalByInvoiceId.set(
                    invoicePaymentMeta.invoiceId,
                    roundToCents((paymentReversalByInvoiceId.get(invoicePaymentMeta.invoiceId) ?? 0) + Math.abs(item.amount)),
                );
            });

            const nextInvoicesAfterPaymentReversal =
                paymentReversalByInvoiceId.size > 0
                    ? creditCardInvoicesRef.current.map((invoice) => {
                          const reversedAmount = paymentReversalByInvoiceId.get(invoice.id);
                          if (!reversedAmount) {
                              return invoice;
                          }

                          const nextPaidAmount = roundToCents(Math.max(0, invoice.paidAmount - reversedAmount));
                          const linkedCard = creditCardsRef.current.find((card) => card.id === invoice.creditCardId) ?? null;
                          const nextStatus = linkedCard
                              ? resolveCreditCardInvoiceStatus({
                                    invoiceCycleKey: invoice.cycleKey,
                                    cardClosingDay: linkedCard.closingDay,
                                    cardDueDay: linkedCard.dueDay,
                                    totalAmount: invoice.totalAmount,
                                    paidAmount: nextPaidAmount,
                                })
                              : nextPaidAmount >= invoice.totalAmount && invoice.totalAmount > 0
                                ? "paid"
                                : "open";

                          return normalizeCreditCardInvoice(
                              {
                                  ...invoice,
                                  paidAmount: nextPaidAmount,
                                  status: nextStatus,
                                  paidAt: nextStatus === "paid" ? invoice.paidAt ?? nowIso : null,
                                  updatedAt: nowIso,
                              },
                              new Set(creditCardsRef.current.map((card) => card.id)),
                          );
                      })
                    : creditCardInvoicesRef.current;

            const recurringHydration = ensureRecurringTransactionsHorizon({
                groups: nextGroups,
                transactions: nextTransactions,
                transactionTags: nextTransactionTags,
                tags: tagsRef.current,
            });

            nextGroups = recalculateGroupTotals(recurringHydration.groups, recurringHydration.transactions);
            nextTransactions = recurringHydration.transactions;
            nextTransactionTags = recurringHydration.transactionTags;

            const syncedInvoices = syncCreditCardInvoices({
                creditCards: creditCardsRef.current,
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                existingInvoices: nextInvoicesAfterPaymentReversal,
            });

            nextGroups = recalculateGroupTotals(nextGroups, syncedInvoices.transactions);

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: syncedInvoices.transactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: nextLedgerEntries,
                transactionTags: nextTransactionTags,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const deleteTransaction = useCallback(
        async (transaction: Transaction) => {
            await deleteTransactionWithScope(transaction, "single");
        },
        [deleteTransactionWithScope],
    );

    const updateTransactionsBulk = useCallback(
        async ({ transactionIds, categoryId, beneficiaryId, status, tagIdsToAdd = [] }: BulkUpdateTransactionsDraft) => {
            const targetIds = new Set(transactionIds.map((id) => id.trim()).filter(Boolean));
            if (targetIds.size < 1) {
                return;
            }

            const targetTransactions = storedTransactionsRef.current.filter((transaction) => targetIds.has(transaction.id) && !parseInvoicePaymentNote(transaction.notes));
            if (targetTransactions.length < 1) {
                return;
            }

            const targetTransactionIds = new Set(targetTransactions.map((transaction) => transaction.id));
            const categoriesById = new Map(categoriesRef.current.map((category) => [category.id, category]));
            const requestedCategory = categoryId ? categoriesById.get(categoryId.trim()) ?? null : null;
            const requestedBeneficiary = beneficiaryId ? beneficiariesRef.current.find((beneficiary) => beneficiary.id === beneficiaryId.trim()) ?? null : null;
            const requestedStatus = status ? normalizeTransactionStatus(status) : null;
            const validTagIdsToAdd = Array.from(new Set(tagIdsToAdd)).filter((tagId) => tagsRef.current.some((tag) => tag.id === tagId));
            const shouldPatchGroupData = Boolean(requestedCategory || requestedBeneficiary);
            const nowIso = new Date().toISOString();
            const walletIds = new Set(walletsRef.current.map((wallet) => wallet.id));
            const groupsById = new Map(transactionGroupsRef.current.map((group) => [group.id, group]));

            const transactionCountByGroupId = new Map<string, number>();
            storedTransactionsRef.current.forEach((transaction) => {
                transactionCountByGroupId.set(transaction.groupId, (transactionCountByGroupId.get(transaction.groupId) ?? 0) + 1);
            });

            const selectedCountByGroupId = new Map<string, number>();
            targetTransactions.forEach((transaction) => {
                selectedCountByGroupId.set(transaction.groupId, (selectedCountByGroupId.get(transaction.groupId) ?? 0) + 1);
            });

            const groupsNeedingSplit = new Set<string>();
            if (shouldPatchGroupData) {
                selectedCountByGroupId.forEach((selectedCount, groupId) => {
                    const totalCount = transactionCountByGroupId.get(groupId) ?? 0;
                    if (selectedCount > 0 && totalCount > selectedCount) {
                        groupsNeedingSplit.add(groupId);
                    }
                });
            }

            const splitGroupIdByTransactionId = new Map<string, string>();
            const splitGroups: TransactionGroup[] = [];
            targetTransactions.forEach((transaction) => {
                const group = groupsById.get(transaction.groupId);
                if (!group || !groupsNeedingSplit.has(group.id)) {
                    return;
                }

                const categoryPatch = requestedCategory && requestedCategory.type === toCategoryTypeFromGroupType(group.type) ? requestedCategory : null;
                const groupCategoryFields = resolveGroupCategoryFields(group, categoryPatch, categoriesById);
                const groupBeneficiaryFields = resolveGroupBeneficiaryFields(group, requestedBeneficiary);
                const splitGroupId = createId("group");
                splitGroupIdByTransactionId.set(transaction.id, splitGroupId);
                splitGroups.push(
                    normalizeTransactionGroup(
                        {
                            ...group,
                            ...groupCategoryFields,
                            ...groupBeneficiaryFields,
                            id: splitGroupId,
                            transactionMode: "single",
                            totalAmount: roundToCents(Math.abs(transaction.amount)),
                            installmentCount: null,
                            recurrenceRule: null,
                            recurrenceEndDate: null,
                            createdAt: transaction.createdAt,
                        },
                        walletIds,
                    ),
                );
            });

            let nextGroups = transactionGroupsRef.current.map((group) => {
                const selectedCount = selectedCountByGroupId.get(group.id) ?? 0;
                const shouldPatchWholeGroup = shouldPatchGroupData && selectedCount > 0 && !groupsNeedingSplit.has(group.id);
                let nextGroup = group;

                if (shouldPatchWholeGroup) {
                    const categoryPatch = requestedCategory && requestedCategory.type === toCategoryTypeFromGroupType(group.type) ? requestedCategory : null;
                    nextGroup = normalizeTransactionGroup(
                        {
                            ...group,
                            ...resolveGroupCategoryFields(group, categoryPatch, categoriesById),
                            ...resolveGroupBeneficiaryFields(group, requestedBeneficiary),
                        },
                        walletIds,
                    );
                }

                if (groupsNeedingSplit.has(group.id)) {
                    const excludedDates = targetTransactions.filter((transaction) => transaction.groupId === group.id).map((transaction) => transaction.scheduledDate);
                    nextGroup = addRecurringExcludedDates(nextGroup, excludedDates, walletIds);
                }

                return nextGroup;
            });

            nextGroups = [...nextGroups, ...splitGroups];

            let nextTransactions = storedTransactionsRef.current.map((transaction) => {
                if (!targetTransactionIds.has(transaction.id)) {
                    return transaction;
                }

                const nextStatus = requestedStatus ?? transaction.status;
                const nextPaidAt = requestedStatus ? (nextStatus === "paid" ? resolveLedgerEntryDateIso(transaction.scheduledDate, nowIso) : null) : transaction.paidAt;
                const nextGroupId = splitGroupIdByTransactionId.get(transaction.id) ?? transaction.groupId;
                return normalizeStoredTransaction({
                    ...transaction,
                    groupId: nextGroupId,
                    installmentNumber: splitGroupIdByTransactionId.has(transaction.id) ? null : transaction.installmentNumber,
                    status: nextStatus,
                    paidAt: nextPaidAt,
                });
            });

            let nextTransactionTags = [...transactionTagsRef.current];
            if (validTagIdsToAdd.length > 0) {
                targetTransactions.forEach((transaction) => {
                    validTagIdsToAdd.forEach((tagId) => {
                        if (!nextTransactionTags.some((link) => link.transactionId === transaction.id && link.tagId === tagId)) {
                            nextTransactionTags.push({ transactionId: transaction.id, tagId });
                        }
                    });
                });
            }

            const groupsWithTransactions = new Set(nextTransactions.map((transaction) => transaction.groupId));
            nextGroups = recalculateGroupTotals(
                nextGroups.filter((group) => groupsWithTransactions.has(group.id)),
                nextTransactions,
            );

            const recurringHydration = ensureRecurringTransactionsHorizon({
                groups: nextGroups,
                transactions: nextTransactions,
                transactionTags: nextTransactionTags,
                tags: tagsRef.current,
            });

            nextGroups = recalculateGroupTotals(recurringHydration.groups, recurringHydration.transactions);
            nextTransactions = recurringHydration.transactions;
            nextTransactionTags = recurringHydration.transactionTags;

            const syncedInvoices = syncCreditCardInvoices({
                creditCards: creditCardsRef.current,
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                existingInvoices: creditCardInvoicesRef.current,
            });

            nextGroups = recalculateGroupTotals(nextGroups, syncedInvoices.transactions);
            nextTransactions = syncedInvoices.transactions;

            const finalGroupsById = new Map(nextGroups.map((group) => [group.id, group]));
            const nextLedgerEntries = ledgerEntriesRef.current.filter((entry) => !entry.transactionId || !targetTransactionIds.has(entry.transactionId));
            nextTransactions.forEach((transaction) => {
                if (!targetTransactionIds.has(transaction.id) || transaction.status !== "paid") {
                    return;
                }

                const group = finalGroupsById.get(transaction.groupId);
                if (group) {
                    nextLedgerEntries.push(...createLedgerEntriesForPaidTransaction(transaction, group));
                }
            });

            const snapshot = buildSnapshot({
                transactionGroups: nextGroups,
                transactions: nextTransactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: nextLedgerEntries,
                transactionTags: nextTransactionTags,
            });
            setSnapshotState(snapshot);
            await persistFullSnapshot(snapshot);
        },
        [buildSnapshot, persistFullSnapshot, setSnapshotState],
    );

    const updateTransaction = useCallback(
        async ({ transaction, draft, scope = "single" }: UpdateTransactionDraft) => {
            const transactionToUpdate = storedTransactionsRef.current.find((item) => item.id === transaction.id);
            if (!transactionToUpdate) {
                return;
            }
            const normalizedScope = normalizeSeriesScope(scope);
            const nowIso = new Date().toISOString();
            const beforeSnapshot = buildSnapshot();
            const transformed = updateTransactionSeriesSnapshot({
                snapshot: beforeSnapshot,
                transactionId: transactionToUpdate.id,
                draft,
                scope: normalizedScope,
                createGroupId: () => createId("group"),
                now: nowIso,
            });
            const recurringHydration = ensureRecurringTransactionsHorizon({
                groups: transformed.snapshot.transactionGroups,
                transactions: transformed.snapshot.transactions,
                transactionTags: transformed.snapshot.transactionTags,
                tags: transformed.snapshot.tags,
            });
            const syncedInvoices = syncCreditCardInvoices({
                creditCards: transformed.snapshot.creditCards,
                transactionGroups: recurringHydration.groups,
                transactions: recurringHydration.transactions,
                existingInvoices: transformed.snapshot.creditCardInvoices,
            });
            const snapshot = buildSnapshot({
                transactionGroups: recalculateGroupTotals(recurringHydration.groups, syncedInvoices.transactions),
                transactions: syncedInvoices.transactions,
                creditCardInvoices: syncedInvoices.creditCardInvoices,
                ledgerEntries: transformed.snapshot.ledgerEntries,
                transactionTags: recurringHydration.transactionTags,
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
