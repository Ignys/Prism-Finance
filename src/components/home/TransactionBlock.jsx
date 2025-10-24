import { format } from "date-fns";
import { CircleUserRound, Pencil, Trash } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { useFinance } from "../../context/FinanceContext";

export function TransactionBlock({ transaction }) {
    const { openModal } = useModal()
    const { deleteTransaction } = useFinance()

    return (
        <div className="bg-[#1e1e1e] rounded-2xl p-4 flex items-center justify-between">
            <img className="w-18 rounded-full" src={`src/assets/${transaction.fonte.origem}.png`} alt="Logo do banco" />
            <div className="w-1/6 text-left">
                <h2 className="text-xl font-medium">{transaction.fonte.plataforma}</h2>
                <p className="text-lg">{transaction.descricao}</p>
                <p className="text-lg/1 flex items-center gap-1 text-neutral-300">
                    <CircleUserRound width={20} /> {transaction.beneficiario.para}
                </p>
            </div>
            <div className="w-45 text-right">
                <p className="text-xl font-medium">
                    <span className={transaction.tipo === "receita" ? "text-green-400" : "text-[#c44b4b]"}>R${transaction.valor.quantia.toFixed(2)}</span>
                </p>
                <p className="text-lg">{transaction.categoria.principal}</p>
                <p className="text-lg text-neutral-300">{format(new Date(transaction.data), "dd/MM/yyyy")}</p>
            </div>
            <div className="w-30 flex flex-col text-right gap-2">
                <p className="text-xl">{transaction.status}</p>
                <div className="flex justify-end gap-1">
                    <button onClick={() => openModal("editTransaction", transaction) } className="default-button p-2"><Pencil size={20} /></button>
                    <button onClick={() => deleteTransaction(transaction)} className="default-button p-2"><Trash size={20} /></button>
                </div>
            </div>
        </div>
    );
}
