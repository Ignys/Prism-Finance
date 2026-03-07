import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { DEFAULT_WALLET_ID, TransactionType, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";

export function CreateTransaction({ type }: { type?: TransactionType }) {
    const wallets = useFinanceWallets();
    const { addTransaction } = useFinanceActions();

    const [price, setPrice] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [checked, setChecked] = useState(false);
    const [walletId, setWalletId] = useState(DEFAULT_WALLET_ID);
    const [category, setCategory] = useState("");
    const [subCategory, setSubCategory] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [forWho, setForWho] = useState("");

    useEffect(() => {
        const fallbackWalletId = wallets[wallets.length - 1]?.id ?? DEFAULT_WALLET_ID;
        if (!wallets.some((wallet) => wallet.id === walletId)) {
            setWalletId(fallbackWalletId);
        }
    }, [walletId, wallets]);

    const resolveType = (): TransactionType => {
        if (type) {
            return type;
        }
        return Number(price) < 0 ? "spending" : "income";
    };

    const handleSubmit = () => {
        const numericValue = Number(price);
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return;
        }

        addTransaction({
            id: `${date}-${name || "transacao"}-${Math.floor(Math.random() * 1000)}`,
            type: resolveType(),
            value: numericValue,
            date: date || new Date().toISOString().split("T")[0],
            inWallet: walletId,
            category: {
                principal: category,
                sub: subCategory || null,
            },
            beneficiary: forWho || "Eu",
            description,
            status: checked,
            meta: {
                criado_em: new Date().toISOString(),
                atualizado_em: null,
            },
        });
    };

    if (type === "income") {
        return (
            <div className=" p-8 bg-[#1e1e1e] rounded-2xl">
                <h1 className="text-2xl font-medium uppercase flex gap-2 items-center">
                    <TrendingUp size={32} className="p-1 rounded-2xl" strokeWidth={3} /> Nova receita
                </h1>
                <div className="flex flex-col gap-5 my-5 *:rounded-xl">
                    <div className="p-0 flex justify-between *:px-3 *:p-1.5 *:rounded-xl">
                        <input className="bg-neutral-900" type="number" placeholder="Preco" value={price} onChange={(e) => setPrice(e.target.value)} />
                        <label className="flex items-center gap-2 bg-neutral-900">
                            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                            Recebido
                        </label>
                    </div>
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Nome (ex: Uber, iFood, Cliente X)" value={name} onChange={(e) => setName(e.target.value)} />
                    <textarea className="min-h-20 max-h-40 bg-neutral-900 p-1.5 px-3" placeholder="Descricao" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <select className="bg-neutral-900 p-1.5 px-3" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                        {wallets
                            .slice()
                            .reverse()
                            .map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                    {wallet.name}
                                </option>
                            ))}
                    </select>
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Subcategoria (opcional)" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Beneficiario" value={forWho} onChange={(e) => setForWho(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <button className="default-button py-2 px-6" onClick={handleSubmit}>
                    Submit
                </button>
            </div>
        );
    }

    if (type === "spending") {
        return (
            <div className=" p-8 bg-[#1e1e1e] rounded-2xl">
                <h1 className="text-2xl font-medium uppercase flex gap-2 items-center">
                    <TrendingDown size={32} className="p-1 rounded-2xl" strokeWidth={3} /> Nova despesa
                </h1>
                <div className="flex flex-col gap-5 my-5 *:rounded-xl">
                    <div className="p-0 flex justify-between *:px-3 *:p-1.5 *:rounded-xl">
                        <input className="bg-neutral-900" type="number" placeholder="Preco" value={price} onChange={(e) => setPrice(e.target.value)} />
                        <label className="flex items-center gap-2 bg-neutral-900">
                            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                            Pago
                        </label>
                    </div>
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Nome (ex: Uber, iFood, Cliente X)" value={name} onChange={(e) => setName(e.target.value)} />
                    <textarea className="min-h-20 max-h-40 bg-neutral-900 p-1.5 px-3" placeholder="Descricao" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <select className="bg-neutral-900 p-1.5 px-3" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                        {wallets
                            .slice()
                            .reverse()
                            .map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                    {wallet.name}
                                </option>
                            ))}
                    </select>
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Subcategoria (opcional)" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="text" placeholder="Beneficiario" value={forWho} onChange={(e) => setForWho(e.target.value)} />
                    <input className="bg-neutral-900 p-1.5 px-3" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <button className="default-button py-2 px-6" onClick={handleSubmit}>
                    Submit
                </button>
            </div>
        );
    }

    return <></>;
}
