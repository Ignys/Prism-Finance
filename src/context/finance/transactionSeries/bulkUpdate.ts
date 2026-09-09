import type { FinanceSnapshot } from "../domainTypes";
import type { BulkUpdateTransactionsDraft } from "../contextTypes";
import { materializeOccurrence } from "../recurrence/materializeOccurrence";
import { applyTransactionStatus } from "../transactionStatus";
import { updateTransactionSeriesSnapshot } from "./updateTransactionSeriesSnapshot";

export function updateTransactionsBulkSnapshot(snapshot: FinanceSnapshot, draft: BulkUpdateTransactionsDraft, now = new Date().toISOString()): FinanceSnapshot {
    let next = snapshot;
    for (const id of new Set(draft.transactionIds)) {
        next = materializeOccurrence(next, id);
        const transaction = next.transactions.find((item) => item.id === id)!;
        if (transaction.paymentForInvoiceId) continue;
        const tagIds = [...new Set(next.transactionTags.filter((link) => link.transactionId === id).map((link) => link.tagId).concat(draft.tagIdsToAdd ?? []))];
        if (draft.status) next = applyTransactionStatus(next, id, draft.status, now);
        next = updateTransactionSeriesSnapshot({ snapshot: next, transactionId: id, scope: "single", now, draft: {
            categoryId: draft.categoryId, beneficiaryId: draft.beneficiaryId, tagIds,
        } }).snapshot;
    }
    return next;
}
