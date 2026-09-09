import { ArrowDownRight, ArrowUpRight, MoveRight, UserRound } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import { type Transaction, useFinanceCreditCards, useFinanceWallets } from "../../../context/FinanceContext";
import { getTransactionCategoryDisplayLabel } from "../../../lib/transactionCategory";
import { transactionSettlementDate } from "../../../lib/transactionSettlementDate";
import { formatLocalDateInput } from "../../../lib/localDate";
import { WalletAvatar } from "../../common/WalletAvatar";
import { EditTransaction } from "../../modal/EditTransaction";
import { formatCurrencyBRL, formatTransactionDate, getTransactionTypeMeta, resolveTransactionWallet } from "../../transactions/transactionView";

export function MiniTransactionBlock({ transaction }: { transaction: Transaction }) {
    const { openModal } = useModal();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
    const creditCard = transaction.creditCardId ? creditCards.find((card) => card.id === transaction.creditCardId) : null;
    const paymentSource = transaction.paymentMethod === "credit_card" && creditCard ? creditCard : wallet;

    const typeMeta = getTransactionTypeMeta(transaction.type);
    const settlementDate = transactionSettlementDate(transaction);
    const displayDate = settlementDate ? formatLocalDateInput(settlementDate) : transaction.date;

    return (
        <button
            type="button"
            onClick={() => openModal(<EditTransaction transaction={transaction} />)}
            className="group w-full rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-left transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
            <div className="flex justify-between pl-1 pb-0.5">
                <div className="flex gap-1 items-center">
                    <span className="flex items-center gap-0.5 truncate text-[14px] text-neutral-400">
                        <UserRound className="rounded-full" size={15} />
                        {transaction.beneficiary}
                    </span>
                    <div className="size-0.5 bg-neutral-400 rounded-full"></div>
                    <span className="truncate text-[14px] text-neutral-400">{paymentSource.name}</span>
                </div>
                <div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${typeMeta.badgeClass}`}>
                        {transaction.type === "income" ? <ArrowUpRight size={12} /> : transaction.type === "transfer" ? <MoveRight size={12} /> : <ArrowDownRight size={12} />}
                        {typeMeta.label}
                    </span>
                </div>
            </div>
            <div className="flex w-full gap-2">
                <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30">
                        <WalletAvatar wallet={paymentSource} className="h-8 w-8 rounded-lg" iconSize={20} iconStrokeWidth={1.6} />
                    </div>
                </div>
                <div className="flex justify-between items-center w-full">
                    <div className="flex flex-col text-left truncate max-w-[70%]">
                        <p className="truncate text-sm font-semibold text-white">{transaction.description || "Sem descricao"}</p>
                        <p className="truncate text-xs text-neutral-400"> {getTransactionCategoryDisplayLabel(transaction.category)}</p>
                    </div>
                    <div className="flex flex-col text-right pr-1">
                        <span className={`text-sm font-semibold ${typeMeta.amountColorClass}`}>R$ {formatCurrencyBRL(transaction.value)}</span>
                        <span title="Data efetiva" className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">{formatTransactionDate(displayDate, "dd/MM")}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}
