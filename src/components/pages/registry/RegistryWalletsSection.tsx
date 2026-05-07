import { motion } from "framer-motion";
import { Pencil, Star, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinanceActions, useFinanceFavoriteWallet, useFinanceWallets } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { BalanceModal } from "../../modal/BalanceModal";
import { RegistrySectionActions } from "./RegistrySectionActions";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function RegistryWalletsSection() {
    const wallets = useFinanceWallets();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const { setFavoriteWallet } = useFinanceActions();
    const { openModal } = useModal();
    const [showArchivedWallets, setShowArchivedWallets] = useState(false);

    const visibleWallets = useMemo(() => wallets.filter((wallet) => showArchivedWallets || wallet.isActive), [showArchivedWallets, wallets]);
    const activeCount = wallets.filter((wallet) => wallet.isActive).length;
    const visibleCount = showArchivedWallets ? wallets.length : activeCount;

    return (
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Carteiras ({visibleCount})</p>
                </div>
                <RegistrySectionActions
                    isShowingInactive={showArchivedWallets}
                    showLabel="Mostrar arquivadas"
                    hideLabel="Ocultar arquivadas"
                    createLabel="Nova carteira"
                    onToggleInactive={() => setShowArchivedWallets((current) => !current)}
                    onCreate={() => openModal(<BalanceModal mode="create" />)}
                />
            </div>

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {visibleWallets.length < 1 ? (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhuma carteira para os filtros atuais.</div>
                ) : (
                    <div className="space-y-2">
                        {visibleWallets.map((wallet, index) => {
                            const isFavorite = wallet.id === favoriteWalletId;

                            return (
                                <motion.article
                                    key={wallet.id}
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, delay: index * 0.03, ease: "easeOut" }}
                                    className={`flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between ${
                                        wallet.isActive ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.01] opacity-70"
                                    }`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <WalletAvatar wallet={wallet} className="h-14 w-14 rounded-xl border border-white/10" iconSize={30} iconStrokeWidth={1.7} />

                                        <div className="min-w-0 text-left">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-[15px] font-medium text-white">{wallet.name}</p>
                                                {!wallet.isActive && (
                                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">
                                                        Arquivada
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <p className="rounded-full border border-white/10 bg-neutral-200/5 px-2.5 py-0.5 text-xs text-white/45">
                                                    Saldo inicial: {currencyFormatter.format(wallet.initialBalance)}
                                                </p>
                                                <p className="rounded-full border border-white/10 bg-neutral-200/5 px-2.5 py-0.5 text-xs text-white/45">
                                                    Saldo atual: {currencyFormatter.format(wallet.balance)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openModal(<BalanceModal mode="edit" walletId={wallet.id} />)}
                                            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
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
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all ${
                                                isFavorite
                                                    ? "border-amber-200/35 bg-amber-300/10 text-amber-200"
                                                    : wallet.isActive
                                                      ? "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white"
                                                      : "border-white/[0.1] bg-white/[0.02] text-white/40"
                                            }`}
                                        >
                                            <Star size={14} className={isFavorite ? "fill-amber-200 text-amber-200" : ""} />
                                            {isFavorite ? "Favorita" : "Marcar favorita"}
                                        </button>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
