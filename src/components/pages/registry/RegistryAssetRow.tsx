import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import type { Wallet } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { getRegistryItemEntranceDelay, REGISTRY_ENTRANCE_EASE, REGISTRY_ITEM_ANIMATE, REGISTRY_ITEM_INITIAL } from "./registryMotion";

interface RegistryAssetRowProps {
    asset: Pick<Wallet, "name" | "icon" | "color" | "isActive">;
    index: number;
    isFavorite: boolean;
    favoriteLabel: string;
    subtitle: ReactNode;
    valueLabel?: string;
    value: string;
    isValueNegative?: boolean;
    detail?: ReactNode;
    ariaLabel: string;
    onOpenContextMenu: (x: number, y: number) => void;
}

function resolveKeyboardMenuPosition(event: KeyboardEvent<HTMLElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
        x: Math.min(bounds.left + bounds.width / 2, window.innerWidth - 16),
        y: Math.min(bounds.top + 56, window.innerHeight - 16),
    };
}

export function RegistryAssetRow({ asset, index, isFavorite, favoriteLabel, subtitle, valueLabel, value, isValueNegative, detail, ariaLabel, onOpenContextMenu }: RegistryAssetRowProps) {
    const shouldReduceMotion = useReducedMotion();

    const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        onOpenContextMenu(event.clientX, event.clientY);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
            return;
        }

        event.preventDefault();
        const position = resolveKeyboardMenuPosition(event);
        onOpenContextMenu(position.x, position.y);
    };

    return (
        <motion.li
            initial={shouldReduceMotion ? false : REGISTRY_ITEM_INITIAL}
            animate={REGISTRY_ITEM_ANIMATE}
            transition={{ delay: shouldReduceMotion ? 0 : getRegistryItemEntranceDelay(index), duration: 0.5, ease: REGISTRY_ENTRANCE_EASE }}
        >
            <article
                tabIndex={0}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                aria-label={`${ariaLabel}. Use o botão direito para ver as ações.`}
                style={isFavorite ? { backgroundImage: `linear-gradient(100deg, ${asset.color}14, ${asset.color}0a 45%, transparent 85%)` } : undefined}
                className={`relative flex items-center gap-4 overflow-hidden outline-none transition-colors duration-150 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-white/35 ${
                    isFavorite ? "my-2 rounded-xl px-4 py-5" : "px-3 py-4"
                } ${asset.isActive ? "" : "opacity-55"}`}
            >
                {isFavorite ? <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ backgroundColor: asset.color }} /> : null}
                <div className="relative shrink-0 rounded-xl" style={isFavorite ? { boxShadow: `0 0 0 1px ${asset.color}80, 0 8px 24px -8px ${asset.color}66` } : undefined}>
                    <WalletAvatar
                        wallet={asset}
                        className={`shrink-0 rounded-xl border ${isFavorite ? "h-14 w-14 border-transparent" : "h-11 w-11 border-white/[0.12]"}`}
                        iconSize={isFavorite ? 28 : 22}
                        iconStrokeWidth={1.7}
                    />
                    {isFavorite ? (
                        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full ring-2 ring-[#16161a]" style={{ backgroundColor: asset.color }} aria-hidden="true">
                            <Star size={11} className="fill-white text-white" />
                        </span>
                    ) : null}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className={`flex items-center gap-2 truncate font-medium text-white ${isFavorite ? "text-lg" : "text-base"}`}>
                        <span className="truncate">{asset.name}</span>
                        {isFavorite ? <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white/90" style={{ backgroundColor: `${asset.color}33` }}>{favoriteLabel}</span> : null}
                    </h3>
                    <div className="mt-0.5 truncate text-xs text-white/45">{subtitle}</div>
                </div>
                <div className="shrink-0 text-right">
                    {valueLabel ? <p className="text-[11px] text-white/40">{valueLabel}</p> : null}
                    <p className={`${isFavorite ? "text-2xl" : "text-lg"} font-semibold tracking-[-0.02em] tabular-nums ${isValueNegative ? "text-rose-300" : "text-white"}`}>{value}</p>
                    {detail}
                </div>
            </article>
        </motion.li>
    );
}
