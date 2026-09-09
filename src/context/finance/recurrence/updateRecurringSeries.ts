import { addMonthsToLocalDate, getLocalTodayDate } from "../../../lib/localDate";
import { createLedgerEntriesForPaidTransaction, resolveTransactionBeneficiaryId, resolveTransactionCategoryId, resolveTransactionCreditCardId, resolveTransactionDestinationWalletId, resolveTransactionSourceWalletId, resolveTransactionTitle } from "../financeCore";
import type { StoredTransaction, TransactionGroup } from "../domainTypes";
import { buildPatchedMetadataGroup, resolveDraft } from "../transactionSeries/draft";
import { monthDistance, recalculateGroupTotals, replaceTransactionTags } from "../transactionSeries/helpers";
import type { TransactionSeriesUpdateResult, UpdateTransactionSeriesSnapshotParams } from "../transactionSeries/updateTransactionSeriesSnapshot";
import { requireRecurrenceRule } from "./rule";
import { occurrenceDate } from "./projectOccurrences";
import { seriesChanges } from "./seriesChanges";
import { remapExcludedDates } from "./remapExcludedDates";

export function recurringOrdinal(transaction: StoredTransaction, group: TransactionGroup): number {
    const rule = requireRecurrenceRule(group.recurrenceRule);
    return transaction.occurrenceNumber ?? (rule.startNumber ?? 1) + Math.max(0, Math.floor(monthDistance(rule.anchorDate, transaction.scheduledDate) / rule.interval));
}

export function isConsolidatedOccurrence(transaction: StoredTransaction, group: TransactionGroup, today: string): boolean {
    return transaction.status === "paid" || Boolean(resolveTransactionCreditCardId(transaction, group) && transaction.commitment !== "forecast" && transaction.scheduledDate <= today);
}

