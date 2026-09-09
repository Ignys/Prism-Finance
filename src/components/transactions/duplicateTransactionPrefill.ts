import type { Transaction } from "../../context/FinanceContext";
import type { TransactionFormPrefill } from "./useTransactionForm";
import type { TransferFormPrefill } from "./useTransferForm";

export function buildDuplicateTransactionPrefill(transaction: Transaction): TransactionFormPrefill {
    return {
        initialAmount: transaction.value,
        initialCategoryId: transaction.category.id ?? undefined,
        initialDescription: transaction.description ?? "",
        initialWalletId: transaction.inWallet,
        initialBeneficiaryId: transaction.beneficiaryId,
        initialTagIds: transaction.tagIds,
        initialStatus: "pending",
    };
}

export function buildDuplicateTransferPrefill(transaction: Transaction): TransferFormPrefill {
    return {
        initialAmount: transaction.value,
        initialSourceWalletId: transaction.inWallet,
        initialDestinationWalletId: transaction.destinationWalletId,
        initialDescription: transaction.description ?? "",
        initialTagIds: transaction.tagIds,
        initialStatus: "pending",
    };
}
