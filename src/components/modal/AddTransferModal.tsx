import type { TransferFormPrefill } from "../transactions/useTransferForm";
import { TransferForm } from "../transactions/TransferForm";
import { ModalStructure } from "./ModalStructure";

interface AddTransferModalProps {
    prefill?: TransferFormPrefill;
}

export function AddTransferModal({ prefill }: AddTransferModalProps) {
    return (
        <ModalStructure height="auto" width="600px">
            <TransferForm prefill={prefill} />
        </ModalStructure>
    );
}
