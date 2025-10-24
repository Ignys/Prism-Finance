import { CreateTransaction } from "../home/Form";
import { ModalStructure } from "./ModalStructure";

export function AddIncome() {
    return (
        <ModalStructure height="auto" width="600px">
                <CreateTransaction/>
        </ModalStructure>);
}
