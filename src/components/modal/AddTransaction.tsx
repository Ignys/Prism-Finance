import { useState } from "react";
import type { TransactionType } from "../../context/FinanceContext";
import { TransactionForm } from "../transactions/TransactionForm";
import { ModalStructure } from "./ModalStructure";

interface AddTransactionModalProps {
    type: Extract<TransactionType, "income" | "spending">;
}

export function AddTransactionModal({ type }: AddTransactionModalProps) {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <ModalStructure height="auto" width={advancedOpen ? "900px" : "600px"}>
            <TransactionForm type={type} onAdvancedOpenChange={setAdvancedOpen} />
        </ModalStructure>
    );
}
