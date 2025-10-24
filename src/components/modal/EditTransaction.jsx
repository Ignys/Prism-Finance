import { ModalStructure } from "./ModalStructure";

export function EditTransaction({transaction}) {
    return (
        <ModalStructure height="500px" width="400px">
            <div className="bg-neutral-800 rounded-2xl p-10 drop-shadow-xl/20 h-full">
                Editar
                {JSON.stringify(transaction)}
            </div>
        </ModalStructure>);
}