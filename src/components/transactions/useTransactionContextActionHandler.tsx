import type { Transaction } from "../../context/FinanceContext";
import { useFinanceActions } from "../../context/FinanceContext";
import { getTodayDate } from "../../context/finance/helpers";
import { useModal } from "../../context/ModalContext";
import { ConfirmActionModal } from "../modal/ConfirmActionModal";
import { EditTransaction } from "../modal/EditTransaction";
import { buildDeleteTransactionImpactPreview, useDeleteTransactionImpactData } from "./deleteTransactionImpact";
import { buildDuplicateTransactionDraft, type TransactionContextAction } from "./transactionContextActions";

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
        return `Essa ação remove toda a série de "${label}" em definitivo.`;
    }

    if (action.scope === "this_and_next") {
        return `Essa ação remove "${label}" e as próximas ocorrências da série.`;
    }

    return `Essa ação remove "${label}" em definitivo.`;
}

function getStatusDescription(transaction: Transaction, action: TransactionContextAction): string {
    const label = getTransactionDisplayLabel(transaction);

    if (action.id === "pay_today") {
        return `Essa ação marca "${label}" como paga e move a data da transação para hoje.`;
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
    const { addTransaction, deleteTransactionWithScope, setTransactionStatus, updateTransaction } = useFinanceActions();
    const { openModal } = useModal();
    const deleteImpactData = useDeleteTransactionImpactData();

    return (transaction: Transaction, action: TransactionContextAction) => {
        if (action.id === "open") {
            openModal(<EditTransaction transaction={transaction} />);
            return;
        }

        if (action.id === "duplicate") {
            void addTransaction(buildDuplicateTransactionDraft(transaction));
            return;
        }

        if (action.id === "pay_today") {
            const today = getTodayDate();
            openModal(
                <ConfirmActionModal
                    title={`${action.label}?`}
                    description={getStatusDescription(transaction, action)}
                    confirmLabel={action.label}
                    tone="success"
                    onConfirm={() =>
                        updateTransaction({
                            transaction,
                            draft: {
                                ...buildDuplicateTransactionDraft(transaction),
                                date: today,
                                scheduledDate: today,
                                status: "paid",
                            },
                        })
                    }
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
