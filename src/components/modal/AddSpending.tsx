import { CreateTransaction } from "../home/Form";
import { ModalStructure } from "./ModalStructure";

export function AddSpending() {
    return (
        <ModalStructure height="auto" width="600px">
                <CreateTransaction type="spending"/>
        </ModalStructure>);
}
