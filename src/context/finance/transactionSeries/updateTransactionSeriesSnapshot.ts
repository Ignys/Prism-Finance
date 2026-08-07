import { parseAppDate } from "../../../lib/localDate";
import {
    createLedgerEntriesForPaidTransaction,
    normalizeTransactionStatus,
    normalizeWalletId,
    resolveTransactionBeneficiaryId,
    resolveTransactionCategoryId,
    resolveTransactionCreditCardId,
    resolveTransactionDestinationWalletId,
    resolveTransactionSourceWalletId,
    resolveTransactionTitle,
    type FinanceSnapshot,
    type StoredTransaction,
    type TransactionDraft,
    type TransactionGroup,
    type TransactionSeriesScope,
} from "../../financeTypes";
import { addDays, addMonths, compareSeriesTransactions, isAtOrAfter, monthDistance, recalculateGroupTotals, replaceTransactionTags, resolveCategoryFields, roundToCents } from "./helpers";
import { validateTransactionSeriesUpdateInvariants } from "./invariants";

export interface TransactionSeriesUpdateResult {
    snapshot: FinanceSnapshot;
    affectedTransactionIds: Set<string>;
    financiallyAffectedTransactionIds: Set<string>;
    metadataOnly: boolean;
}

export interface UpdateTransactionSeriesSnapshotParams {
    snapshot: FinanceSnapshot;
    transactionId: string;
    draft: TransactionDraft;
    scope: TransactionSeriesScope;
    createGroupId?: () => string;
    now?: string;
}

interface ResolvedDraft {
    amount: number;
    scheduledDate: string;
    status: StoredTransaction["status"];
    title: string;
    notes: string | null;
    categoryId: string | null;
    beneficiaryId: string | null;
    sourceWalletId: string | null;
    destinationWalletId: string | null;
    creditCardId: string | null;
    invoiceId: string | null;
    tagIds: string[];
}

interface StructuralChanges {
    amount: boolean;
    scheduledDate: boolean;
    status: boolean;
    sourceWalletId: boolean;
    destinationWalletId: boolean;
    creditCardId: boolean;
    invoiceId: boolean;
}

function resolveDraft(snapshot: FinanceSnapshot, selected: StoredTransaction, group: TransactionGroup, draft: TransactionDraft): ResolvedDraft {
    const signedAmount = Number(draft.amount ?? draft.value ?? selected.amount);
    const amount = Number.isFinite(signedAmount) && signedAmount !== 0 ? roundToCents(Math.abs(signedAmount)) : selected.amount;
    const requestedDate = (draft.scheduledDate || draft.date || selected.scheduledDate).trim();
    const scheduledDate = parseAppDate(requestedDate) ? requestedDate : selected.scheduledDate;
    const title = draft.description !== undefined ? draft.description.trim() || resolveTransactionTitle(selected, group) : resolveTransactionTitle(selected, group);
    const notes = draft.notes !== undefined ? draft.notes.trim() || null : selected.notes ?? group.notes;

    const requestedCategoryId = draft.categoryId?.trim() ?? "";
    const requestedCategory = snapshot.categories.find((category) => category.id === requestedCategoryId) ?? null;
    const expectedCategoryType = group.type === "income" ? "income" : "expense";
    const categoryId = requestedCategory?.type === expectedCategoryType ? requestedCategory.id : resolveTransactionCategoryId(selected, group);

    const requestedBeneficiaryId = draft.beneficiaryId?.trim() ?? "";
    const beneficiaryId = snapshot.beneficiaries.some((beneficiary) => beneficiary.id === requestedBeneficiaryId)
        ? requestedBeneficiaryId
        : resolveTransactionBeneficiaryId(selected, group);

    const walletIds = new Set(snapshot.wallets.map((wallet) => wallet.id));
    const requestedSourceWalletId = (draft.inWallet || draft.walletId || "").trim();
    const normalizedSourceWalletId = requestedSourceWalletId ? normalizeWalletId(requestedSourceWalletId) : "";
    const sourceWalletId = walletIds.has(normalizedSourceWalletId) ? normalizedSourceWalletId : resolveTransactionSourceWalletId(selected, group);

    const hasDestinationDraft = Object.prototype.hasOwnProperty.call(draft, "destinationWalletId");
    const requestedDestinationWalletId = draft.destinationWalletId?.trim() ?? "";
    const normalizedDestinationWalletId = requestedDestinationWalletId ? normalizeWalletId(requestedDestinationWalletId) : "";
    const destinationWalletId = hasDestinationDraft
        ? walletIds.has(normalizedDestinationWalletId)
            ? normalizedDestinationWalletId
            : null
        : resolveTransactionDestinationWalletId(selected, group);

    const currentCreditCardId = resolveTransactionCreditCardId(selected, group);
    const requestedCreditCardId = draft.creditCardId?.trim() ?? "";
    const validCreditCardId = snapshot.creditCards.some((card) => card.id === requestedCreditCardId) ? requestedCreditCardId : null;
    const creditCardId = draft.paymentMethod === "wallet" ? null : draft.paymentMethod === "credit_card" ? validCreditCardId ?? currentCreditCardId : currentCreditCardId;
    const status = draft.status === undefined ? selected.status : normalizeTransactionStatus(draft.status);
    const invoiceId = Object.prototype.hasOwnProperty.call(draft, "invoiceId") ? draft.invoiceId?.trim() || null : selected.invoiceId;
    const currentTagIds = snapshot.transactionTags.filter((link) => link.transactionId === selected.id).map((link) => link.tagId);
    const tagIds = Array.from(new Set(draft.tagIds ?? currentTagIds)).filter((tagId) => snapshot.tags.some((tag) => tag.id === tagId));

    return { amount, scheduledDate, status, title, notes, categoryId, beneficiaryId, sourceWalletId, destinationWalletId, creditCardId, invoiceId, tagIds };
}

