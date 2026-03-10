import { TrendingDown, TrendingUp } from "lucide-react";
import type { TransactionType } from "../../context/FinanceContext";
import { useTransactionForm } from "./useTransactionForm";

export function TransactionForm({ type }: { type?: TransactionType }) {
    const form = useTransactionForm(type);

    if (form.resolvedType !== "income" && form.resolvedType !== "spending") {
        return null;
    }

    return (
        <div className="p-8 bg-[#1e1e1e] rounded-2xl text-white">
            <h1 className="text-2xl font-medium uppercase flex gap-2 items-center">
                {form.resolvedType === "income" ? <TrendingUp size={32} className="p-1 rounded-2xl" strokeWidth={3} /> : <TrendingDown size={32} className="p-1 rounded-2xl" strokeWidth={3} />}
                {form.resolvedType === "income" ? "Nova receita" : "Nova despesa"}
            </h1>

            <div className="flex flex-col gap-4 my-5">
                <div className="flex justify-between gap-3">
                    <input className="bg-neutral-900 p-2.5 rounded-xl flex-1" type="number" placeholder="Valor" value={form.price} onChange={(event) => form.setPrice(event.target.value)} />
                    <label className="flex items-center gap-2 bg-neutral-900 p-2.5 rounded-xl">
                        <input type="checkbox" checked={form.checked} onChange={(event) => form.setChecked(event.target.checked)} />
                        {form.resolvedType === "income" ? "Recebido" : "Pago"}
                    </label>
                </div>

                <input className="bg-neutral-900 p-2.5 rounded-xl" type="text" placeholder="Titulo (ex: Uber, Cliente X)" value={form.name} onChange={(event) => form.setName(event.target.value)} />
                <textarea className="min-h-20 max-h-40 bg-neutral-900 p-2.5 rounded-xl" placeholder="Descricao" value={form.description} onChange={(event) => form.setDescription(event.target.value)} />

                <select className="bg-neutral-900 p-2.5 rounded-xl" value={form.walletId} onChange={(event) => form.setWalletId(event.target.value)}>
                    {form.wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                            {wallet.name}
                        </option>
                    ))}
                </select>

                <select className="bg-neutral-900 p-2.5 rounded-xl" value={form.rootCategoryId} onChange={(event) => form.setRootCategoryId(event.target.value)}>
                    {form.rootCategories.length === 0 && <option value="">Sem categoria</option>}
                    {form.rootCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <select className="bg-neutral-900 p-2.5 rounded-xl" value={form.subCategoryId} onChange={(event) => form.setSubCategoryId(event.target.value)}>
                    <option value="">Sem subcategoria</option>
                    {form.subCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <select className="bg-neutral-900 p-2.5 rounded-xl" value={form.beneficiaryId} onChange={(event) => form.setBeneficiaryId(event.target.value)}>
                    {form.beneficiaries.length === 0 && <option value="">Sem beneficiario</option>}
                    {form.beneficiaries
                        .filter((item) => item.isActive)
                        .map((beneficiary) => (
                            <option key={beneficiary.id} value={beneficiary.id}>
                                {beneficiary.name}
                            </option>
                        ))}
                </select>

                <div className="bg-neutral-900 p-2.5 rounded-xl">
                    <p className="text-sm text-white/50 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                        {form.tags.map((tag) => {
                            const selected = form.selectedTagIds.includes(tag.id);
                            return (
                                <button
                                    type="button"
                                    key={tag.id}
                                    onClick={() => form.toggleTag(tag.id)}
                                    className={`px-2.5 py-1.5 rounded-full border text-sm ${selected ? "border-white/80 text-white" : "border-white/20 text-white/60"}`}
                                    style={{ backgroundColor: selected ? `${tag.color ?? "#64748B"}55` : `${tag.color ?? "#64748B"}22` }}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                        {form.tags.length === 0 && <p className="text-sm text-white/40">Nenhuma tag cadastrada.</p>}
                    </div>
                </div>

                <input className="bg-neutral-900 p-2.5 rounded-xl" type="date" required value={form.date} onChange={(event) => form.setDate(event.target.value)} />
            </div>

            <button className="default-button py-2 px-6" onClick={form.submit}>
                Criar transacao
            </button>
        </div>
    );
}
