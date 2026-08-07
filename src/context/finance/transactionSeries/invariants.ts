import type { FinanceSnapshot, LedgerEntry, StoredTransaction } from "../../financeTypes";

export class TransactionSeriesInvariantError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TransactionSeriesInvariantError";
    }
}

function ledgerTotalsByWallet(entries: LedgerEntry[]): Map<string, number> {
    const totals = new Map<string, number>();
    entries.forEach((entry) => {
        totals.set(entry.walletId, Math.round(((totals.get(entry.walletId) ?? 0) + entry.amount) * 100) / 100);
    });
    return totals;
}

function assertSameWalletLedgerTotals(before: FinanceSnapshot, after: FinanceSnapshot): void {
    const beforeTotals = ledgerTotalsByWallet(before.ledgerEntries);
    const afterTotals = ledgerTotalsByWallet(after.ledgerEntries);
    const walletIds = new Set([...beforeTotals.keys(), ...afterTotals.keys()]);

    walletIds.forEach((walletId) => {
        if ((beforeTotals.get(walletId) ?? 0) !== (afterTotals.get(walletId) ?? 0)) {
            throw new TransactionSeriesInvariantError(`A soma do ledger da carteira ${walletId} foi alterada por uma edicao de metadados.`);
        }
    });
}

function assertPaidTransactionsPreserved(before: FinanceSnapshot, after: FinanceSnapshot, metadataOnly: boolean): void {
    const paidBefore = before.transactions.filter((transaction) => transaction.status === "paid");
    const afterById = new Map(after.transactions.map((transaction) => [transaction.id, transaction]));

    paidBefore.forEach((transaction) => {
        const nextTransaction = afterById.get(transaction.id);
        if (!nextTransaction || nextTransaction.status !== "paid") {
            throw new TransactionSeriesInvariantError(`A transacao paga ${transaction.id} foi removida ou deixou de estar paga.`);
        }

        if (metadataOnly) {
            const immutableFields: Array<keyof StoredTransaction> = ["amount", "scheduledDate", "paidAt", "createdAt", "invoiceId"];
            immutableFields.forEach((field) => {
                if (nextTransaction[field] !== transaction[field]) {
                    throw new TransactionSeriesInvariantError(`O campo historico ${field} da transacao paga ${transaction.id} foi alterado.`);
                }
            });
        }
    });

    if (after.transactions.filter((transaction) => transaction.status === "paid").length < paidBefore.length) {
        throw new TransactionSeriesInvariantError("A quantidade de transacoes pagas diminuiu durante a edicao da serie.");
    }
}

function assertUnrelatedLedgerPreserved(before: FinanceSnapshot, after: FinanceSnapshot, affectedTransactionIds: ReadonlySet<string>): void {
    const afterById = new Map(after.ledgerEntries.map((entry) => [entry.id, entry]));

    before.ledgerEntries.forEach((entry) => {
        if (entry.transactionId && affectedTransactionIds.has(entry.transactionId)) {
            return;
        }

        const nextEntry = afterById.get(entry.id);
        if (!nextEntry || JSON.stringify(nextEntry) !== JSON.stringify(entry)) {
            throw new TransactionSeriesInvariantError(`O lancamento nao afetado ${entry.id} foi removido ou alterado.`);
        }
    });
}

function assertNoDuplicateOccurrences(snapshot: FinanceSnapshot): void {
    const occurrenceKeys = new Set<string>();
    snapshot.transactions.forEach((transaction) => {
        const key = `${transaction.groupId}\u0000${transaction.scheduledDate}`;
        if (occurrenceKeys.has(key)) {
            throw new TransactionSeriesInvariantError(`Existem ocorrencias duplicadas no grupo ${transaction.groupId} em ${transaction.scheduledDate}.`);
        }
        occurrenceKeys.add(key);
    });
}

function assertLedgerReferencesExistingTransactions(snapshot: FinanceSnapshot): void {
    const transactionIds = new Set(snapshot.transactions.map((transaction) => transaction.id));
    snapshot.ledgerEntries.forEach((entry) => {
        if (entry.transactionId && !transactionIds.has(entry.transactionId)) {
            throw new TransactionSeriesInvariantError(`O lancamento ${entry.id} aponta para uma transacao inexistente.`);
        }
    });
}

export function validateTransactionSeriesUpdateInvariants(params: {
    before: FinanceSnapshot;
    after: FinanceSnapshot;
    affectedTransactionIds: ReadonlySet<string>;
    metadataOnly: boolean;
    preservePaidTransactions: boolean;
}): void {
    const { before, after, affectedTransactionIds, metadataOnly, preservePaidTransactions } = params;

    if (preservePaidTransactions || metadataOnly) {
        assertPaidTransactionsPreserved(before, after, metadataOnly);
    }
    if (metadataOnly) {
        assertSameWalletLedgerTotals(before, after);
    }

    assertUnrelatedLedgerPreserved(before, after, affectedTransactionIds);
    assertNoDuplicateOccurrences(after);
    assertLedgerReferencesExistingTransactions(after);
}