export function updateRecurringSeries(params: UpdateTransactionSeriesSnapshotParams): TransactionSeriesUpdateResult {
    const { snapshot, transactionId, draft, scope } = params;
    const selected = snapshot.transactions.find((item) => item.id === transactionId)!;
    const original = snapshot.transactionGroups.find((item) => item.id === selected.groupId)!;
    const originalRule = requireRecurrenceRule(original.recurrenceRule);
    const seriesId = originalRule.seriesId ?? original.id;
    const seriesGroups = snapshot.transactionGroups.filter((item) => (item.recurrenceRule?.seriesId ?? item.id) === seriesId);
    const groupsById = new Map(seriesGroups.map((item) => [item.id, item]));
    const selectedNumber = recurringOrdinal(selected, original);
    const resolved = resolveDraft(snapshot, selected, original, draft);
    const changes = seriesChanges(resolveDraft(snapshot, selected, original, {}), resolved);
    const today = getLocalTodayDate(params.now ? new Date(params.now) : new Date());
    const now = params.now ?? new Date().toISOString();
    const dateChanged = resolved.scheduledDate !== selected.scheduledDate;
    const amountChanged = resolved.amount !== selected.amount;
    const affectedTransactionIds = new Set<string>();
    const financiallyAffectedTransactionIds = new Set<string>();
    const seriesScope = scope !== "single";
    const targetStart = scope === "all" ? 1 : selectedNumber;
    let nextGroups = snapshot.transactionGroups;
    let targetGroup = original;

    if (seriesScope) {
        if (changes.status === "paid") throw new Error("Registre o pagamento ou recebimento de cada ocorrência individualmente.");
        const defaults = resolveDraft(snapshot, { ...selected, amount: originalRule.amount, title: null, notes: originalRule.notes,
            categoryId: null, beneficiaryId: null, sourceWalletId: originalRule.sourceWalletId ?? null, destinationWalletId: originalRule.destinationWalletId ?? null,
            creditCardId: originalRule.creditCardId ?? null }, original, changes);
        const activeSegments = seriesGroups.filter((item) => (item.recurrenceRule?.stopNumber ?? Infinity) >= (item.recurrenceRule?.startNumber ?? 1));
        const lastSegment = [...activeSegments].sort((a, b) => (b.recurrenceRule?.startNumber ?? 1) - (a.recurrenceRule?.startNumber ?? 1))[0] ?? original;
        const end = draft.recurrenceRule?.end ?? lastSegment.recurrenceRule!.end;
        const targetAnchor = dateChanged
            ? addMonthsToLocalDate(resolved.scheduledDate, (targetStart - selectedNumber) * originalRule.interval)
            : addMonthsToLocalDate(originalRule.anchorDate, (targetStart - (originalRule.startNumber ?? 1)) * originalRule.interval);
        targetGroup = {
            ...buildPatchedMetadataGroup(snapshot, original, defaults),
            id: params.createGroupId?.() ?? `group-revision-${transactionId}-${now}`,
            sourceWalletId: defaults.sourceWalletId, destinationWalletId: defaults.destinationWalletId, creditCardId: defaults.creditCardId,
            recurrenceEndDate: null,
            recurrenceRule: requireRecurrenceRule({
                ...originalRule, seriesId, startNumber: targetStart, stopNumber: changes.status === "skipped" || changes.status === "cancelled" ? targetStart - 1 : undefined, end,
                anchorDate: targetAnchor, amount: amountChanged ? resolved.amount : originalRule.amount,
                excludedDates: remapExcludedDates(originalRule, targetAnchor, targetStart),
                notes: defaults.notes, tagIds: changes.tagIds ?? originalRule.tagIds,
                sourceWalletId: defaults.sourceWalletId, destinationWalletId: defaults.destinationWalletId, creditCardId: defaults.creditCardId,
            }),
            createdAt: now,
        };
        nextGroups = snapshot.transactionGroups.map((group) => groupsById.has(group.id)
            ? { ...group, recurrenceRule: { ...group.recurrenceRule!, seriesId, stopNumber: Math.min(group.recurrenceRule?.stopNumber ?? Infinity, targetStart - 1) } }
            : group).concat(targetGroup);
    } else if ((resolved.creditCardId === null && original.creditCardId) || (resolved.destinationWalletId === null && original.destinationWalletId)) {
        // Nullable row fields inherit routing. A non-projecting revision gives
        // this occurrence explicit routing while retaining its series identity.
        targetGroup = {
            ...buildPatchedMetadataGroup(snapshot, original, resolved),
            id: params.createGroupId?.() ?? `group-override-${transactionId}-${now}`,
            sourceWalletId: resolved.sourceWalletId, destinationWalletId: resolved.destinationWalletId, creditCardId: resolved.creditCardId,
            recurrenceRule: { ...originalRule, seriesId, anchorDate: resolved.scheduledDate, startNumber: selectedNumber, stopNumber: selectedNumber - 1,
                sourceWalletId: resolved.sourceWalletId, destinationWalletId: resolved.destinationWalletId, creditCardId: resolved.creditCardId },
            createdAt: now,
        };
        nextGroups = snapshot.transactionGroups.concat(targetGroup);
    }

    const nextTransactions = snapshot.transactions.flatMap((transaction): StoredTransaction[] => {
        const oldGroup = groupsById.get(transaction.groupId);
        if (!oldGroup) return [transaction];
        const number = recurringOrdinal(transaction, oldGroup);
        if ((!seriesScope && transaction.id !== selected.id) || (seriesScope && number < targetStart)) return [transaction];
        const invoice = snapshot.creditCardInvoices.find((item) => item.id === transaction.invoiceId);
        if (seriesScope && (isConsolidatedOccurrence(transaction, oldGroup, today) || (invoice?.paidAmount ?? 0) > 0)) {
            // Keep the complete historical group and occurrence untouched.
            return [transaction];
        }
        affectedTransactionIds.add(transaction.id);
        if (seriesScope && params.wasProjected && transaction.id === selected.id && resolved.status === "pending") return [];
        const rowDraft = seriesScope ? resolveDraft(snapshot, transaction, oldGroup, changes) : resolved;
        const status = seriesScope && transaction.status !== "pending" ? transaction.status : rowDraft.status;
        const scheduledDate = seriesScope
            ? dateChanged ? occurrenceDate(targetGroup.recurrenceRule!, number) : transaction.scheduledDate
            : resolved.scheduledDate;
        const sourceWalletId = rowDraft.sourceWalletId;
        const creditCardId = rowDraft.creditCardId;
        const changed: StoredTransaction = {
            ...transaction, groupId: targetGroup.id, occurrenceNumber: number,
            amount: seriesScope && !amountChanged ? transaction.amount : resolved.amount,
            scheduledDate, status, commitment: status === "paid" ? "posted" : draft.commitment ?? transaction.commitment, paidAt: status === "paid" ? transaction.paidAt ?? now : null,
            invoiceId: dateChanged || creditCardId !== resolveTransactionCreditCardId(transaction, oldGroup) ? null : transaction.id === selected.id ? resolved.invoiceId : transaction.invoiceId,
            title: rowDraft.title, notes: rowDraft.notes, categoryId: rowDraft.categoryId, beneficiaryId: rowDraft.beneficiaryId,
            sourceWalletId, destinationWalletId: rowDraft.destinationWalletId, creditCardId,
        };
        if (draft.commitment === "posted" && resolved.creditCardId && scheduledDate > today) throw new Error("Confirme a cobrança a partir da data prevista.");
        const financialChange = transaction.commitment !== changed.commitment || transaction.amount !== changed.amount || transaction.scheduledDate !== changed.scheduledDate || transaction.status !== changed.status || transaction.invoiceId !== changed.invoiceId
            || resolveTransactionSourceWalletId(transaction, oldGroup) !== sourceWalletId || resolveTransactionCreditCardId(transaction, oldGroup) !== creditCardId
            || resolveTransactionDestinationWalletId(transaction, oldGroup) !== changed.destinationWalletId;
        if (financialChange && invoice && invoice.paidAmount > 0) throw new Error("Reverta o pagamento da fatura antes de alterar seus gastos.");
        if (creditCardId && status === "paid" && transaction.status !== "paid") throw new Error("Pague o cartão pela fatura.");
        if (financialChange) financiallyAffectedTransactionIds.add(transaction.id);
        // Avoid rewriting a historical individual row when nothing changed.
        if (!financialChange && resolveTransactionTitle(transaction, oldGroup) === resolved.title && resolveTransactionCategoryId(transaction, oldGroup) === resolved.categoryId
            && resolveTransactionBeneficiaryId(transaction, oldGroup) === resolved.beneficiaryId && transaction.notes === resolved.notes && !seriesScope) return [transaction];
        return [changed];
    });
    const nextIds = new Set(nextTransactions.map((item) => item.id));
    const changedIds = new Set([...affectedTransactionIds].filter((id) => nextIds.has(id)));
    const replaceTags = seriesScope ? changes.tagIds !== undefined : draft.tagIds !== undefined;
    const nextTags = replaceTags ? replaceTransactionTags(snapshot.transactionTags, changedIds, resolved.tagIds) : snapshot.transactionTags;
    const ledgerEntries = snapshot.ledgerEntries.filter((entry) => !entry.transactionId || !financiallyAffectedTransactionIds.has(entry.transactionId));
    for (const transaction of nextTransactions) {
        if (!financiallyAffectedTransactionIds.has(transaction.id)) continue;
        const group = nextGroups.find((item) => item.id === transaction.groupId)!;
        ledgerEntries.push(...createLedgerEntriesForPaidTransaction(transaction, group));
    }
    return {
        snapshot: { ...snapshot, transactionGroups: recalculateGroupTotals(nextGroups, nextTransactions), transactions: nextTransactions, ledgerEntries, transactionTags: nextTags.filter((link) => nextIds.has(link.transactionId)) },
        affectedTransactionIds, financiallyAffectedTransactionIds, metadataOnly: !seriesScope && financiallyAffectedTransactionIds.size === 0,
    };
}