function buildPatchedMetadataGroup(snapshot: FinanceSnapshot, group: TransactionGroup, resolved: ResolvedDraft): TransactionGroup {
    const category = snapshot.categories.find((item) => item.id === resolved.categoryId) ?? null;
    const beneficiary = snapshot.beneficiaries.find((item) => item.id === resolved.beneficiaryId) ?? null;
    return {
        ...group,
        ...resolveCategoryFields(group, category, snapshot.categories),
        beneficiaryId: beneficiary?.id ?? group.beneficiaryId,
        beneficiaryName: beneficiary?.name ?? group.beneficiaryName,
        title: resolved.title,
        notes: resolved.notes,
    };
}

function canStoreHistoricalValueAsOverride(value: string | null, desiredValue: string | null): boolean {
    return value !== null || desiredValue === null;
}

function patchSeriesGroupStructuralFields(params: {
    group: TransactionGroup;
    originalGroup: TransactionGroup;
    targetTransactions: StoredTransaction[];
    resolved: ResolvedDraft;
    structuralChanges: StructuralChanges;
}): TransactionGroup {
    const nonPendingTransactions = params.targetTransactions.filter((transaction) => transaction.status !== "pending");
    const canPatchSource = params.structuralChanges.sourceWalletId && nonPendingTransactions.every((transaction) =>
        canStoreHistoricalValueAsOverride(resolveTransactionSourceWalletId(transaction, params.originalGroup), params.resolved.sourceWalletId));
    const canPatchDestination = params.structuralChanges.destinationWalletId && nonPendingTransactions.every((transaction) =>
        canStoreHistoricalValueAsOverride(resolveTransactionDestinationWalletId(transaction, params.originalGroup), params.resolved.destinationWalletId));
    const canPatchCreditCard = params.structuralChanges.creditCardId && nonPendingTransactions.every((transaction) =>
        canStoreHistoricalValueAsOverride(resolveTransactionCreditCardId(transaction, params.originalGroup), params.resolved.creditCardId));

    return {
        ...params.group,
        sourceWalletId: canPatchSource ? params.resolved.sourceWalletId : params.group.sourceWalletId,
        destinationWalletId: canPatchDestination ? params.resolved.destinationWalletId : params.group.destinationWalletId,
        creditCardId: canPatchCreditCard ? params.resolved.creditCardId : params.group.creditCardId,
    };
}

function readRule(group: TransactionGroup): Record<string, unknown> {
    return group.recurrenceRule && typeof group.recurrenceRule === "object" ? group.recurrenceRule : {};
}

function readExcludedDates(rule: Record<string, unknown>): string[] {
    return Array.isArray(rule.excludedDates)
        ? Array.from(new Set(rule.excludedDates.filter((value): value is string => typeof value === "string" && Boolean(parseAppDate(value)))))
        : [];
}

