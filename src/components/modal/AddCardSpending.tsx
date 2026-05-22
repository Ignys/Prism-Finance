import { useState } from "react";
import { CardSpendingForm, type CardSpendingFormPrefill } from "../transactions/CardSpendingForm";
import { ModalStructure } from "./ModalStructure";

interface AddCardSpendingProps {
    prefill?: CardSpendingFormPrefill;
}

export function AddCardSpending({ prefill }: AddCardSpendingProps) {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [installmentPreviewOpen, setInstallmentPreviewOpen] = useState(false);

    return (
        <ModalStructure height="auto" width={advancedOpen ? "900px" : "600px"} closeOnEscape={!installmentPreviewOpen}>
            <CardSpendingForm prefill={prefill} onAdvancedOpenChange={setAdvancedOpen} onInstallmentPreviewOpenChange={setInstallmentPreviewOpen} />
        </ModalStructure>
    );
}
