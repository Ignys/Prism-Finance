import type { Transaction } from "../../context/FinanceContext";
import { useFinanceActions } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { EditTransaction } from "../modal/EditTransaction";
import { AddCardSpending } from "../modal/AddCardSpending";
import { AddTransactionModal } from "../modal/AddTransaction";
import { AddTransferModal } from "../modal/AddTransferModal";
import { buildDeleteTransactionImpactPreview, useDeleteTransactionImpactData } from "./deleteTransactionImpact";
import type { TransactionContextAction } from "./transactionContextActions";
import { buildDuplicateTransactionPrefill, buildDuplicateTransferPrefill } from "./duplicateTransactionPrefill";

function getTransactionDisplayLabel(transaction: Transaction): string {
    return transaction.description.trim() || transaction.category.label;
}

function getDeleteTitle(action: TransactionContextAction): string {
    if (action.scope === "all") {
        return "Excluir série?";
    }

    if (action.scope === "this_and_next") {
        return "Excluir esta e as próximas?";
    }

    return "Excluir transação?";
}

function getDeleteDescription(transaction: Transaction, action: TransactionContextAction): string {
    const label = getTransactionDisplayLabel(transaction);

    if (transaction.systemKind === "invoice_payment") {
        return `Essa ação remove "${label}" e reverte o pagamento vinculado na fatura.`;
    }

    if (action.scope === "all") {
        return `Essa ação encerra a série de "${label}" e remove as ocorrências futuras. O histórico pago ou consolidado é preservado.`;
    }

    if (action.scope === "this_and_next") {
        return `Essa ação encerra "${label}" a partir desta ocorrência. O histórico pago ou consolidado é preservado.`;
    }

    return `Essa ação remove "${label}" em definitivo.`;
}

function getStatusDescription(transaction: Transaction, action: TransactionContextAction): string {
    const label = getTransactionDisplayLabel(transaction);

    if (action.id === "pay_today") {
        return `Registra hoje o ${transaction.type === "income" ? "recebimento" : "pagamento"} de "${label}", preservando a data prevista.`;
    }

    if (action.nextStatus === "skipped") {
        return `Essa ação ignora "${label}" nos cálculos e atualiza os saldos ou faturas vinculadas.`;
    }

    if (action.nextStatus === "paid") {
        return `Essa ação marca "${label}" como paga e atualiza os saldos.`;
    }

    return `Essa ação volta "${label}" para pendente e remove o lançamento de saldo vinculado.`;
}

export function useTransactionContextActionHandler() {
    const { deleteTransactionWithScope, setTransactionStatus, markTransactionAsPaid, updateTransaction } = useFinanceActions();
    const { openModal } = useModal();
    const deleteImpactData = useDeleteTransactionImpactData();

    return (transaction: Transaction, action: TransactionContextAction) => {
        if (action.id === "open") {
            openModal(<EditTransaction transaction={transaction} />);
            return;
        }

        if (action.id === "duplicate") {
            if (transaction.paymentMethod === "credit_card") {
                openModal(<AddCardSpending prefill={{ initialCreditCardId: transaction.creditCardId ?? undefined, initialValues: transaction }} />);
                return;
            }
            if (transaction.type === "transfer") {
                openModal(<AddTransferModal prefill={buildDuplicateTransferPrefill(transaction)} />);
                return;
            }
            openModal(<AddTransactionModal type={transaction.type} prefill={buildDuplicateTransactionPrefill(transaction)} />);
            return;
        }

        if (action.id === "post_card") {
            openModal(<ConfirmActionModal title="Confirmar cobrança?" description="O valor passará a compor a fatura e o limite utilizado do cartão." confirmLabel="Confirmar cobrança" tone="success" onConfirm={() => updateTransaction({ transaction, draft: { commitment: "posted" }, scope: "single" })} />);
            return;
        }

        if (action.id === "pay_today") {
            openModal(
                <ConfirmActionModal
                    title={`${action.label}?`}
                    description={getStatusDescription(transaction, action)}
                    confirmLabel={action.label}
                    tone="success"
                    onConfirm={() => markTransactionAsPaid(transaction)}
                />,
            );
            return;
        }

        if ((action.id === "toggle_status" || action.id === "ignore") && action.nextStatus) {
            openModal(
                <ConfirmActionModal
                    title={`${action.label}?`}
                    description={getStatusDescription(transaction, action)}
                    confirmLabel={action.label}
                    tone="success"
                    onConfirm={() => setTransactionStatus(transaction, action.nextStatus!)}
                />,
            );
            return;
        }

        if (action.id === "delete_single" || action.id === "delete_this_and_next" || action.id === "delete_all") {
            const deleteImpactPreview = buildDeleteTransactionImpactPreview({
                transaction,
                scope: action.scope,
                storedTransactions: deleteImpactData.storedTransactions,
                transactionGroups: deleteImpactData.transactionGroups,
                wallets: deleteImpactData.wallets,
            });
            openModal(
                <ConfirmActionModal
                    title={getDeleteTitle(action)}
                    description={getDeleteDescription(transaction, action)}
                    consequences={deleteImpactPreview.consequences}
                    confirmLabel={action.label}
                    tone="danger"
                    onConfirm={() => deleteTransactionWithScope(transaction, action.scope)}
                />,
            );
        }
    };
}
