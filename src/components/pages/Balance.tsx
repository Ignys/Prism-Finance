import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Pencil, Plus, Star } from "lucide-react";
import {
    useFinanceActions,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceFavoriteCreditCard,
    useFinanceFavoriteWallet,
    useFinanceSummary,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { WalletAvatar } from "../common/WalletAvatar";
import { AuthShell } from "../layout/AuthShell";
import { BalanceModal } from "../modal/BalanceModal";
import { CreditCardModal } from "../modal/CreditCardModal";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function BalancePage() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const summary = useFinanceSummary();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { setFavoriteWallet, setFavoriteCreditCard } = useFinanceActions();
    const { openModal } = useModal();
    const [showArchivedWallets, setShowArchivedWallets] = useState(false);
    const [showArchivedCreditCards, setShowArchivedCreditCards] = useState(false);
    const visibleWallets = useMemo(() => wallets.filter((wallet) => showArchivedWallets || wallet.isActive), [showArchivedWallets, wallets]);
    const visibleCreditCards = useMemo(() => creditCards.filter((card) => showArchivedCreditCards || card.isActive), [creditCards, showArchivedCreditCards]);
    const totalCreditLimit = creditCards.reduce((sum, card) => sum + card.limit, 0);
    const totalOpenInvoices = creditCardInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount), 0);

    const metrics = [
        { label: "Saldo total", value: currencyFormatter.format(summary.balance) },
        { label: "Limite total", value: currencyFormatter.format(totalCreditLimit) },
        { label: "Faturas abertas", value: currencyFormatter.format(totalOpenInvoices) },
    ];

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 pb-10 lg:flex-row lg:items-start">
                <section className="w-full lg:w-[80%]">
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

                        <div className="relative flex flex-wrap items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-lg font-medium text-white">Suas carteiras</p>
                            </div>

                            <div className="flex flex-row-reverse gap-1.5 items-center">
                                <button
                                    type="button"
                                    onClick={() => openModal(<BalanceModal mode="create" />)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-white/80 transition-all hover:border-white/[0.18] hover:bg-white/[0.08]"
                                >
                                    <Plus size={13} />
                                    Criar carteira
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowArchivedWallets((current) => !current)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.05em] text-white/80 transition-all hover:border-white/[0.18] hover:bg-white/[0.08]"
                                >
                                    {showArchivedWallets ? <EyeOff size={13} /> : <Eye size={13} />}
                                    {showArchivedWallets ? "Arquivadas" : "Arquivadas"}
                                </button>
                            </div>
                        </div>

                        <div className="relative mt-4 space-y-2">
                            {visibleWallets.length < 1 && <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/55">Nenhuma carteira para os filtros atuais.</p>}
                            {visibleWallets.map((wallet, index) => {
                                const isFavorite = wallet.id === favoriteWalletId;
                                

                                return (
                                    <motion.article
                                        key={wallet.id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.22, delay: index * 0.03, ease: "easeOut" }}
                                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                                            wallet.isActive ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.01] opacity-70"
                                        }`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <WalletAvatar wallet={wallet} className="h-14 w-14 rounded-xl border border-white/10" iconSize={30} iconStrokeWidth={1.7} />

                                            <div className="min-w-0 text-left">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-[15px] font-medium text-white">{wallet.name}</p>
                                                    {!wallet.isActive && (
                                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">
                                                            Arquivada
                                                        </span>
                                                    )}
                                                </div>
                                               
                                                <div className="flex gap-1 mt-1">
                                                    <p className="text-xs px-2.5 py-0.5 bg-neutral-200/5 text-white/45 border border-white/10 rounded-full">
                                                        Saldo inicial: {currencyFormatter.format(wallet.initialBalance)}
                                                    </p>
                                                    <p className="text-xs px-2.5 py-0.5 bg-neutral-200/5 text-white/45 border border-white/10 rounded-full">
                                                        Saldo atual: {currencyFormatter.format(wallet.balance)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openModal(<BalanceModal mode="edit" walletId={wallet.id} />)}
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-white/70 transition-all hover:border-white/[0.2] hover:text-white",
                                                ].join(" ")}
                                            >
                                                <Pencil size={14} />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (wallet.isActive) {
                                                        void setFavoriteWallet(wallet.id);
                                                    }
                                                }}
                                                disabled={!wallet.isActive}
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all",
                                                    isFavorite
                                                        ? "border-amber-200/35 bg-amber-300/10 text-amber-200"
                                                        : wallet.isActive
                                                          ? "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white"
                                                          : "border-white/[0.1] bg-white/[0.02] text-white/40",
                                                ].join(" ")}
                                            >
                                                <Star size={14} className={isFavorite ? "fill-amber-200 text-amber-200" : ""} />
                                                {isFavorite ? "Favorita" : "Marcar favorita"}
                                            </button>
                                        </div>
                                    </motion.article>
                                );
                            })}
                        </div>
                    </div>

                    <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                        <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-amber-500/12 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />

                        <div className="relative flex flex-wrap items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-lg font-medium text-white">Seus cartoes de credito</p>
                            </div>

                            <div className="flex flex-row-reverse gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => openModal(<CreditCardModal mode="create" />)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-white/80 transition-all hover:border-white/[0.18] hover:bg-white/[0.08]"
                                >
                                    <Plus size={13} />
                                    Criar cartao
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowArchivedCreditCards((current) => !current)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs  uppercase tracking-[0.05em] text-white/80 transition-all hover:border-white/[0.18] hover:bg-white/[0.08]"
                                >
                                    {showArchivedCreditCards ? <EyeOff size={13} /> : <Eye size={13} />}
                                    {showArchivedCreditCards ? " arquivados" : " arquivados"}
                                </button>
                            </div>
                        </div>

                        <div className="relative mt-4 space-y-2">
                            {visibleCreditCards.length < 1 && <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/55">Nenhum cartao para os filtros atuais.</p>}
                            {visibleCreditCards.map((creditCard, index) => {
                                const isFavorite = creditCard.id === favoriteCreditCardId;

                                return (
                                    <motion.article
                                        key={creditCard.id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.22, delay: index * 0.03, ease: "easeOut" }}
                                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                                            creditCard.isActive ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.01] opacity-70"
                                        }`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <WalletAvatar wallet={creditCard} className="h-14 w-14 rounded-xl border border-white/10" iconSize={30} iconStrokeWidth={1.7} />

                                            <div className="min-w-0 text-left">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-[15px] font-medium text-white">{creditCard.name}</p>
                                                    {!creditCard.isActive && (
                                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">
                                                            Arquivado
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 mt-1">
                                                    <p className="text-xs px-2.5 py-0.5 bg-neutral-200/5 text-white/45 border border-white/10 rounded-full">Limite: {currencyFormatter.format(creditCard.limit)}</p>
                                                    <p className="text-xs px-2.5 py-0.5 bg-neutral-200/5 text-white/45 border border-white/10 rounded-full">Fechamento: {creditCard.closingDay}</p>
                                                    <p className="text-xs px-2.5 py-0.5 bg-neutral-200/5 text-white/45 border border-white/10 rounded-full">Vencimento: {creditCard.dueDay}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openModal(<CreditCardModal mode="edit" creditCardId={creditCard.id} />)}
                                                className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
                                            >
                                                <Pencil size={14} />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (creditCard.isActive) {
                                                        void setFavoriteCreditCard(creditCard.id);
                                                    }
                                                }}
                                                disabled={!creditCard.isActive}
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all",
                                                    isFavorite
                                                        ? "border-amber-200/35 bg-amber-300/10 text-amber-200"
                                                        : creditCard.isActive
                                                          ? "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white"
                                                          : "border-white/[0.1] bg-white/[0.02] text-white/40",
                                                ].join(" ")}
                                            >
                                                <Star size={14} className={isFavorite ? "fill-amber-200 text-amber-200" : ""} />
                                                {isFavorite ? "Favorito" : "Marcar favorito"}
                                            </button>
                                        </div>
                                    </motion.article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <aside className="w-full space-y-2 lg:w-[30%]">
                    {metrics.map((metric, index) => (
                        <motion.div
                            key={metric.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: 0.05 + index * 0.04, ease: "easeOut" }}
                            className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]"
                        >
                            <p className="text-xs uppercase tracking-[0.2em] text-white/35">{metric.label}</p>
                            <p className="mt-1 text-lg font-medium text-white">{metric.value}</p>
                        </motion.div>
                    ))}
                </aside>
            </div>
        </AuthShell>
    );
}
