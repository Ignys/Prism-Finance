import type { TransactionDraft } from "../../context/finance/domainTypes";

/** A duplicate is a new pending occurrence, independent of the source series and payment. */
export function duplicateTransactionDraft(draft: TransactionDraft): TransactionDraft {
    return {
        ...draft,
        id: undefined,
        groupId: undefined,
        status: "pending",
        transactionMode: "single",
        installmentCount: null,
        ignoredInstallmentsCount: null,
        recurrenceRule: null,
        recurrenceEndDate: null,
        invoiceId: null,
        commitment: undefined,
    };
}
