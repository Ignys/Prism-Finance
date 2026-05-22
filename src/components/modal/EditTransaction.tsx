import { useState } from "react";
import type { Transaction } from "../../context/FinanceContext";
import { CardSpendingForm } from "../transactions/CardSpendingForm";
import { TransactionForm } from "../transactions/TransactionForm";
import { ModalStructure } from "./ModalStructure";

interface EditTransactionProps {
    transaction: Transaction;
}

export function EditTransaction({ transaction }: EditTransactionProps) {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [installmentPreviewOpen, setInstallmentPreviewOpen] = useState(false);
    const isCreditCardSpending = transaction.type === "spending" && transaction.paymentMethod === "credit_card";
    const isInvoicePayment = transaction.systemKind === "invoice_payment";

    return (
        <ModalStructure height="auto" width={advancedOpen ? "900px" : "600px"} closeOnEscape={!installmentPreviewOpen}>
            {isCreditCardSpending ? (
                <CardSpendingForm transaction={transaction} onAdvancedOpenChange={setAdvancedOpen} onInstallmentPreviewOpenChange={setInstallmentPreviewOpen} />
            ) : (
                <TransactionForm transaction={transaction} mode={isInvoicePayment ? "invoice_payment_edit" : "default"} onAdvancedOpenChange={setAdvancedOpen} />
            )}
        </ModalStructure>
    );
}
