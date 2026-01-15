import { format } from "date-fns";
import { CircleUserRound, Pencil, Trash } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { Transaction, useFinance } from "../../context/FinanceContext";
import { EditTransaction } from "../modal/EditTransaction";

export function TransactionBlock({ transaction }: {transaction: Transaction}) {
    const { openModal } = useModal()
    const { deleteTransaction } = useFinance()

    return (
        <div className="bg-[#1e1e1e] rounded-2xl p-4 flex items-center justify-between">
            <img className="w-18 rounded-full" src={`${transaction.source.bank}.png`} alt="Logo do banco" />
            <div className="w-1/6 text-left">
                <h2 className="text-xl font-medium">{transaction.source.platform}</h2>
                <p className="text-lg">{transaction.description}</p>
                <p className="text-lg/1 flex items-center gap-1 text-neutral-300">
                    <CircleUserRound width={20} /> {transaction.beneficiary}
                </p>
            </div>
            <div className="w-45 text-right">
                <p className="text-xl font-medium">
                    <span className={transaction.type === "income" ? "text-green-400" : "text-[#c44b4b]"}>R${transaction.value.toFixed(2)}</span>
                </p>
                <p className="text-lg">{transaction.category.principal}</p>
                <p className="text-lg text-neutral-300">{format(new Date(transaction.date), "dd/MM/yyyy")}</p>
            </div>
            <div className="w-30 flex flex-col text-right gap-2">
                <p className="text-xl">{transaction.status}</p>
                <div className="flex justify-end gap-1">
                    <button onClick={() => openModal(<EditTransaction transaction={transaction}/>) } className="default-button p-2"><Pencil size={20} /></button>
                    <button onClick={() => deleteTransaction(transaction)} className="default-button p-2"><Trash size={20} /></button>
                </div>
            </div>
        </div>
    );
}
