import { ChevronRight, Star } from "lucide-react";
import type { ReactNode } from "react";
import { WalletAvatar } from "../../components/common/WalletAvatar";
import type { Wallet } from "../../context/FinanceContext";
import { LABEL_CLASS, Money } from "../MobileHeader";

type Asset = Pick<Wallet, "id" | "name" | "icon" | "color" | "isActive">;

export interface MobileAssetItem {
    asset: Asset;
    isFavorite: boolean;
    subtitle: ReactNode;
    value: number;
}

// Total plus a color bar of how it splits between the active assets.
export function MobileAssetTotal({ label, items }: { label: string; items: { id: string; color: string; value: number }[] }) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const positive = items.filter((item) => item.value > 0);
    if (items.length === 0) return null;

    return (
        <section className="px-1">
            <p className={LABEL_CLASS}>{label}</p>
            <Money value={total} className={`mt-1 block text-2xl leading-none tracking-[-0.03em] ${total < 0 ? "text-rose-300" : "text-white"}`} />
            {positive.length > 0 && (
                <div className="mt-4 flex h-1.5 gap-[3px]" aria-hidden="true">
                    {positive.map((item) => (
                        <span key={item.id} className="min-w-[4px] rounded-full" style={{ flexGrow: item.value, backgroundColor: item.color }} />
                    ))}
                </div>
            )}
        </section>
    );
}

export function MobileAssetList({ items, emptyMessage, onSelect }: { items: MobileAssetItem[]; emptyMessage: string; onSelect: (assetId: string) => void }) {
    if (items.length === 0) {
        return <p className="py-10 text-center text-sm text-neutral-500">{emptyMessage}</p>;
    }

    return (
        <ul className="divide-y divide-white/[0.06]">
            {items.map(({ asset, isFavorite, subtitle, value }) => (
                <li key={asset.id}>
                    <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => onSelect(asset.id)}
                        className={`flex w-full items-center gap-3 px-1 py-3 text-left outline-none active:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-sky-400/60 ${asset.isActive ? "" : "opacity-55"}`}
                    >
                        <span className="relative shrink-0">
                            <WalletAvatar wallet={asset} className="h-11 w-11 rounded-xl border border-white/[0.12]" iconSize={20} iconStrokeWidth={1.7} />
                            {isFavorite && (
                                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-[#0e0e10]" style={{ backgroundColor: asset.color }}>
                                    <Star size={9} className="fill-white text-white" />
                                </span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-white">{asset.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-neutral-500">{subtitle}</span>
                        </span>
                        <Money value={value} className={`text-sm ${value < 0 ? "text-rose-300" : "text-neutral-100"}`} />
                        <ChevronRight size={16} className="shrink-0 text-neutral-600" />
                    </button>
                </li>
            ))}
        </ul>
    );
}
