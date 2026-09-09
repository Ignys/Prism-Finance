import type { FinanceSnapshot, TransactionDraft, TransactionMode } from "../domainTypes";
import { createFinanceSnapshot, createLedgerEntriesForPaidTransaction, DEFAULT_BENEFICIARY_NAME, DEFAULT_WALLET_ID, normalizeTransactionGroup, normalizeTransactionStatus, normalizeWalletId } from "../financeCore";
import { createId, ensureWalletId, resolveGroupType, roundToCents } from "../helpers";
import { normalizeIgnoredInstallmentsCount, resolveNewTransactionMode } from "../installmentTransactions";
import { compareCategoriesByTypeParentSort, compareBySortOrderNameAndId } from "../registryOrdering";
import { requireRecurrenceRule } from "../recurrence/rule";
import { recalculateGroupTotals } from "../transactionSeries/helpers";
import { syncCreditCardInvoices } from "../syncCreditCardInvoices";
import { assertInvoiceMutation } from "../invoiceMutations";
import { getLocalTodayDate, parseDateOnlyToLocalDate } from "../../../lib/localDate";
import { resolveDraftEntities } from "./resolveDraftEntities";
import { buildCreatedOccurrences } from "./buildCreatedOccurrences";

interface CreateTransactionSnapshotOptions {
    userId?: string | null;
    displayName?: string;
    now?: string;
    /** A composite operation may validate once against its original snapshot. */
    deferInvoiceMutationValidation?: boolean;
}

