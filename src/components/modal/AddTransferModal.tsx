import { useState } from "react";
import type { TransferFormPrefill } from "../transactions/useTransferForm";
import { TransferForm } from "../transactions/TransferForm";
import { TransactionFormTabs, type TransactionFormTab } from "../transactions/TransactionFormTabs";
import { ModalStructure } from "./ModalStructure";

interface AddTransferModalProps {
    prefill?: TransferFormPrefill;
}

export function AddTransferModal({ prefill }: AddTransferModalProps) {
    const [activeTab, setActiveTab] = useState<TransactionFormTab>("simple");

    return (
        <ModalStructure
            height="650px"
            width="680px"
            topContent={<TransactionFormTabs activeTab={activeTab} onChange={setActiveTab} />}
        >
            <TransferForm prefill={prefill} activeTab={activeTab} />
        </ModalStructure>
    );
}
