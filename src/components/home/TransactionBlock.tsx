import { CircleUserRound, Pencil, Trash } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { type Transaction, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { WalletAvatar } from "../common/WalletAvatar";
import { EditTransaction } from "../modal/EditTransaction";
import { formatCurrencyBRL, formatTransactionDate, getTransactionTypeMeta, resolveTransactionWallet } from "../transactions/transactionView";

export function TransactionBlock({ transaction }: { transaction: Transaction }) {
    const { openModal } = useModal();
    const wallets = useFinanceWallets();
    const { deleteTransaction } = useFinanceActions();

    const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
    const typeMeta = getTransactionTypeMeta(transaction.type);

    return (
        <div className="bg-[#1e1e1e] rounded-2xl p-3 flex items-center justify-between">
            <WalletAvatar wallet={wallet} className="h-12 w-12 rounded-xl border border-white/[0.08]" iconSize={24} iconStrokeWidth={1.5} />
            <div className="w-2/6 text-left">
                <h2 className="text-xl font-medium">{wallet.name}</h2>
                <p className="text-lg">{transaction.description}</p>
                <p className="text-lg/1 flex items-center gap-1 text-neutral-300">
                    <CircleUserRound width={20} /> {transaction.beneficiary}
                </p>
            </div>
            <div className="w-45 text-right">
                <p className="text-xl font-medium">
                    <span className={typeMeta.amountColorClass}>R$ {formatCurrencyBRL(transaction.value)}</span>
                </p>
                <p className="text-lg">{transaction.category.label}</p>
                <p className="text-lg text-neutral-300">{formatTransactionDate(transaction.date, "dd/MM/yyyy")}</p>
            </div>
            <div className=" flex flex-col text-right gap-2">
                <p className="text-xl capitalize">{transaction.status}</p>
                <div className="flex justify-end gap-1">
                    <button onClick={() => openModal(<EditTransaction transaction={transaction} />)} className="default-button p-2">
                        <Pencil size={20} />
                    </button>
                    <button onClick={() => deleteTransaction(transaction)} className="default-button p-2">
                        <Trash size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
