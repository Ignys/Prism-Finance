import { useState } from "react";
import { useFinance } from "../../context/FinanceContext";

export function CreateTransaction() {
    const [price, setPrice] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [checked, setChecked] = useState(false);
    const [bank, setBank] = useState("C6Bank");
    const [category, setCategory] = useState("");
    const [subCategory, setSubCategory] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [forWho, setForWho] = useState("");
    const { addTransaction } = useFinance();

    const handleSubmit = () => {
        const transaction = {
            id: `${date}-${name || "transacao"}-${Math.floor(Math.random() * 1000)}`,
            tipo: price >= 0 ? "receita" : "despesa",
            valor: {
                quantia: Math.abs(parseFloat(price)),
                moeda: "BRL",
            },
            data: date || new Date().toISOString().split("T")[0],
            fonte: {
                plataforma: name,
                origem: bank,
            },
            categoria: {
                principal: category,
                subcategoria: subCategory || null,
            },
            beneficiario: {
                para: forWho || "Eu",
            },
            descricao: description,
            status: checked ? "Efetuado" : "Pendente",
            meta: {
                criado_em: new Date().toISOString(),
                atualizado_em: null,
                observacoes: [],
            },
        };
        addTransaction(transaction);
    };

    return (
        <div className="p-10 bg-[#1e1e1e] rounded-2xl w-150">
            <div className="flex flex-col gap-5 my-5 *:p-2.5 *:bg-neutral-900 *:rounded-xl">
                <input type="number" placeholder="Preço (use negativo para despesa)" value={price} onChange={(e) => setPrice(e.target.value)} />
                <input type="text" placeholder="Nome (ex: Uber, iFood, Cliente X)" value={name} onChange={(e) => setName(e.target.value)} />
                <textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                <select value={bank} onChange={(e) => setBank(e.target.value)}>
                    <option value="Nubank">Nubank</option>
                    <option value="C6Bank">C6Bank</option>
                    <option value="Carteira">Carteira</option>
                </select>
                <input type="text" placeholder="Categoria (ex: Transporte, Alimentação)" value={category} onChange={(e) => setCategory(e.target.value)} />
                <input type="text" placeholder="Subcategoria (opcional)" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
                <input type="text" placeholder="Beneficiário (ex: Eu, Namorada)" value={forWho} onChange={(e) => setForWho(e.target.value)} />
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />

                <label className="flex items-center gap-2 p-2 bg-neutral-900">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    Pago / Recebido
                </label>
            </div>
            <button className="default-button" onClick={handleSubmit}>Submit</button>
        </div>
    );
}
