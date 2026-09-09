import { getLocalTodayDate } from "../../../lib/localDate";
import { createFinanceSnapshot } from "../financeCore";
import { createTransactionSnapshot } from "../transactionCreation/createTransactionSnapshot";
import type { FinanceSnapshot, StoredTransaction, TransactionDraft, TransactionGroup } from "../domainTypes";
import { isConsolidatedOccurrence, recurringOrdinal } from "../recurrence/updateRecurringSeries";
import { resolveDraft } from "./draft";
import { recalculateGroupTotals } from "./helpers";
import type { TransactionSeriesUpdateResult, UpdateTransactionSeriesSnapshotParams } from "./updateTransactionSeriesSnapshot";

function transactionOrdinal(transaction: StoredTransaction, group: TransactionGroup): number {
    return group.transactionMode === "recurring"
        ? recurringOrdinal(transaction, group)
        : transaction.installmentNumber ?? 1;
}

function rebuildSnapshot(snapshot: FinanceSnapshot, groups: TransactionGroup[], transactions: StoredTransaction[], removedIds: ReadonlySet<string>): FinanceSnapshot {
    return createFinanceSnapshot(
        snapshot.wallets,
        snapshot.creditCards,
        snapshot.creditCardInvoices,
        snapshot.favoriteCreditCardId,
        recalculateGroupTotals(groups, transactions),
        transactions,
        snapshot.ledgerEntries.filter((entry) => !entry.transactionId || !removedIds.has(entry.transactionId)),
        snapshot.beneficiaries,
        snapshot.categories,
        snapshot.tags,
        snapshot.wishItems,
        snapshot.transactionTags.filter((link) => !removedIds.has(link.transactionId)),
        snapshot.planning,
    );
}

function normalizeRemainingInstallments(groups: TransactionGroup[], transactions: StoredTransaction[]) {
    const transactionUpdates = new Map<string, StoredTransaction>();
    const groupUpdates = new Map<string, TransactionGroup>();

    groups.forEach((group) => {
        if (group.transactionMode !== "installment") return;
        const remaining = transactions
            .filter((transaction) => transaction.groupId === group.id)
            .sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1));
        if (remaining.length === 1) {
            groupUpdates.set(group.id, { ...group, transactionMode: "single", installmentCount: null });
            transactionUpdates.set(remaining[0].id, { ...remaining[0], installmentNumber: null });
        } else if (remaining.length > 1) {
            groupUpdates.set(group.id, { ...group, installmentCount: remaining.length });
            remaining.forEach((transaction, index) => {
                transactionUpdates.set(transaction.id, { ...transaction, installmentNumber: index + 1 });
            });
        }
    });

    return {
        groups: groups.map((group) => groupUpdates.get(group.id) ?? group),
        transactions: transactions.map((transaction) => transactionUpdates.get(transaction.id) ?? transaction),
    };
}

