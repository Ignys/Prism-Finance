import type { Transaction, TransactionDraft, TransactionGroup, TransactionSeriesScope, TransactionStatus } from "../../context/FinanceContext";

export type TransactionContextActionId = "open" | "select" | "toggle_status" | "ignore" | "duplicate" | "delete_single" | "delete_this_and_next" | "delete_all";

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

function getIgnoreLabel(transaction: Transaction): string {
    if (isCreditCardSpending(transaction)) {
        return "Ignorar na fatura";
    }

    if (transaction.type === "income") {
        return "Ignorar receita";
    }

    if (transaction.type === "transfer") {
        return "Ignorar transferência";
    }

    return "Ignorar despesa";
}

function getDuplicateLabel(transaction: Transaction): string {
    if (isCreditCardSpending(transaction)) {
        return "Duplicar compra";
    }

    if (transaction.type === "income") {
        return "Duplicar receita";
    }

    if (transaction.type === "transfer") {
        return "Duplicar transferência";
    }

    return "Duplicar despesa";
}

function getSingleDeleteLabel(transaction: Transaction, group: TransactionGroup | undefined): string {
    if (group?.transactionMode === "installment") {
        return "Excluir esta parcela";
    }

    if (group?.transactionMode === "recurring") {
        return "Excluir esta fixa";
    }

    if (isCreditCardSpending(transaction)) {
        return "Excluir compra";
    }

    if (transaction.type === "transfer") {
        return "Excluir transferência";
    }

    return "Excluir transação";
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
                label: "Excluir parcelamento",
                scope: "all",
                tone: "danger",
            },
        );
    }

    if (group?.transactionMode === "recurring") {
        actions.push(
            {
                id: "delete_this_and_next",
                label: "Excluir esta e futuras",
                scope: "this_and_next",
                tone: "danger",
            },
            {
                id: "delete_all",
                label: "Excluir série fixa",
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
