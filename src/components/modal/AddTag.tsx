import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFinanceActions } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";
import { useModal } from "../../context/ModalContext";

export function AddTag() {
    const [name, setName] = useState("");
    const [color, setColor] = useState("#64748B");
    const { addTag } = useFinanceActions();
    const { closeModal } = useModal();

    const handleSubmit = async () => {
        const normalizedName = name.trim().slice(0, 50);
        if (!normalizedName) {
            return;
        }

        await addTag({
            id: uuidv4(),
            userId: null,
            name: normalizedName,
            color: color.trim() || null,
            createdAt: new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="460px">
            <div className="bg-neutral-800 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold mb-5">Nova tag</h2>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="p-2.5 rounded bg-neutral-700 border border-neutral-600"
                        placeholder="Nome da tag"
                        maxLength={50}
                    />
                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded bg-neutral-700 border border-neutral-600 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className="flex-1 p-2.5 rounded bg-neutral-700 border border-neutral-600" placeholder="#64748B" />
                    </div>
                    <button type="button" onClick={handleSubmit} className="default-button py-2 px-4">
                        Criar tag
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