function patchRecurrenceRule(params: {
    group: TransactionGroup;
    resolved: ResolvedDraft;
    anchorDate: string;
    excludedDates?: string[];
}): Record<string, unknown> | null {
    if (params.group.transactionMode !== "recurring") {
        return params.group.recurrenceRule;
    }
    const rule = readRule(params.group);
    return {
        ...rule,
        frequency: "monthly",
        interval: Number.isInteger(Number(rule.interval)) && Number(rule.interval) > 0 ? Number(rule.interval) : 1,
        anchorDate: params.anchorDate,
        amount: params.resolved.amount,
        tagIds: params.resolved.tagIds,
        excludedDates: params.excludedDates ?? readExcludedDates(rule),
        notes: params.resolved.notes,
        sourceWalletId: params.resolved.sourceWalletId,
        destinationWalletId: params.resolved.destinationWalletId,
        creditCardId: params.resolved.creditCardId,
    };
}

function resolveAllScopeAnchor(group: TransactionGroup, selected: StoredTransaction, resolvedDate: string): string {
    const rule = readRule(group);
    const oldAnchor = typeof rule.anchorDate === "string" && parseAppDate(rule.anchorDate) ? rule.anchorDate : selected.scheduledDate;
    if (resolvedDate === selected.scheduledDate) {
        return oldAnchor;
    }
    return addMonths(resolvedDate, -monthDistance(oldAnchor, selected.scheduledDate));
}

function transactionFinancialSignature(transaction: StoredTransaction, group: TransactionGroup): string {
    return JSON.stringify({
        amount: transaction.amount,
        scheduledDate: transaction.scheduledDate,
        status: transaction.status,
        paidAt: transaction.paidAt,
        invoiceId: transaction.invoiceId,
        sourceWalletId: resolveTransactionSourceWalletId(transaction, group),
        destinationWalletId: resolveTransactionDestinationWalletId(transaction, group),
        creditCardId: resolveTransactionCreditCardId(transaction, group),
    });
}

function updateLedger(params: {
    before: FinanceSnapshot;
    groups: TransactionGroup[];
    transactions: StoredTransaction[];
    affectedTransactionIds: Set<string>;
}): { ledgerEntries: FinanceSnapshot["ledgerEntries"]; financiallyAffectedTransactionIds: Set<string> } {
    const beforeGroups = new Map(params.before.transactionGroups.map((group) => [group.id, group]));
    const afterGroups = new Map(params.groups.map((group) => [group.id, group]));
    const beforeTransactions = new Map(params.before.transactions.map((transaction) => [transaction.id, transaction]));
    const afterTransactions = new Map(params.transactions.map((transaction) => [transaction.id, transaction]));
    const financiallyAffectedTransactionIds = new Set<string>();
    const expectedDescriptions = new Map<string, string>();

    params.affectedTransactionIds.forEach((transactionId) => {
        const beforeTransaction = beforeTransactions.get(transactionId);
        const afterTransaction = afterTransactions.get(transactionId);
        if (!beforeTransaction || !afterTransaction) {
            return;
        }
        const beforeGroup = beforeGroups.get(beforeTransaction.groupId);
        const afterGroup = afterGroups.get(afterTransaction.groupId);
        if (!beforeGroup || !afterGroup) {
            return;
        }

        if (transactionFinancialSignature(beforeTransaction, beforeGroup) !== transactionFinancialSignature(afterTransaction, afterGroup)) {
            financiallyAffectedTransactionIds.add(transactionId);
            return;
        }

        if (resolveTransactionTitle(beforeTransaction, beforeGroup) !== resolveTransactionTitle(afterTransaction, afterGroup)) {
            createLedgerEntriesForPaidTransaction(afterTransaction, afterGroup).forEach((entry) => expectedDescriptions.set(entry.id, entry.description));
        }
    });

    const ledgerEntries = params.before.ledgerEntries
        .filter((entry) => !entry.transactionId || !financiallyAffectedTransactionIds.has(entry.transactionId))
        .map((entry) => {
            const description = expectedDescriptions.get(entry.id);
            return description === undefined ? entry : { ...entry, description };
        });

    financiallyAffectedTransactionIds.forEach((transactionId) => {
        const transaction = afterTransactions.get(transactionId);
        const group = transaction ? afterGroups.get(transaction.groupId) : null;
        if (transaction && group) {
            ledgerEntries.push(...createLedgerEntriesForPaidTransaction(transaction, group));
        }
    });

    return { ledgerEntries, financiallyAffectedTransactionIds };
}

