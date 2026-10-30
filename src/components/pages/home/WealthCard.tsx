import { useMemo, useState } from "react";
import { useFinanceWallets } from "../../../context/FinanceContext";
import { normalizeWalletColor } from "../../../lib/walletVisual";
import { WalletAvatar } from "../../common/WalletAvatar";
import { formatCurrencyBRL } from "../../transactions/transactionView";

export function WealthCard() {
    const allWallets = useFinanceWallets();
    const [activeId, setActiveId] = useState<string | null>(null);

    // Balances come from the server-computed wallet.balance; we only sum them.
    const wallets = useMemo(
        () => allWallets.filter((wallet) => wallet.isActive).sort((a, b) => b.balance - a.balance),
        [allWallets],
    );
    const total = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const positiveTotal = wallets.reduce((sum, wallet) => sum + Math.max(wallet.balance, 0), 0);

    if (wallets.length === 0) return null;

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-medium text-white">Patrimônio</p>
                    <p className="text-sm text-neutral-500">
                        Em {wallets.length} {wallets.length === 1 ? "carteira" : "carteiras"}
                    </p>
                </div>
                <p className={`text-2xl font-semibold leading-none tabular-nums ${total < 0 ? "text-rose-300" : "text-white"}`}>
                    {total < 0 && "− "}R$ {formatCurrencyBRL(Math.abs(total))}
                </p>
            </div>

            {positiveTotal > 0 && (
                <div className="mt-4 flex h-2.5 gap-[3px]" role="img" aria-label="Distribuição do patrimônio entre carteiras">
                    {wallets
                        .filter((wallet) => wallet.balance > 0)
                        .map((wallet) => (
                            <div
                                key={wallet.id}
                                className="min-w-[4px] rounded-full transition-opacity duration-200"
                                style={{
                                    flexGrow: wallet.balance,
                                    backgroundColor: normalizeWalletColor(wallet.color),
                                    opacity: activeId && activeId !== wallet.id ? 0.2 : 1,
                                }}
                            />
                        ))}
                </div>
            )}

            <ul className="mt-3 -mx-2" onMouseLeave={() => setActiveId(null)}>
                {wallets.map((wallet) => {
                    const share = positiveTotal > 0 && wallet.balance > 0 ? (wallet.balance / positiveTotal) * 100 : 0;
                    return (
                        <li
                            key={wallet.id}
                            onMouseEnter={() => setActiveId(wallet.id)}
                            className={`flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${activeId === wallet.id ? "bg-white/[0.04]" : ""}`}
                        >
                            <span className="shrink-0 rounded-lg border-2" style={{ borderColor: normalizeWalletColor(wallet.color) }}>
                                <WalletAvatar wallet={wallet} className="h-7 w-7 rounded-md" iconSize={15} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{wallet.name}</span>
                            {share > 0 && <span className="shrink-0 text-xs tabular-nums text-neutral-500">{share.toFixed(0)}%</span>}
                            <span className={`shrink-0 text-right text-sm font-medium tabular-nums ${wallet.balance < 0 ? "text-rose-300" : "text-white"}`}>
                                {wallet.balance < 0 && "− "}R$ {formatCurrencyBRL(Math.abs(wallet.balance))}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
