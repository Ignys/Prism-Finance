import { CardSpendingForm, type CardSpendingFormPrefill } from "../transactions/CardSpendingForm";
import { ModalStructure } from "./ModalStructure";

interface AddCardSpendingProps {
    prefill?: CardSpendingFormPrefill;
}

export function AddCardSpending({ prefill }: AddCardSpendingProps) {
    return (
        <ModalStructure height="auto" width="700px">
            <CardSpendingForm prefill={prefill} />
        </ModalStructure>
    );
}