function buildSeriesTransaction(params: {
    transaction: StoredTransaction;
    oldGroup: TransactionGroup;
    nextGroup: TransactionGroup;
    resolved: ResolvedDraft;
    shouldMove: boolean;
    shouldShiftDate: boolean;
    selected: StoredTransaction;
    now: string;
    structuralChanges: StructuralChanges;
}): StoredTransaction {
    const { transaction, oldGroup, nextGroup, resolved, shouldMove, shouldShiftDate, selected, now, structuralChanges } = params;
    const canChangeFinancialFields = transaction.status === "pending";
    const scheduledDate = canChangeFinancialFields && structuralChanges.scheduledDate && shouldShiftDate
        ? addMonths(resolved.scheduledDate, monthDistance(selected.scheduledDate, transaction.scheduledDate))
        : transaction.scheduledDate;
    const nextStatus = canChangeFinancialFields && structuralChanges.status ? resolved.status : transaction.status;
    const oldSourceWalletId = resolveTransactionSourceWalletId(transaction, oldGroup);
    const oldDestinationWalletId = resolveTransactionDestinationWalletId(transaction, oldGroup);
    const oldCreditCardId = resolveTransactionCreditCardId(transaction, oldGroup);
    const nextSourceWalletId = canChangeFinancialFields && structuralChanges.sourceWalletId ? resolved.sourceWalletId : oldSourceWalletId;
    const nextDestinationWalletId = canChangeFinancialFields && structuralChanges.destinationWalletId ? resolved.destinationWalletId : oldDestinationWalletId;
    const nextCreditCardId = canChangeFinancialFields && structuralChanges.creditCardId ? resolved.creditCardId : oldCreditCardId;

    return {
        ...transaction,
        groupId: shouldMove ? nextGroup.id : transaction.groupId,
        amount: canChangeFinancialFields && structuralChanges.amount ? resolved.amount : transaction.amount,
        scheduledDate,
        status: nextStatus,
        paidAt: nextStatus === "paid" ? transaction.paidAt ?? now : transaction.paidAt,
        invoiceId: canChangeFinancialFields && structuralChanges.invoiceId ? resolved.invoiceId : transaction.invoiceId,
        notes: resolved.notes,
        title: null,
        categoryId: null,
        beneficiaryId: null,
        sourceWalletId: nextSourceWalletId === nextGroup.sourceWalletId ? null : nextSourceWalletId,
        destinationWalletId: nextDestinationWalletId === nextGroup.destinationWalletId ? null : nextDestinationWalletId,
        creditCardId: nextCreditCardId === nextGroup.creditCardId ? null : nextCreditCardId,
    };
}

function addChangedDateExclusions(params: {
    transactions: StoredTransaction[];
    selected: StoredTransaction;
    resolvedDate: string;
    existingExcludedDates: string[];
}): string[] {
    const excluded = new Set(params.existingExcludedDates);
    if (params.resolvedDate === params.selected.scheduledDate) {
        return Array.from(excluded);
    }
    params.transactions.forEach((transaction) => {
        if (transaction.status !== "pending") {
            excluded.add(addMonths(params.resolvedDate, monthDistance(params.selected.scheduledDate, transaction.scheduledDate)));
        }
    });
    return Array.from(excluded);
}

