import { format } from "date-fns";
import { Pencil, Trash, Wallet } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { DEFAULT_WALLET_ID, Transaction, useFinanceActions, useFinanceWallets, Wallet as FinanceWallet } from "../../context/FinanceContext";
import { EditTransaction } from "../modal/EditTransaction";

const REMOVED_WALLET: FinanceWallet = {
    id: "removedWallet",
    name: "Carteira Removida",
    icon: "/wallet.svg",
    balance: 0,
    startBalance: 0,
};

export function MiniTransactionBlock({ transaction }: { transaction: Transaction }) {
    const { openModal } = useModal();
    const wallets = useFinanceWallets();
    const { deleteTransaction } = useFinanceActions();

    const wallet = wallets.find((item) => item.id === transaction.inWallet) ?? REMOVED_WALLET;

    return (
        <div className="bg-[#1e1e1e] rounded-2xl p-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
                {wallet.id === DEFAULT_WALLET_ID ? <Wallet className="w-8 rounded-xl" size={32} strokeWidth={1.2} /> : <img src={wallet.icon} alt="Wallet Icon" className="w-8 rounded-xl" />}
                <h2 className=" font-medium">{transaction.category.principal}</h2>
            </div>
            <div className="flex gap-2 items-center">
                <div className="w-45 flex justify-end items-center gap-2">
                    <p className="text font-medium">
                        <span className={transaction.type === "income" ? "text-green-400" : "text-[#c44b4b]"}>R${transaction.value.toFixed(2)}</span>
                    </p>
                    <div className="w-1 h-1 bg-neutral-300 rounded-full"></div>
                    <p className="text-sm text-neutral-300">{format(new Date(transaction.date), "dd/MM")}</p>
                </div>
                <div className="w-1 h-1 bg-neutral-300 rounded-full"></div>
                <div className=" flex flex-col text-right gap-2">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => openModal(<EditTransaction transaction={transaction} />)} className="default-button p-1.5">
                            <Pencil size={16} />
                        </button>
                        <button onClick={() => deleteTransaction(transaction)} className="default-button p-1.5">
                            <Trash size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