export function createTransactionSnapshot(before: FinanceSnapshot, newTransaction: TransactionDraft, options: CreateTransactionSnapshotOptions = {}): FinanceSnapshot {
    const signedValue = Number(newTransaction.amount ?? newTransaction.value ?? 0);
    if (!Number.isFinite(signedValue) || signedValue === 0) {
        throw new Error("Informe um valor diferente de zero.");
    }

    const nowIso = options.now ?? new Date().toISOString();
    const absoluteAmount = roundToCents(Math.abs(signedValue));
    if (absoluteAmount < 0.01) throw new Error("Informe um valor de pelo menos R$ 0,01.");
    const groupType = resolveGroupType(newTransaction.type, signedValue);
    const status = normalizeTransactionStatus(newTransaction.status);
    const { finalCategory, finalBeneficiary, categoryName, subcategoryName, nextCategories, nextBeneficiaries } = resolveDraftEntities(
        before, newTransaction, groupType, nowIso, options.userId ?? null, options.displayName ?? DEFAULT_BENEFICIARY_NAME,
    );

    const description = (newTransaction.description || "").trim();
    const scheduledDate = newTransaction.scheduledDate || newTransaction.date || getLocalTodayDate(new Date(nowIso));
    if (!parseDateOnlyToLocalDate(scheduledDate)) throw new Error("Data da transa\u00e7\u00e3o inv\u00e1lida.");
    const wantsCreditCardPayment = newTransaction.paymentMethod === "credit_card" && groupType === "expense";
    const requestedCreditCardId = newTransaction.creditCardId?.trim() ?? "";
    const requestedCreditCard = wantsCreditCardPayment ? before.creditCards.find((card) => card.id === requestedCreditCardId) ?? null : null;
    const fallbackCreditCard = wantsCreditCardPayment ? before.creditCards.find((card) => card.id === before.favoriteCreditCardId) ?? before.creditCards[0] ?? null : null;
    const resolvedCreditCard = requestedCreditCard ?? fallbackCreditCard;
    if (wantsCreditCardPayment && ((!requestedCreditCard && requestedCreditCardId) || !resolvedCreditCard)) throw new Error("Selecione um cartão válido para registrar o gasto.");
    const preferredWalletFromCard = resolvedCreditCard?.bankWalletId ?? null;
    const sourceWalletId = ensureWalletId(
        normalizeWalletId(newTransaction.inWallet || newTransaction.walletId || preferredWalletFromCard || DEFAULT_WALLET_ID),
        before.wallets,
    );
    const destinationWalletIdRaw = newTransaction.destinationWalletId ? normalizeWalletId(newTransaction.destinationWalletId) : null;
    const destinationWalletId = destinationWalletIdRaw ? ensureWalletId(destinationWalletIdRaw, before.wallets) : null;
    const validTagIds = Array.from(new Set(newTransaction.tagIds ?? [])).filter((tagId) => before.tags.some((tag) => tag.id === tagId));

    const transactionId = newTransaction.id && newTransaction.id.trim() ? newTransaction.id.trim() : createId("tx");
    const groupId = newTransaction.groupId && newTransaction.groupId.trim() ? newTransaction.groupId.trim() : `group-${transactionId}`;
    const existingGroup = before.transactionGroups.find((group) => group.id === groupId);
    // A repeated submission must not append the same occurrence or rule.
    if (before.transactions.some((transaction) => transaction.id === transactionId) || (existingGroup?.transactionMode === "recurring" && newTransaction.transactionMode === "recurring")) return before;
    const transactionMode: TransactionMode =
        existingGroup?.transactionMode ?? resolveNewTransactionMode(groupType, newTransaction.transactionMode);

    const resolvedGroupCreditCardId = existingGroup?.creditCardId ?? (groupType === "expense" ? resolvedCreditCard?.id ?? null : null);
    const rawInstallmentCount = Number(newTransaction.installmentCount ?? existingGroup?.installmentCount ?? 0);
    const installmentCount = transactionMode === "installment" && Number.isInteger(rawInstallmentCount) && rawInstallmentCount >= 2 ? rawInstallmentCount : null;
    if (transactionMode === "installment" && installmentCount === null) throw new Error("Informe uma quantidade inteira de pelo menos duas parcelas.");
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
            ? requireRecurrenceRule({
                  frequency: "monthly",
                  interval: 1,
                  excludedDates: existingGroup?.recurrenceRule?.excludedDates ?? [],
                  notes: newTransaction.notes ?? null,
                  ...existingRecurrenceRule,
                  ...providedRecurrenceRule,
                  // Creation fields are authoritative; stale rule metadata cannot
                  // change the submitted amount/date or join an unrelated series.
                  seriesId: groupId,
                  startNumber: 1,
                  stopNumber: undefined,
                  anchorDate: scheduledDate,
                  amount: absoluteAmount,
                  tagIds: validTagIds,
                  sourceWalletId,
                  destinationWalletId,
                  creditCardId: resolvedGroupCreditCardId,
              })
            : null;
    const group = normalizeTransactionGroup({
        ...existingGroup,
        id: groupId, userId: existingGroup?.userId ?? options.userId ?? null,
        beneficiaryId: finalBeneficiary.id, beneficiaryName: finalBeneficiary.name,
        categoryId: finalCategory.id, categoryName, subcategoryName,
        title: description || categoryName, notes: newTransaction.notes || null,
        type: existingGroup?.type ?? groupType, transactionMode,
        totalAmount: roundToCents((existingGroup?.totalAmount ?? 0) + absoluteAmount),
        installmentCount, recurrenceRule,
        recurrenceEndDate: transactionMode === "recurring" ? newTransaction.recurrenceEndDate ?? existingGroup?.recurrenceEndDate ?? null : null,
        sourceWalletId, destinationWalletId, creditCardId: resolvedGroupCreditCardId,
        createdAt: existingGroup?.createdAt ?? nowIso,
    }, new Set(before.wallets.map((wallet) => wallet.id)));

    const nextGroups = existingGroup
        ? before.transactionGroups.map((item) => (item.id === groupId ? group : item))
        : [...before.transactionGroups, group];

    const createdTransactions = buildCreatedOccurrences({
        snapshot: before, draft: newTransaction, group, transactionId, amount: absoluteAmount,
        scheduledDate, status, ignoredInstallmentsCount, now: nowIso,
    });
    const nextTransactions = [...before.transactions, ...createdTransactions];
    const nextTransactionTags = [...before.transactionTags];
    createdTransactions.forEach((transaction) => {
        validTagIds.forEach((tagId) => {
            if (!nextTransactionTags.some((item) => item.transactionId === transaction.id && item.tagId === tagId)) {
                nextTransactionTags.push({ transactionId: transaction.id, tagId });
            }
        });
    });

    const nextGroupsWithTotals = recalculateGroupTotals(nextGroups, nextTransactions);
    const syncedInvoices = syncCreditCardInvoices({
        creditCards: before.creditCards,
        transactionGroups: nextGroupsWithTotals,
        transactions: nextTransactions,
        existingInvoices: before.creditCardInvoices,
    });
    const resolvedGroup = nextGroupsWithTotals.find((item) => item.id === group.id) ?? group;
    const newLedgerEntries = createdTransactions
        .filter((transaction) => transaction.status === "paid")
        .flatMap((transaction) => createLedgerEntriesForPaidTransaction(transaction, resolvedGroup));
    const nextLedgerEntries = [...before.ledgerEntries, ...newLedgerEntries];
    const finalGroups = recalculateGroupTotals(nextGroupsWithTotals, syncedInvoices.transactions);

    const snapshot = {
        ...before,
        categories: [...nextCategories].sort(compareCategoriesByTypeParentSort),
        beneficiaries: [...nextBeneficiaries].sort(compareBySortOrderNameAndId),
        transactionGroups: finalGroups,
        transactions: syncedInvoices.transactions,
        creditCardInvoices: syncedInvoices.creditCardInvoices,
        ledgerEntries: nextLedgerEntries,
        transactionTags: nextTransactionTags,
    };
    if (!options.deferInvoiceMutationValidation) assertInvoiceMutation(before, snapshot);
    return createFinanceSnapshot(snapshot.wallets, snapshot.creditCards, snapshot.creditCardInvoices, snapshot.favoriteCreditCardId,
        snapshot.transactionGroups, snapshot.transactions, snapshot.ledgerEntries, snapshot.beneficiaries, snapshot.categories, snapshot.tags,
        snapshot.wishItems, snapshot.transactionTags, snapshot.planning);
}