export function updateTransactionSeriesSnapshot(params: UpdateTransactionSeriesSnapshotParams): TransactionSeriesUpdateResult {
    const { snapshot, transactionId, draft } = params;
    const selected = snapshot.transactions.find((transaction) => transaction.id === transactionId);
    if (!selected) {
        throw new Error(`Transacao ${transactionId} nao encontrada.`);
    }
    const originalGroup = snapshot.transactionGroups.find((group) => group.id === selected.groupId);
    if (!originalGroup) {
        throw new Error(`Grupo ${selected.groupId} nao encontrado.`);
    }

    const scope = params.scope === "all" || params.scope === "this_and_next" ? params.scope : "single";
    const resolved = resolveDraft(snapshot, selected, originalGroup, draft);
    const structuralChanges: StructuralChanges = {
        amount: resolved.amount !== selected.amount,
        scheduledDate: resolved.scheduledDate !== selected.scheduledDate,
        status: resolved.status !== selected.status,
        sourceWalletId: resolved.sourceWalletId !== resolveTransactionSourceWalletId(selected, originalGroup),
        destinationWalletId: resolved.destinationWalletId !== resolveTransactionDestinationWalletId(selected, originalGroup),
        creditCardId: resolved.creditCardId !== resolveTransactionCreditCardId(selected, originalGroup),
        invoiceId: resolved.invoiceId !== selected.invoiceId,
    };
    const groupTransactions = snapshot.transactions
        .filter((transaction) => transaction.groupId === originalGroup.id)
        .sort((a, b) => compareSeriesTransactions(a, b, originalGroup.transactionMode));
    const targetTransactions = scope === "all"
        ? groupTransactions
        : scope === "this_and_next"
          ? groupTransactions.filter((transaction) => isAtOrAfter(transaction, selected, originalGroup.transactionMode))
          : [selected];
    const affectedTransactionIds = new Set(targetTransactions.map((transaction) => transaction.id));
    const isSeriesScope = scope !== "single" && originalGroup.transactionMode !== "single";
    const shouldSplit = scope === "this_and_next" && originalGroup.transactionMode !== "single";
    const validGroupId = shouldSplit ? params.createGroupId?.() ?? `group-split-${originalGroup.id}-${selected.id}` : originalGroup.id;
    const operationTimestamp = params.now ?? selected.createdAt;

    let nextGroups = [...snapshot.transactionGroups];
    let targetGroup = originalGroup;
    const originalRule = readRule(originalGroup);
    const seriesResolved: ResolvedDraft = {
        ...resolved,
        amount: structuralChanges.amount
            ? resolved.amount
            : Number.isFinite(Number(originalRule.amount)) && Number(originalRule.amount) > 0 ? Number(originalRule.amount) : selected.amount,
        sourceWalletId: structuralChanges.sourceWalletId
            ? resolved.sourceWalletId
            : typeof originalRule.sourceWalletId === "string" ? originalRule.sourceWalletId : originalGroup.sourceWalletId,
        destinationWalletId: structuralChanges.destinationWalletId
            ? resolved.destinationWalletId
            : typeof originalRule.destinationWalletId === "string" ? originalRule.destinationWalletId : originalGroup.destinationWalletId,
        creditCardId: structuralChanges.creditCardId
            ? resolved.creditCardId
            : typeof originalRule.creditCardId === "string" ? originalRule.creditCardId : originalGroup.creditCardId,
    };

    if (scope === "all") {
        const anchorDate = resolveAllScopeAnchor(originalGroup, selected, resolved.scheduledDate);
        const exclusions = addChangedDateExclusions({
            transactions: targetTransactions,
            selected,
            resolvedDate: resolved.scheduledDate,
            existingExcludedDates: readExcludedDates(readRule(originalGroup)),
        });
        const metadataGroup = buildPatchedMetadataGroup(snapshot, originalGroup, resolved);
        targetGroup = {
            ...patchSeriesGroupStructuralFields({ group: metadataGroup, originalGroup, targetTransactions, resolved, structuralChanges }),
            recurrenceRule: patchRecurrenceRule({ group: originalGroup, resolved: seriesResolved, anchorDate, excludedDates: exclusions }),
        };
        nextGroups = nextGroups.map((group) => (group.id === originalGroup.id ? targetGroup : group));
    } else if (shouldSplit) {
        const nextExcludedDates = readExcludedDates(originalRule).filter((date) => date >= selected.scheduledDate);
        const splitMetadataGroup = buildPatchedMetadataGroup(snapshot, { ...originalGroup, id: validGroupId }, resolved);
        const splitBase = patchSeriesGroupStructuralFields({
            group: splitMetadataGroup,
            originalGroup,
            targetTransactions,
            resolved,
            structuralChanges,
        });
        targetGroup = {
            ...splitBase,
            id: validGroupId,
            recurrenceRule: patchRecurrenceRule({
                group: splitBase,
                resolved: seriesResolved,
                anchorDate: resolved.scheduledDate,
                excludedDates: addChangedDateExclusions({ transactions: targetTransactions, selected, resolvedDate: resolved.scheduledDate, existingExcludedDates: nextExcludedDates }),
            }),
            recurrenceEndDate: originalGroup.recurrenceEndDate,
            createdAt: params.now ?? selected.createdAt,
        };
        const truncatedOriginal = {
            ...originalGroup,
            recurrenceEndDate: originalGroup.transactionMode === "recurring" ? addDays(selected.scheduledDate, -1) : originalGroup.recurrenceEndDate,
        };
        nextGroups = nextGroups.map((group) => (group.id === originalGroup.id ? truncatedOriginal : group)).concat(targetGroup);
    } else if (originalGroup.transactionMode === "single") {
        targetGroup = {
            ...buildPatchedMetadataGroup(snapshot, originalGroup, resolved),
            sourceWalletId: resolved.sourceWalletId,
            destinationWalletId: resolved.destinationWalletId,
            creditCardId: resolved.creditCardId,
        };
        nextGroups = nextGroups.map((group) => (group.id === originalGroup.id ? targetGroup : group));
    } else if (resolved.scheduledDate !== selected.scheduledDate && originalGroup.transactionMode === "recurring") {
        const rule = readRule(originalGroup);
        targetGroup = { ...originalGroup, recurrenceRule: { ...rule, excludedDates: Array.from(new Set([...readExcludedDates(rule), selected.scheduledDate])) } };
        nextGroups = nextGroups.map((group) => (group.id === originalGroup.id ? targetGroup : group));
    }

    let nextTransactions = snapshot.transactions.map((transaction) => {
        if (!affectedTransactionIds.has(transaction.id)) {
            return transaction;
        }
        if (isSeriesScope) {
            return buildSeriesTransaction({
                transaction,
                oldGroup: originalGroup,
                nextGroup: targetGroup,
                resolved,
                shouldMove: shouldSplit,
                shouldShiftDate: resolved.scheduledDate !== selected.scheduledDate,
                selected,
                now: operationTimestamp,
                structuralChanges,
            });
        }

        const shouldPatchGroup = originalGroup.transactionMode === "single";
        const nextStatus = resolved.status;
        return {
            ...transaction,
            amount: resolved.amount,
            scheduledDate: resolved.scheduledDate,
            status: nextStatus,
            paidAt: nextStatus === "paid" ? transaction.paidAt ?? operationTimestamp : null,
            invoiceId: resolved.invoiceId,
            notes: resolved.notes,
            title: shouldPatchGroup || resolved.title === originalGroup.title ? null : resolved.title,
            categoryId: shouldPatchGroup || resolved.categoryId === originalGroup.categoryId ? null : resolved.categoryId,
            beneficiaryId: shouldPatchGroup || resolved.beneficiaryId === originalGroup.beneficiaryId ? null : resolved.beneficiaryId,
            sourceWalletId: shouldPatchGroup || resolved.sourceWalletId === originalGroup.sourceWalletId ? null : resolved.sourceWalletId,
            destinationWalletId: shouldPatchGroup || resolved.destinationWalletId === originalGroup.destinationWalletId ? null : resolved.destinationWalletId,
            creditCardId: shouldPatchGroup || resolved.creditCardId === originalGroup.creditCardId ? null : resolved.creditCardId,
        };
    });

    nextGroups = recalculateGroupTotals(nextGroups, nextTransactions);
    const nextTransactionTags = draft.tagIds === undefined
        ? snapshot.transactionTags
        : replaceTransactionTags(snapshot.transactionTags, affectedTransactionIds, resolved.tagIds);
    const ledgerUpdate = updateLedger({ before: snapshot, groups: nextGroups, transactions: nextTransactions, affectedTransactionIds });

    const financiallyAffectedTransactionIds = ledgerUpdate.financiallyAffectedTransactionIds;
    const recurrenceFinancialChange = isSeriesScope && originalGroup.transactionMode === "recurring" && Object.values(structuralChanges).some(Boolean);
    const metadataOnly = financiallyAffectedTransactionIds.size === 0 && !recurrenceFinancialChange;
    const nextSnapshot: FinanceSnapshot = {
        ...snapshot,
        transactionGroups: nextGroups,
        transactions: nextTransactions,
        ledgerEntries: ledgerUpdate.ledgerEntries,
        transactionTags: nextTransactionTags,
    };

    validateTransactionSeriesUpdateInvariants({
        before: snapshot,
        after: nextSnapshot,
        affectedTransactionIds,
        metadataOnly,
        preservePaidTransactions: isSeriesScope,
    });

    return { snapshot: nextSnapshot, affectedTransactionIds, financiallyAffectedTransactionIds, metadataOnly };
}
