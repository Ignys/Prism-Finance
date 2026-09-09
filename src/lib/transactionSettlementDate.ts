import type { TransactionEntity } from "../context/finance/domainTypes";
import { parseAppDate } from "./localDate";

/** The read model currently exposes canonical paidAt as meta.atualizado_em. */
export function transactionSettlementDate(transaction: Pick<TransactionEntity, "status" | "date" | "meta" | "isNonCashSettlement">): Date | null {
    if (transaction.status !== "paid" || transaction.isNonCashSettlement) return null;
    const paidAt = transaction.meta.atualizado_em;
    return (paidAt ? parseAppDate(paidAt) : null) ?? parseAppDate(transaction.date);
}