/** Converts the selected transaction, or the editable part of its series, to another mode. */
export function convertTransactionModeSnapshot(params: UpdateTransactionSeriesSnapshotParams): TransactionSeriesUpdateResult {
    const { snapshot, transactionId, draft, scope } = params;
    const selected = snapshot.transactions.find((transaction) => transaction.id === transactionId);
    if (!selected) throw new Error("Transação não encontrada.");
    const sourceGroup = snapshot.transactionGroups.find((group) => group.id === selected.groupId);
    if (!sourceGroup) throw new Error("Grupo da transação não encontrado.");
    const requestedMode = draft.transactionMode;
    if (!requestedMode || requestedMode === sourceGroup.transactionMode) {
        throw new Error("O novo tipo da transação deve ser diferente do atual.");
    }
    if (sourceGroup.type === "transfer") throw new Error("Transferências só podem ser transações únicas.");

    const now = params.now ?? new Date().toISOString();
    const today = getLocalTodayDate(new Date(now));
    const resolved = resolveDraft(snapshot, selected, sourceGroup, draft);
    const sourceSeriesId = sourceGroup.recurrenceRule?.seriesId ?? sourceGroup.id;
    const sourceGroups = sourceGroup.transactionMode === "recurring"
        ? snapshot.transactionGroups.filter((group) => (group.recurrenceRule?.seriesId ?? group.id) === sourceSeriesId)
        : [sourceGroup];
    const sourceGroupIds = new Set(sourceGroups.map((group) => group.id));
    const selectedOrdinal = transactionOrdinal(selected, sourceGroup);
    const invoiceById = new Map(snapshot.creditCardInvoices.map((invoice) => [invoice.id, invoice]));
    const removedIds = new Set<string>();

    snapshot.transactions.forEach((transaction) => {
        if (!sourceGroupIds.has(transaction.groupId)) return;
        const transactionGroup = sourceGroups.find((group) => group.id === transaction.groupId) ?? sourceGroup;
        const ordinal = transactionOrdinal(transaction, transactionGroup);
        const inScope = scope === "single" ? transaction.id === selected.id : scope === "all" || ordinal >= selectedOrdinal;
        if (!inScope) return;
        const protectedHistory = scope !== "single" && (
            isConsolidatedOccurrence(transaction, transactionGroup, today) ||
            (invoiceById.get(transaction.invoiceId ?? "")?.paidAmount ?? 0) > 0
        );
        if (!protectedHistory) removedIds.add(transaction.id);
    });

    let remainingGroups = snapshot.transactionGroups.map((group) => {
        if (sourceGroup.transactionMode !== "recurring" || !sourceGroupIds.has(group.id) || !group.recurrenceRule) return group;
        if (scope === "single") {
            return {
                ...group,
                recurrenceRule: {
                    ...group.recurrenceRule,
                    excludedDates: Array.from(new Set([...group.recurrenceRule.excludedDates, selected.scheduledDate])),
                },
            };
        }
        const stopNumber = scope === "all" ? 0 : selectedOrdinal - 1;
        return {
            ...group,
            recurrenceRule: {
                ...group.recurrenceRule,
                stopNumber: Math.min(group.recurrenceRule.stopNumber ?? Infinity, stopNumber),
            },
        };
    });
    let remainingTransactions = snapshot.transactions.filter((transaction) => !removedIds.has(transaction.id));
    const groupsWithTransactions = new Set(remainingTransactions.map((transaction) => transaction.groupId));
    remainingGroups = remainingGroups.filter((group) => group.transactionMode === "recurring" || groupsWithTransactions.has(group.id));

    const normalizedRemaining = normalizeRemainingInstallments(remainingGroups, remainingTransactions);
    remainingGroups = normalizedRemaining.groups;
    remainingTransactions = normalizedRemaining.transactions;
    const withoutConverted = rebuildSnapshot(snapshot, remainingGroups, remainingTransactions, removedIds);
    const targetGroupId = sourceGroup.transactionMode === "single"
        ? sourceGroup.id
        : params.createGroupId?.() ?? `group-converted-${transactionId}-${now}`;
    const conversionDraft: TransactionDraft = {
        ...draft,
        id: selected.id,
        groupId: targetGroupId,
        type: sourceGroup.type,
        amount: resolved.amount,
        scheduledDate: resolved.scheduledDate,
        status: resolved.status,
        description: resolved.title,
        notes: resolved.notes ?? undefined,
        categoryId: resolved.categoryId,
        beneficiaryId: resolved.beneficiaryId,
        tagIds: resolved.tagIds,
        inWallet: resolved.sourceWalletId ?? undefined,
        destinationWalletId: resolved.destinationWalletId,
        paymentMethod: resolved.creditCardId ? "credit_card" : "wallet",
        creditCardId: resolved.creditCardId,
        invoiceId: resolved.invoiceId,
        transactionMode: requestedMode,
    };
    const converted = createTransactionSnapshot(withoutConverted, conversionDraft, {
        userId: sourceGroup.userId,
        now,
        // The temporary snapshot no longer contains the source row. Validating
        // it here would misclassify the same charge as a new charge. The caller
        // validates the complete conversion against the original snapshot.
        deferInvoiceMutationValidation: true,
    });
    const previousIds = new Set(withoutConverted.transactions.map((transaction) => transaction.id));
    const createdIds = converted.transactions.filter((transaction) => !previousIds.has(transaction.id)).map((transaction) => transaction.id);
    const affectedTransactionIds = new Set([...removedIds, ...createdIds]);

    return {
        snapshot: converted,
        affectedTransactionIds,
        financiallyAffectedTransactionIds: new Set(affectedTransactionIds),
        metadataOnly: false,
    };
}
