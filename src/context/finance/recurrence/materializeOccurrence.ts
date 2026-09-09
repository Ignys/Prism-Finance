import type { FinanceSnapshot } from "../domainTypes";
import { isOccurrenceInRule, occurrenceDate, projectOccurrences } from "./projectOccurrences";

/** Resolve against the current rule so a stale tab cannot resurrect an ended occurrence. */
export function materializeOccurrence(snapshot: FinanceSnapshot, transactionId: string): FinanceSnapshot {
    if (snapshot.transactions.some((transaction) => transaction.id === transactionId)) return snapshot;
    const match = /^occurrence-(.+)-(\d+)$/.exec(transactionId);
    if (!match) throw new Error("Transação não encontrada.");
    const groupId = decodeURIComponent(match[1]);
    const number = Number(match[2]);
    const group = snapshot.transactionGroups.find((item) => (item.recurrenceRule?.seriesId ?? item.id) === groupId && isOccurrenceInRule(item, number));
    if (!group?.recurrenceRule || !isOccurrenceInRule(group, number)) throw new Error("Esta ocorrência foi encerrada ou alterada. Atualize a lista.");
    const seriesGroupIds = new Set(snapshot.transactionGroups.filter((item) => (item.recurrenceRule?.seriesId ?? item.id) === groupId).map((item) => item.id));
    if (snapshot.transactions.some((item) => seriesGroupIds.has(item.groupId) && item.occurrenceNumber === number)) {
        throw new Error("Esta ocorrência já foi alterada em outro dispositivo. Atualize a lista.");
    }
    const date = occurrenceDate(group.recurrenceRule, number);
    const projection = projectOccurrences({
        groups: snapshot.transactionGroups, transactions: snapshot.transactions, transactionTags: [], creditCards: snapshot.creditCards,
        creditCardInvoices: snapshot.creditCardInvoices,
        period: { startDate: date, endDate: date },
    });
    const projected = projection.transactions.find((item) => item.id === transactionId);
    if (!projected) throw new Error("Ocorrência não encontrada.");
    const { isProjected: _isProjected, ...transaction } = projected;
    return {
        ...snapshot,
        transactions: snapshot.transactions.concat(transaction),
        transactionTags: snapshot.transactionTags.concat(projection.transactionTags.filter((link) => link.transactionId === transactionId)),
    };
}
