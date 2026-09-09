import { createLedgerEntriesForPaidTransaction, resolveTransactionSourceWalletId, resolveTransactionDestinationWalletId, resolveTransactionCreditCardId, resolveTransactionTitle } from "../financeCore";
import type { FinanceSnapshot, StoredTransaction, TransactionGroup } from "../domainTypes";

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

export function updateLedger(params: {
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

