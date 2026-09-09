import { parseDateOnlyToLocalDate } from "../../../lib/localDate";
import { normalizeTransactionStatus, normalizeWalletId, resolveTransactionBeneficiaryId, resolveTransactionCategoryId, resolveTransactionCreditCardId, resolveTransactionDestinationWalletId, resolveTransactionSourceWalletId, resolveTransactionTitle } from "../../financeTypes";
import type { FinanceSnapshot, StoredTransaction, TransactionDraft, TransactionGroup } from "../domainTypes";
import { resolveCategoryFields, roundToCents } from "./helpers";

export interface ResolvedDraft {
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

export interface StructuralChanges {
    amount: boolean;
    scheduledDate: boolean;
    status: boolean;
    sourceWalletId: boolean;
    destinationWalletId: boolean;
    creditCardId: boolean;
    invoiceId: boolean;
}

export function resolveDraft(snapshot: FinanceSnapshot, selected: StoredTransaction, group: TransactionGroup, draft: TransactionDraft): ResolvedDraft {
    const signedAmount = Number(draft.amount ?? draft.value ?? selected.amount);
    if (!Number.isFinite(signedAmount) || roundToCents(Math.abs(signedAmount)) < 0.01) throw new Error("Informe um valor de pelo menos R$ 0,01.");
    const amount = Number.isFinite(signedAmount) && signedAmount !== 0 ? roundToCents(Math.abs(signedAmount)) : selected.amount;
    const requestedDate = (draft.scheduledDate || draft.date || selected.scheduledDate).trim();
    if (!parseDateOnlyToLocalDate(requestedDate)) throw new Error("Data da transação inválida.");
    const scheduledDate = requestedDate;
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
    const dateOrCardChanged = scheduledDate !== selected.scheduledDate || creditCardId !== currentCreditCardId;
    // A previous automatic assignment is not an explicit override for a new date.
    const requestedInvoiceId = draft.invoiceId?.trim() || null;
    const invoiceId = dateOrCardChanged && (!requestedInvoiceId || requestedInvoiceId === selected.invoiceId)
        ? null
        : Object.prototype.hasOwnProperty.call(draft, "invoiceId") ? requestedInvoiceId : selected.invoiceId;
    const currentTagIds = snapshot.transactionTags.filter((link) => link.transactionId === selected.id).map((link) => link.tagId);
    const tagIds = Array.from(new Set(draft.tagIds ?? currentTagIds)).filter((tagId) => snapshot.tags.some((tag) => tag.id === tagId));

    return { amount, scheduledDate, status, title, notes, categoryId, beneficiaryId, sourceWalletId, destinationWalletId, creditCardId, invoiceId, tagIds };
}

export function buildPatchedMetadataGroup(snapshot: FinanceSnapshot, group: TransactionGroup, resolved: ResolvedDraft): TransactionGroup {
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

