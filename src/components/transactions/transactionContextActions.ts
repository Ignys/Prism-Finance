import type { Transaction, TransactionDraft, TransactionGroup, TransactionSeriesScope, TransactionStatus } from "../../context/FinanceContext";

export type TransactionContextActionId = "open" | "select" | "toggle_status" | "pay_today" | "ignore" | "duplicate" | "delete_single" | "delete_this_and_next" | "delete_all";

export interface TransactionContextAction {
    id: TransactionContextActionId;
    label: string;
    tone?: "default" | "danger";
    nextStatus?: TransactionStatus;
    scope?: TransactionSeriesScope;
}

interface BuildTransactionContextActionsParams {
    transaction: Transaction;
    group: TransactionGroup | undefined;
    isSelected?: boolean;
}

function isCreditCardSpending(transaction: Transaction): boolean {
    return transaction.type === "spending" && transaction.paymentMethod === "credit_card";
}

function isInvoicePayment(transaction: Transaction): boolean {
    return transaction.systemKind === "invoice_payment";
}

function getOpenLabel(transaction: Transaction): string {
    if (isCreditCardSpending(transaction)) {
        return "Abrir compra";
    }

    if (transaction.type === "transfer") {
        return "Abrir transferência";
    }

    return "Abrir transação";
}

function getPaidLabel(transaction: Transaction): string {
    if (transaction.type === "income") {
        return "Marcar como recebida";
    }

    if (transaction.type === "transfer") {
        return "Marcar como concluída";
    }

    return "Marcar como paga";
}

function canShowPayTodayAction(transaction: Transaction): boolean {
    return transaction.type === "spending" && transaction.status === "pending" && !isInvoicePayment(transaction) && !isCreditCardSpending(transaction);
}

function getIgnoreLabel(transaction: Transaction): string {
    if (isCreditCardSpending(transaction)) {
        return "Ignorar";
    }

    if (transaction.type === "income") {
        return "Ignorar";
    }

    if (transaction.type === "transfer") {
        return "Ignorar";
    }

    return "Ignorar";
}

function getDuplicateLabel(transaction: Transaction): string {
    if (isCreditCardSpending(transaction)) {
        return "Duplicar";
    }

    if (transaction.type === "income") {
        return "Duplicar";
    }

    if (transaction.type === "transfer") {
        return "Duplicar";
    }

    return "Duplicar";
}

function getSingleDeleteLabel(transaction: Transaction, group: TransactionGroup | undefined): string {
    if (group?.transactionMode === "installment") {
        return "Excluir essa parcela";
    }

    if (group?.transactionMode === "recurring") {
        return "Excluir apenas essa";
    }

    if (isCreditCardSpending(transaction)) {
        return "Excluir";
    }

    if (transaction.type === "transfer") {
        return "Excluir";
    }

    return "Excluir";
}

export function buildTransactionContextActions({ transaction, group, isSelected = false }: BuildTransactionContextActionsParams): TransactionContextAction[] {
    const actions: TransactionContextAction[] = [
        {
            id: "open",
            label: getOpenLabel(transaction),
        },
    ];

    if (!isInvoicePayment(transaction)) {
        actions.push({
            id: "select",
            label: isSelected ? "Desselecionar" : "Selecionar",
        });
    }

    if (canShowPayTodayAction(transaction)) {
        actions.push({
            id: "pay_today",
            label: "Pagar hoje",
            nextStatus: "paid",
        });
    }

    if (!isInvoicePayment(transaction) && transaction.status === "skipped") {
        actions.push({
            id: "toggle_status",
            label: isCreditCardSpending(transaction) ? "Voltar para fatura" : "Marcar como pendente",
            nextStatus: "pending",
        });
    } else if (!isInvoicePayment(transaction) && !isCreditCardSpending(transaction)) {
        actions.push({
            id: "toggle_status",
            label: transaction.status === "pending" ? getPaidLabel(transaction) : "Marcar como pendente",
            nextStatus: transaction.status === "pending" ? "paid" : "pending",
        });
    }

    if (!isInvoicePayment(transaction) && transaction.status !== "skipped") {
        actions.push({
            id: "ignore",
            label: getIgnoreLabel(transaction),
            nextStatus: "skipped",
        });
    }

    if (!isInvoicePayment(transaction)) {
        actions.push({
            id: "duplicate",
            label: getDuplicateLabel(transaction),
        });
    }

    actions.push({
        id: "delete_single",
        label: getSingleDeleteLabel(transaction, group),
        scope: "single",
        tone: "danger",
    });

    if (group?.transactionMode === "installment") {
        actions.push(
            {
                id: "delete_this_and_next",
                label: "Excluir próximas parcelas",
                scope: "this_and_next",
                tone: "danger",
            },
            {
                id: "delete_all",
                label: "Excluir todas as parcelas",
                scope: "all",
                tone: "danger",
            },
        );
    }

    if (group?.transactionMode === "recurring") {
        actions.push(
            {
                id: "delete_this_and_next",
                label: "Excluir essa e próximas",
                scope: "this_and_next",
                tone: "danger",
            },
            {
                id: "delete_all",
                label: "Excluir todas",
                scope: "all",
                tone: "danger",
            },
        );
    }

    return actions;
}

export function buildDuplicateTransactionDraft(transaction: Transaction): TransactionDraft {
    return {
        type: transaction.type,
        value: transaction.value,
        date: transaction.date,
        inWallet: transaction.inWallet,
        destinationWalletId: transaction.destinationWalletId,
        paymentMethod: transaction.paymentMethod,
        creditCardId: transaction.creditCardId,
        invoiceId: transaction.invoiceId,
        categoryId: transaction.category.id,
        beneficiaryId: transaction.beneficiaryId,
        tagIds: transaction.tagIds,
        description: transaction.description,
        status: transaction.status === "paid" || transaction.status === "pending" ? transaction.status : "pending",
        notes: transaction.description || undefined,
        transactionMode: "single",
        installmentCount: null,
        recurrenceRule: null,
        recurrenceEndDate: null,
    };
}
