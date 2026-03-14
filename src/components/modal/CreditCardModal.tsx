import { type CreditCard } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";
import { AddCreditCard } from "./AddCreditCard";

interface CreditCardModalProps {
    mode?: "create" | "edit";
    creditCardId?: string;
    initialCreditCard?: CreditCard;
}

export function CreditCardModal({ mode = "create", creditCardId, initialCreditCard }: CreditCardModalProps) {
    return (
        <ModalStructure height="auto" width="620px">
            <AddCreditCard mode={mode} creditCardId={creditCardId} initialCreditCard={initialCreditCard} />
        </ModalStructure>
    );
}
