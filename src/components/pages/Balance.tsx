import { motion } from "framer-motion";
import { Pencil, Plus, Star } from "lucide-react";
import { DEFAULT_WALLET_ID, useFinanceActions, useFinanceFavoriteWallet, useFinanceSummary, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { WalletAvatar } from "../common/WalletAvatar";
import { AuthShell } from "../layout/AuthShell";
import { BalanceModal } from "../modal/BalanceModal";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function BalancePage() {
    const wallets = useFinanceWallets();
    const summary = useFinanceSummary();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const { setFavoriteWallet } = useFinanceActions();
    const { openModal } = useModal();
    const favoriteWallet = wallets.find((wallet) => wallet.id === favoriteWalletId) ?? wallets[0] ?? null;

    const metrics = [
        { label: "Saldo total", value: currencyFormatter.format(summary.balance) },
        { label: "Favorita", value: favoriteWallet?.name ?? "Nenhuma" },
    ];

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 pb-10 lg:flex-row lg:items-start">
                <section className="w-full lg:w-[66%]">
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

                        <div className="relative flex flex-wrap items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-lg font-medium text-white">Suas carteiras</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => openModal(<BalanceModal mode="create" />)}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/80 transition-all hover:border-white/[0.18] hover:bg-white/[0.08]"
                            >
                                <Plus size={14} />
                                Criar carteira
                            </button>
                        </div>

                        <div className="relative mt-4 space-y-2">
                            {wallets.map((wallet, index) => {
                                const isFavorite = wallet.id === favoriteWalletId;
                                const isDefault = wallet.id === DEFAULT_WALLET_ID;

                                return (
                                    <motion.article
                                        key={wallet.id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.22, delay: index * 0.03, ease: "easeOut" }}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <WalletAvatar wallet={wallet} className="h-14 w-14 rounded-xl border border-white/10" iconSize={30} iconStrokeWidth={1.7} />

                                            <div className="min-w-0 text-left">
                                                <p className="truncate text-[15px] font-medium text-white">{wallet.name}</p>
                                                <p className="text-sm font-normal text-white/60 tracking-widest">{currencyFormatter.format(wallet.balance)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openModal(<BalanceModal mode="edit" walletId={wallet.id} />)}
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all",
                                                    isDefault
                                                        ? "border-sky-300/25 bg-sky-500/10 text-sky-200 hover:border-sky-300/40"
                                                        : "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white",
                                                ].join(" ")}
                                            >
                                                <Pencil size={14} />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void setFavoriteWallet(wallet.id)}
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all",
                                                    isFavorite
                                                        ? "border-amber-200/35 bg-amber-300/10 text-amber-200"
                                                        : "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white",
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
                </section>

                <aside className="w-full space-y-2 lg:w-[34%]">
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
