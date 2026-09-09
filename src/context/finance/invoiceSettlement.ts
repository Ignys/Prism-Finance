import {
    buildInvoicePaymentNote,
    calculateCreditCardInvoiceOpenAmount,
    DEFAULT_BENEFICIARY_NAME,
    normalizeCreditCardInvoice,
    normalizeStoredTransaction,
    normalizeTransactionGroup,
    parseInvoicePaymentNote,
    SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID,
    type Beneficiary,
    type Category,
    type CreditCardInvoice,
    type LedgerEntry,
    type StoredTransaction,
    type TransactionGroup,
} from "../financeTypes";
import { createId, findBeneficiaryByName, findCurrentUserSelfBeneficiary, roundToCents } from "./helpers";
import { getLocalTodayDate } from "../../lib/localDate";

interface BuildInvoiceSettlementParams {
    invoiceIds: string[];
    markAsPaid: boolean;
    userId: string | null;
    invoices: CreditCardInvoice[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    ledgerEntries: LedgerEntry[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    nowIso?: string;
}

export interface InvoiceSettlementResult {
    changed: boolean;
    invoices: CreditCardInvoice[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    ledgerEntries: LedgerEntry[];
}

function resolveInvoicePaymentCategory(categories: Category[]): Category | null {
    return (
        categories.find((category) => category.id === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID && category.type === "expense") ??
        categories.find((category) => category.type === "expense") ??
        null
    );
}

export function buildInvoiceSettlement(params: BuildInvoiceSettlementParams): InvoiceSettlementResult {
    const requestedInvoiceIds = new Set(params.invoiceIds.map((invoiceId) => invoiceId.trim()).filter(Boolean));
    const unchanged: InvoiceSettlementResult = {
        changed: false,
        invoices: params.invoices,
        transactionGroups: params.transactionGroups,
        transactions: params.transactions,
        ledgerEntries: params.ledgerEntries,
    };
    if (requestedInvoiceIds.size === 0) {
        return unchanged;
    }

    if (!params.markAsPaid) {
        const removedTransactionIds = new Set(
            params.transactions
                .filter((transaction) => {
                    const invoiceId = transaction.paymentForInvoiceId ?? parseInvoicePaymentNote(transaction.notes)?.invoiceId;
                    return invoiceId ? requestedInvoiceIds.has(invoiceId) : false;
                })
                .map((transaction) => transaction.id),
        );
        if (removedTransactionIds.size === 0) {
            return unchanged;
        }

        const transactions = params.transactions.filter((transaction) => !removedTransactionIds.has(transaction.id));
        const removedPaymentGroupIds = new Set(params.transactions.filter((transaction) => removedTransactionIds.has(transaction.id)).map((transaction) => transaction.groupId));
        const retainedGroupIds = new Set(transactions.map((transaction) => transaction.groupId));
        const nowIso = params.nowIso ?? new Date().toISOString();
        const cardIds = new Set(params.invoices.map((invoice) => invoice.creditCardId));

        return {
            changed: true,
            invoices: params.invoices.map((invoice) =>
                requestedInvoiceIds.has(invoice.id)
                    ? normalizeCreditCardInvoice(
                          { ...invoice, paidAmount: 0, status: "open", paidAt: null, updatedAt: nowIso },
                          cardIds,
                      )
                    : invoice,
            ),
            transactionGroups: params.transactionGroups.filter((group) => !removedPaymentGroupIds.has(group.id) || retainedGroupIds.has(group.id)),
            transactions,
            ledgerEntries: params.ledgerEntries.filter(
                (entry) => !entry.transactionId || !removedTransactionIds.has(entry.transactionId),
            ),
        };
    }

    const paymentCategory = resolveInvoicePaymentCategory(params.categories);
    if (!paymentCategory) {
        return unchanged;
    }

    const nowIso = params.nowIso ?? new Date().toISOString();
    const today = getLocalTodayDate(new Date(nowIso));
    const beneficiary =
        findCurrentUserSelfBeneficiary(params.beneficiaries, params.userId ?? undefined) ??
        findBeneficiaryByName(params.beneficiaries, DEFAULT_BENEFICIARY_NAME) ??
        params.beneficiaries[0] ??
        null;
    const categoryParent = paymentCategory.parentId
        ? params.categories.find((category) => category.id === paymentCategory.parentId) ?? null
        : null;
    const cardIds = new Set(params.invoices.map((invoice) => invoice.creditCardId));
    const newGroups: TransactionGroup[] = [];
    const newTransactions: StoredTransaction[] = [];
    const settledInvoiceIds = new Set<string>();

    params.invoices.forEach((invoice) => {
        if (!requestedInvoiceIds.has(invoice.id)) {
            return;
        }

        const openAmount = roundToCents(calculateCreditCardInvoiceOpenAmount(invoice));
        if (openAmount <= 0) {
            return;
        }

        const transactionId = createId("tx-invoice-settlement");
        const groupId = `group-${transactionId}`;
        const note = buildInvoicePaymentNote({ invoiceId: invoice.id, creditCardId: invoice.creditCardId });
        newGroups.push(
            normalizeTransactionGroup(
                {
                    id: groupId,
                    userId: params.userId,
                    beneficiaryId: beneficiary?.id ?? null,
                    beneficiaryName: beneficiary?.name ?? DEFAULT_BENEFICIARY_NAME,
                    categoryId: paymentCategory.id,
                    categoryName: categoryParent?.name ?? paymentCategory.name,
                    subcategoryName: categoryParent ? paymentCategory.name : null,
                    title: "Fechamento manual da fatura",
                    notes: note,
                    type: "expense",
                    transactionMode: "single",
                    totalAmount: openAmount,
                    installmentCount: null,
                    recurrenceRule: null,
                    recurrenceEndDate: null,
                    sourceWalletId: null,
                    destinationWalletId: null,
                    creditCardId: null,
                    createdAt: nowIso,
                },
                new Set(),
            ),
        );
        newTransactions.push(
            normalizeStoredTransaction({
                id: transactionId,
                groupId,
                installmentNumber: null,
                amount: openAmount,
                scheduledDate: today,
                status: "paid",
                paidAt: nowIso,
                invoiceId: null,
                paymentForInvoiceId: invoice.id,
                notes: note,
                createdAt: nowIso,
            }),
        );
        settledInvoiceIds.add(invoice.id);
    });

    if (settledInvoiceIds.size === 0) {
        return unchanged;
    }

    return {
        changed: true,
        invoices: params.invoices.map((invoice) =>
            settledInvoiceIds.has(invoice.id)
                ? normalizeCreditCardInvoice(
                      { ...invoice, paidAmount: invoice.totalAmount, status: "paid", paidAt: nowIso, updatedAt: nowIso },
                      cardIds,
                  )
                : invoice,
        ),
        transactionGroups: [...params.transactionGroups, ...newGroups],
        transactions: [...params.transactions, ...newTransactions],
        ledgerEntries: params.ledgerEntries,
    };
}
