import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "../../context/FinanceContext";

export function isTransactionEligibleForBulkEdit(transaction: Transaction): boolean {
    return transaction.systemKind !== "invoice_payment";
}

export function useTransactionBulkSelection(transactions: Transaction[]) {
    const eligibleTransactionIds = useMemo(() => transactions.filter(isTransactionEligibleForBulkEdit).map((transaction) => transaction.id), [transactions]);
    const eligibleTransactionIdSet = useMemo(() => new Set(eligibleTransactionIds), [eligibleTransactionIds]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedIds((current) => current.filter((id) => eligibleTransactionIdSet.has(id)));
    }, [eligibleTransactionIdSet]);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedCount = selectedIds.length;
    const eligibleCount = eligibleTransactionIds.length;
    const allVisibleSelected = eligibleCount > 0 && eligibleTransactionIds.every((id) => selectedIdSet.has(id));
    const someVisibleSelected = eligibleTransactionIds.some((id) => selectedIdSet.has(id));

    const toggleTransaction = (transactionId: string) => {
        if (!eligibleTransactionIdSet.has(transactionId)) {
            return;
        }

        setSelectedIds((current) => (current.includes(transactionId) ? current.filter((id) => id !== transactionId) : [...current, transactionId]));
    };

    const toggleAllVisible = () => {
        if (eligibleCount < 1) {
            return;
        }

        setSelectedIds((current) => {
            if (eligibleTransactionIds.every((id) => current.includes(id))) {
                return current.filter((id) => !eligibleTransactionIdSet.has(id));
            }

            return Array.from(new Set([...current, ...eligibleTransactionIds]));
        });
    };

    const clearSelection = () => {
        setSelectedIds([]);
    };

    return {
        selectedIds,
        selectedIdSet,
        selectedCount,
        eligibleCount,
        allVisibleSelected,
        someVisibleSelected,
        toggleTransaction,
        toggleAllVisible,
        clearSelection,
    };
}
