import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFinanceActions } from "../../context/FinanceContext";
import { ModalStructure } from "./ModalStructure";

export function AddWallet() {
    const [name, setName] = useState("");
    const [icon, setIcon] = useState("/assets/Nubank.png");
    const [startBalance, setStartBalance] = useState("");
    const [iconPreview, setIconPreview] = useState("/assets/Nubank.png");
    const { addWallet } = useFinanceActions();

    const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setIcon(result);
            setIconPreview(result);
        };
        reader.readAsDataURL(file);
    };

    const handleAddWallet = async () => {
        if (!name.trim() || !startBalance) {
            alert("Por favor, preencha o nome e o saldo inicial");
            return;
        }

        await addWallet({
            id: uuidv4(),
            name: name.trim(),
            icon,
            balance: Number(startBalance),
            startBalance: Number(startBalance),
        });

        setName("");
        setIcon("/assets/Nubank.png");
        setIconPreview("/assets/Nubank.png");
        setStartBalance("");

        alert("Carteira adicionada com sucesso!");
    };

    return (
        <ModalStructure height="auto" width="600px">
            <div className="bg-neutral-800 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold mb-6">Adicionar Nova Carteira</h2>
                <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
                    <div className="flex flex-col">
                        <label className="mb-2 font-medium">Nome da Carteira</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="p-2.5 rounded bg-neutral-700 border border-neutral-600 text-white placeholder-neutral-400"
                            placeholder="Ex: Carteira do Banco X"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="mb-2 font-medium">Icone da Carteira</label>
                        <div className="flex items-center gap-4">
                            <div className="text-6xl">
                                <img className="w-16" src={iconPreview} alt="" />
                            </div>
                            <input type="file" accept="image/*" onChange={handleIconUpload} className="p-2.5 rounded bg-neutral-700 border border-neutral-600 text-white flex-1" />
                        </div>
                        <p className="text-xs text-neutral-400 mt-2">Se nao enviar uma imagem, sera usado o icone padrao</p>
                    </div>

                    <div className="flex flex-col">
                        <label className="mb-2 font-medium">Saldo Inicial</label>
                        <input
                            type="number"
                            value={startBalance}
                            onChange={(e) => setStartBalance(e.target.value)}
                            className="p-2.5 rounded bg-neutral-700 border border-neutral-600 text-white placeholder-neutral-400"
                            placeholder="Ex: 1000.00"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <button type="button" onClick={handleAddWallet} className="mt-4 py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors">
                        Adicionar Carteira
                    </button>
                </form>
            </div>
        </ModalStructure>
    );
}
