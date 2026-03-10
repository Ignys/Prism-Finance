import type { TransactionType } from "../../context/FinanceContext";
import { CreateTransaction } from "../home/Form";
import { ModalStructure } from "./ModalStructure";

interface AddTransactionModalProps {
    type: Extract<TransactionType, "income" | "spending">;
}

export function AddTransactionModal({ type }: AddTransactionModalProps) {
    return (
        <ModalStructure height="auto" width="600px">
            <CreateTransaction type={type} />
        </ModalStructure>
    );
}
