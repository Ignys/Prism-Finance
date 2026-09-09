import type { StoredTransaction, TransactionGroup } from "./domainTypes";

export function resolveTransactionTitle(transaction: Pick<StoredTransaction, "title">, group: Pick<TransactionGroup, "title"> | null | undefined): string {
    return transaction.title?.trim() || group?.title || "Transacao";
}

export function resolveTransactionCategoryId(
    transaction: Pick<StoredTransaction, "categoryId">,
    group: Pick<TransactionGroup, "categoryId"> | null | undefined,
): string | null {
    return transaction.categoryId ?? group?.categoryId ?? null;
}

export function resolveTransactionBeneficiaryId(
    transaction: Pick<StoredTransaction, "beneficiaryId">,
    group: Pick<TransactionGroup, "beneficiaryId"> | null | undefined,
): string | null {
    return transaction.beneficiaryId ?? group?.beneficiaryId ?? null;
}

export function resolveTransactionSourceWalletId(
    transaction: Pick<StoredTransaction, "sourceWalletId" | "routingOverride">,
    group: Pick<TransactionGroup, "sourceWalletId"> | null | undefined,
): string | null {
    return transaction.routingOverride ? transaction.sourceWalletId : transaction.sourceWalletId ?? group?.sourceWalletId ?? null;
}

export function resolveTransactionDestinationWalletId(
    transaction: Pick<StoredTransaction, "destinationWalletId" | "routingOverride">,
    group: Pick<TransactionGroup, "destinationWalletId"> | null | undefined,
): string | null {
    return transaction.routingOverride ? transaction.destinationWalletId : transaction.destinationWalletId ?? group?.destinationWalletId ?? null;
}

export function resolveTransactionCreditCardId(
    transaction: Pick<StoredTransaction, "creditCardId" | "routingOverride">,
    group: Pick<TransactionGroup, "creditCardId"> | null | undefined,
): string | null {
    return transaction.routingOverride ? transaction.creditCardId : transaction.creditCardId ?? group?.creditCardId ?? null;
}

