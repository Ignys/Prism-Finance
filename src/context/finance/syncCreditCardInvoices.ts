import { buildCreditCardInvoiceId, parseCreditCardInvoiceId, resolveCreditCardInvoiceCycle, resolveCreditCardInvoiceCycleFromCycleKey, resolveCreditCardInvoiceStatus } from "./invoiceCycles";
import { resolveTransactionCreditCardId } from "./transactionResolution";
import type { CreditCard, CreditCardInvoice, StoredTransaction, TransactionGroup } from "./domainTypes";
import { roundToCents } from "./helpers";

export function syncCreditCardInvoices(params: {
    creditCards: CreditCard[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    existingInvoices: CreditCardInvoice[];
}): { transactions: StoredTransaction[]; creditCardInvoices: CreditCardInvoice[]; changed: boolean } {
    const { creditCards, transactionGroups, transactions, existingInvoices } = params;
    const nowIso = new Date().toISOString();
    const creditCardIds = new Set(creditCards.map((card) => card.id));
    const creditCardById = new Map(creditCards.map((card) => [card.id, card]));
    const groupsById = new Map(transactionGroups.map((group) => [group.id, group]));
    const existingInvoicesById = new Map(
        existingInvoices.filter((invoice) => creditCardIds.has(invoice.creditCardId)).map((invoice) => [invoice.id, invoice]),
    );

    let changed = existingInvoicesById.size !== existingInvoices.length;

    const invoiceMetaById = new Map<
        string,
        {
            creditCardId: string;
            cycleKey: string;
            closingDate: string;
            dueDate: string;
            createdAt: string;
        }
    >();
    existingInvoicesById.forEach((invoice) => invoiceMetaById.set(invoice.id, invoice));
    const invoiceTotalsById = new Map<string, number>();

    const nextTransactions = transactions.map((transaction) => {
        const group = groupsById.get(transaction.groupId);
        const creditCardId = resolveTransactionCreditCardId(transaction, group);

        if (!creditCardId || !creditCardIds.has(creditCardId)) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return {
                ...transaction,
                invoiceId: null,
            };
        }

        const card = creditCards.find((item) => item.id === creditCardId);
        if (!card) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return {
                ...transaction,
                invoiceId: null,
            };
        }

        const requestedInvoiceId = transaction.invoiceId?.trim() ?? "";
        const storedRequestedInvoice = existingInvoicesById.get(requestedInvoiceId);
        const parsedRequestedInvoice = storedRequestedInvoice?.creditCardId === card.id ? storedRequestedInvoice : requestedInvoiceId ? parseCreditCardInvoiceId(requestedInvoiceId) : null;
        const hasExplicitCycle = Boolean(parsedRequestedInvoice && parsedRequestedInvoice.creditCardId === card.id);
        const resolvedCycle =
            hasExplicitCycle && parsedRequestedInvoice
                ? resolveCreditCardInvoiceCycleFromCycleKey(parsedRequestedInvoice.cycleKey, card.closingDay, card.dueDay)
                : resolveCreditCardInvoiceCycle(transaction.scheduledDate, card.closingDay, card.dueDay);
        const matchingInvoice = existingInvoices.find((invoice) => invoice.creditCardId === card.id && invoice.cycleKey === resolvedCycle.cycleKey);
        const resolvedInvoiceId = hasExplicitCycle && requestedInvoiceId ? requestedInvoiceId : matchingInvoice?.id ?? buildCreditCardInvoiceId(card.id, resolvedCycle.cycleKey);
        const existingInvoice = existingInvoicesById.get(resolvedInvoiceId);
        const includeInInvoice = transaction.commitment !== "forecast" && transaction.status !== "cancelled" && transaction.status !== "skipped";

        invoiceMetaById.set(resolvedInvoiceId, {
            creditCardId: card.id,
            cycleKey: existingInvoice?.cycleKey ?? resolvedCycle.cycleKey,
            closingDate: existingInvoice?.closingDate ?? resolvedCycle.closingDate,
            dueDate: existingInvoice?.dueDate ?? resolvedCycle.dueDate,
            createdAt: existingInvoice?.createdAt ?? transaction.createdAt,
        });

        if (includeInInvoice) {
            invoiceTotalsById.set(resolvedInvoiceId, roundToCents((invoiceTotalsById.get(resolvedInvoiceId) ?? 0) + Math.abs(transaction.amount)));
        }

        if (transaction.invoiceId === resolvedInvoiceId) {
            return transaction;
        }

        changed = true;
        return {
            ...transaction,
            invoiceId: resolvedInvoiceId,
        };
    });

    const nextInvoices = Array.from(invoiceMetaById.entries())
        .map(([invoiceId, meta]) => {
            const existing = existingInvoicesById.get(invoiceId);
            const totalAmount = roundToCents(invoiceTotalsById.get(invoiceId) ?? 0);
            const paidAmount = roundToCents(Math.min(totalAmount, Math.max(0, existing?.paidAmount ?? 0)));
            const linkedCard = creditCardById.get(meta.creditCardId);
            const status =
                linkedCard
                    ? resolveCreditCardInvoiceStatus({
                          invoiceCycleKey: meta.cycleKey,
                          cardClosingDay: linkedCard.closingDay,
                          cardDueDay: linkedCard.dueDay,
                          totalAmount,
                          paidAmount,
                      })
                    : paidAmount >= totalAmount && totalAmount > 0
                      ? "paid"
                      : "open";
            const paidAt = status === "paid" ? existing?.paidAt ?? nowIso : null;

            const invoice: CreditCardInvoice = {
                id: invoiceId,
                creditCardId: meta.creditCardId,
                cycleKey: meta.cycleKey,
                closingDate: meta.closingDate,
                dueDate: meta.dueDate,
                totalAmount,
                paidAmount,
                status,
                paidAt,
                createdAt: existing?.createdAt ?? meta.createdAt,
                updatedAt: nowIso,
            };

            if (
                !existing ||
                existing.totalAmount !== invoice.totalAmount ||
                existing.paidAmount !== invoice.paidAmount ||
                existing.status !== invoice.status ||
                existing.creditCardId !== invoice.creditCardId ||
                existing.cycleKey !== invoice.cycleKey ||
                existing.closingDate !== invoice.closingDate ||
                existing.dueDate !== invoice.dueDate ||
                existing.paidAt !== invoice.paidAt
            ) {
                changed = true;
                return invoice;
            }
            return existing;
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

    if (nextInvoices.length !== existingInvoicesById.size) {
        changed = true;
    }

    return {
        transactions: nextTransactions,
        creditCardInvoices: nextInvoices,
        changed,
    };
}

