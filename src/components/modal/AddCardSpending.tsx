import { useState } from "react";
import { CardSpendingForm, type CardSpendingFormPrefill } from "../transactions/CardSpendingForm";
import { TransactionFormTabs, type TransactionFormTab } from "../transactions/TransactionFormTabs";
import { ModalStructure } from "./ModalStructure";

interface AddCardSpendingProps {
    prefill?: CardSpendingFormPrefill;
}

export function AddCardSpending({ prefill }: AddCardSpendingProps) {
    const [activeTab, setActiveTab] = useState<TransactionFormTab>("simple");
    const [installmentPreviewOpen, setInstallmentPreviewOpen] = useState(false);

    return (
        <ModalStructure
            height="650px"
            width="720px"
            topContent={<TransactionFormTabs activeTab={activeTab} onChange={setActiveTab} />}
            closeOnEscape={!installmentPreviewOpen}
        >
            <CardSpendingForm prefill={prefill} activeTab={activeTab} onInstallmentPreviewOpenChange={setInstallmentPreviewOpen} />
        </ModalStructure>
    );
}
