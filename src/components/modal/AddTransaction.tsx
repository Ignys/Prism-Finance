import { useState } from "react";
import type { TransactionType } from "../../context/FinanceContext";
import { TransactionForm, type TransactionFormPrefill } from "../transactions/TransactionForm";
import { ModalStructure } from "./ModalStructure";

interface AddTransactionModalProps {
    type: Extract<TransactionType, "income" | "spending">;
    prefill?: TransactionFormPrefill;
}

export function AddTransactionModal({ type, prefill }: AddTransactionModalProps) {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <ModalStructure height="auto" width={advancedOpen ? "1000px" : "700px"}>
            <TransactionForm type={type} prefill={prefill} onAdvancedOpenChange={setAdvancedOpen} />
        </ModalStructure>
    );
}
