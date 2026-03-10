import { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFinanceActions, useFinanceCategories } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";
import { useModal } from "../../context/ModalContext";

const CATEGORY_TYPES = [
    { value: "expense", label: "Despesa" },
    { value: "income", label: "Receita" },
] as const;

export function AddCategory() {
    const categories = useFinanceCategories();
    const { addCategory } = useFinanceActions();
    const { closeModal } = useModal();

    const [name, setName] = useState("");
    const [type, setType] = useState<(typeof CATEGORY_TYPES)[number]["value"]>("expense");
    const [parentId, setParentId] = useState<string>("");
    const [icon, setIcon] = useState("");
    const [color, setColor] = useState("#6B7280");

    const availableParents = useMemo(() => {
        return categories.filter((item) => item.type === type);
    }, [categories, type]);

    const handleSubmit = async () => {
        const normalizedName = name.trim();
        if (!normalizedName) {
            return;
        }

        await addCategory({
            id: uuidv4(),
            userId: null,
            parentId: parentId || null,
            name: normalizedName,
            type,
            icon: icon.trim() || null,
            color: color.trim() || null,
            isSystem: false,
            createdAt: new Date().toISOString(),
        });
        closeModal();
    };

    return (
        <ModalStructure height="auto" width="520px">
            <div className="bg-neutral-800 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold mb-5">Nova categoria</h2>
                <div className="flex flex-col gap-4">
                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} className="p-2.5 rounded bg-neutral-700 border border-neutral-600" placeholder="Nome da categoria" />

                    <select value={type} onChange={(event) => setType(event.target.value as (typeof CATEGORY_TYPES)[number]["value"])} className="p-2.5 rounded bg-neutral-700 border border-neutral-600">
                        {CATEGORY_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>

                    <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="p-2.5 rounded bg-neutral-700 border border-neutral-600">
                        <option value="">Sem categoria pai</option>
                        {availableParents.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>

                    <input type="text" value={icon} onChange={(event) => setIcon(event.target.value)} className="p-2.5 rounded bg-neutral-700 border border-neutral-600" placeholder="Icone (opcional)" />

                    <div className="flex items-center gap-3">
                        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 rounded bg-neutral-700 border border-neutral-600 p-1" />
                        <input type="text" value={color} onChange={(event) => setColor(event.target.value)} className="flex-1 p-2.5 rounded bg-neutral-700 border border-neutral-600" placeholder="#6B7280" />
                    </div>

                    <button type="button" onClick={handleSubmit} className="default-button py-2 px-4">
                        Criar categoria
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
