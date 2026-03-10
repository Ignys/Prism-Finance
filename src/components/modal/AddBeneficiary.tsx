import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFinanceActions } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";
import { useModal } from "../../context/ModalContext";

const BENEFICIARY_TYPES = [
    { value: "person", label: "Pessoa" },
    { value: "cost_center", label: "Centro de custo" },
    { value: "pet", label: "Pet" },
    { value: "other", label: "Outro" },
] as const;

export function AddBeneficiary() {
    const [name, setName] = useState("");
    const [type, setType] = useState<(typeof BENEFICIARY_TYPES)[number]["value"]>("person");
    const [avatarColor, setAvatarColor] = useState("#4B5563");
    const { addBeneficiary } = useFinanceActions();
    const { closeModal } = useModal();

    const handleSubmit = async () => {
        const normalizedName = name.trim();
        if (!normalizedName) {
            return;
        }

        await addBeneficiary({
            id: uuidv4(),
            userId: null,
            name: normalizedName,
            type,
            avatarColor: avatarColor.trim() || null,
            isActive: true,
            createdAt: new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="520px">
            <div className="bg-neutral-800 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold mb-5">Novo beneficiario</h2>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="p-2.5 rounded bg-neutral-700 border border-neutral-600"
                        placeholder="Nome do beneficiario"
                    />
                    <select value={type} onChange={(event) => setType(event.target.value as (typeof BENEFICIARY_TYPES)[number]["value"])} className="p-2.5 rounded bg-neutral-700 border border-neutral-600">
                        {BENEFICIARY_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={avatarColor}
                            onChange={(event) => setAvatarColor(event.target.value)}
                            className="h-10 w-14 rounded bg-neutral-700 border border-neutral-600 p-1"
                        />
                        <input
                            type="text"
                            value={avatarColor}
                            onChange={(event) => setAvatarColor(event.target.value)}
                            className="flex-1 p-2.5 rounded bg-neutral-700 border border-neutral-600"
                            placeholder="#4B5563"
                        />
                    </div>
                    <button type="button" onClick={handleSubmit} className="default-button py-2 px-4">
                        Criar beneficiario
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
