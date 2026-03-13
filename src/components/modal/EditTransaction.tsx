import type { Transaction } from "../../context/FinanceContext";
import { TransactionForm } from "../transactions/TransactionForm";
import { ModalStructure } from "./ModalStructure";

interface EditTransactionProps {
    transaction: Transaction;
}

export function EditTransaction({ transaction }: EditTransactionProps) {
    return (
        <ModalStructure height="auto" width="700px">
            <TransactionForm transaction={transaction} />
        </ModalStructure>
    );
}
