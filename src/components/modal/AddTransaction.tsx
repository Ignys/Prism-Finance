import { useState } from "react";
import type { TransactionType } from "../../context/FinanceContext";
import { TransactionForm, type TransactionFormPrefill } from "../transactions/TransactionForm";
import { TransactionFormTabs, type TransactionFormTab } from "../transactions/TransactionFormTabs";
import { ModalStructure } from "./ModalStructure";

interface AddTransactionModalProps {
    type: Extract<TransactionType, "income" | "spending">;
    prefill?: TransactionFormPrefill;
}

export function AddTransactionModal({ type, prefill }: AddTransactionModalProps) {
    const [activeTab, setActiveTab] = useState<TransactionFormTab>("simple");

    return (
        <ModalStructure
            height="650px"
            width="720px"
            topContent={<TransactionFormTabs activeTab={activeTab} onChange={setActiveTab} />}
        >
            <TransactionForm type={type} prefill={prefill} activeTab={activeTab} />
        </ModalStructure>
    );
}
