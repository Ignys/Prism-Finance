import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Check, CircleDashed, MoveRight, Pencil, Trash2, User, UserRound, Wallet as WalletIcon, X } from "lucide-react";
import type { Transaction, Wallet } from "../../../context/FinanceContext";
import { formatCurrencyBRL, formatTransactionDate, getTransactionTypeMeta, isDefaultWallet, resolveTransactionWallet } from "../../transactions/transactionView";
import { STATUS_BADGE_CLASS, STATUS_LABELS, getTransactionCategoryLabel } from "./transactionsPageShared";

interface TransactionsListPanelProps {
    transactions: Transaction[];
    wallets: Wallet[];
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
}

function getTransactionTypeIcon(type: Transaction["type"]) {
    if (type === "income") {
        return <ArrowUpRight size={12} />;
    }

    if (type === "transfer") {
        return <MoveRight size={12} />;
    }

    return <ArrowDownRight size={12} />;
}

function getTransactionStatusIcon(status: Transaction["status"]) {
    if (status === "pending") {
        return <CircleDashed size={12} />;
    }

    if (status === "paid") {
        return <Check size={12} />;
    }

    if (status === "cancelled") {
        return <X size={12} />;
    }

    if (status === "skipped") {
        return <X size={12} />;
    }
}

function TransactionCard({
    transaction,
    wallets,
    index,
    onEdit,
    onDelete,
}: {
    transaction: Transaction;
    wallets: Wallet[];
    index: number;
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
}) {
    const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
    const typeMeta = getTransactionTypeMeta(transaction.type);

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.02, ease: "easeOut" }}
            className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 last:mb-0"
        >
            <div className="flex min-w-0 flex-1 gap-3">
                {isDefaultWallet(wallet.id) ? (
                    <div className="flex h-15 w-15 items-center justify-center rounded-xl border border-white/10 bg-black/35">
                        <WalletIcon size={25} className="text-white/80" strokeWidth={1.6} />
                    </div>
                ) : (
                    <img src={wallet.icon} alt={wallet.name} className="h-15 w-15 rounded-xl border border-white/10 object-cover" />
                )}
                <div className="flex-1">
                    <div className="flex flex-col gap-1.5">
                        {/* HEADER */}
                        <section className="flex justify-between items-center w-full">
                            <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] border-neutral-500 text-neutral-300 bg-neutral-800 `}
                            >
                                <UserRound size={12} />
                                {transaction.beneficiary}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${STATUS_BADGE_CLASS[transaction.status]}`}>
                                {getTransactionStatusIcon(transaction.status)}
                                {STATUS_LABELS[transaction.status]}
                            </span>
                        </section>
                        {/* BODY */}
                        <div className="flex justify-between px-0.5 ">
                            {/* LEFT */}
                            <div className="flex flex-col items-start gap-px">
                                <p className="truncate text-[15px] font-semibold text-white">{transaction.description || "Sem descricao"}</p>
                                <p className="truncate text-sm text-white/55 ">{getTransactionCategoryLabel(transaction)}</p>
                            </div>

                            {/* RIGHT */}
                            <div className="flex flex-col items-end text-right">
                                <p className={`text-lg font-semibold ${typeMeta.amountColorClass}`}>R$ {formatCurrencyBRL(transaction.value)}</p>
                                <p className="text-xs uppercase tracking-[0.08em] text-white/45">{formatTransactionDate(transaction.date, "dd/MM/yyyy")}</p>
                            </div>
                        </div>
                        {/* TAGS */}
                        {transaction.tags.length > 0 && (
                            <div className="mt-1 flex justify-end gap-1">
                                {transaction.tags.map((tag) => (
                                    <span
                                        key={`${transaction.id}-${tag.id}`}
                                        className="rounded-full  px-3 py-0.5 text-[12px] border border-white/10 text-white/50"
                                        style={{ backgroundColor: `${tag.color ?? "#64748B"}2B` }}
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.article>
    );
}

export function TransactionsListPanel({ transactions, wallets, onEdit, onDelete }: TransactionsListPanelProps) {
    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-3 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            {transactions.length < 1 ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-8 text-center text-sm text-white/55">Nenhuma transacao encontrada para os filtros selecionados.</div>
            ) : (
                <AnimatePresence initial={false} mode="popLayout">
                    {transactions.map((transaction, index) => (
                        <TransactionCard key={transaction.id} transaction={transaction} wallets={wallets} index={index} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </AnimatePresence>
            )}
        </section>
    );
}
