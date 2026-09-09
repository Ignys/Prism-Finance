import type { TransactionDraft } from "../domainTypes";
import type { ResolvedDraft } from "../transactionSeries/draft";

/** Forms submit all fields. Only changed fields may replace sibling overrides. */
export function seriesChanges(before: ResolvedDraft, after: ResolvedDraft): TransactionDraft {
    const patch: TransactionDraft = {};
    if (before.amount !== after.amount) patch.amount = after.amount;
    if (before.scheduledDate !== after.scheduledDate) patch.scheduledDate = after.scheduledDate;
    if (before.title !== after.title) patch.description = after.title;
    if (before.notes !== after.notes) patch.notes = after.notes ?? "";
    if (before.categoryId !== after.categoryId) patch.categoryId = after.categoryId ?? undefined;
    if (before.beneficiaryId !== after.beneficiaryId) patch.beneficiaryId = after.beneficiaryId ?? undefined;
    if (before.sourceWalletId !== after.sourceWalletId) patch.walletId = after.sourceWalletId ?? undefined;
    if (before.destinationWalletId !== after.destinationWalletId) patch.destinationWalletId = after.destinationWalletId;
    if (before.creditCardId !== after.creditCardId) {
        patch.paymentMethod = after.creditCardId ? "credit_card" : "wallet";
        patch.creditCardId = after.creditCardId;
    }
    if (before.status !== after.status) patch.status = after.status;
    if ([...before.tagIds].sort().join("\u0000") !== [...after.tagIds].sort().join("\u0000")) patch.tagIds = after.tagIds;
    return patch;
}
