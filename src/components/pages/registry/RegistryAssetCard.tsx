import type { KeyboardEvent, MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import type { Wallet } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { getRegistryItemEntranceDelay, REGISTRY_ENTRANCE_EASE, REGISTRY_ITEM_ANIMATE, REGISTRY_ITEM_INITIAL } from "./registryMotion";

export interface RegistryAssetMetric {
    label: string;
    value: string;
    emphasis?: boolean;
    wide?: boolean;
}

interface RegistryAssetCardProps {
    asset: Pick<Wallet, "name" | "icon" | "color">;
    assetTypeLabel: string;
    metrics: RegistryAssetMetric[];
    index: number;
    isActive: boolean;
    isFavorite: boolean;
    archivedLabel: string;
    onOpenContextMenu: (x: number, y: number) => void;
}

function resolveKeyboardMenuPosition(event: KeyboardEvent<HTMLElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
        x: Math.min(bounds.left + bounds.width / 2, window.innerWidth - 16),
        y: Math.min(bounds.top + 56, window.innerHeight - 16),
    };
}

export function RegistryAssetCard({ asset, assetTypeLabel, metrics, index, isActive, isFavorite, archivedLabel, onOpenContextMenu }: RegistryAssetCardProps) {
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
        <motion.div
            initial={shouldReduceMotion ? false : REGISTRY_ITEM_INITIAL}
            animate={REGISTRY_ITEM_ANIMATE}
            transition={{
                delay: shouldReduceMotion ? 0 : getRegistryItemEntranceDelay(index),
                duration: 0.5,
                ease: REGISTRY_ENTRANCE_EASE,
            }}
            className="h-full"
        >
        <article
            tabIndex={0}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            aria-label={`${asset.name}. Use o botão direito para ver as ações.`}
            className={`group relative flex h-full min-h-64 flex-col overflow-hidden rounded-2xl border p-4 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/35 ${
                isFavorite
                    ? "border-amber-300/30 bg-[linear-gradient(145deg,rgba(245,158,11,0.11),rgba(255,255,255,0.025)_55%)] shadow-[0_18px_45px_-28px_rgba(245,158,11,0.7)] hover:border-amber-200/45"
                    : isActive
                      ? "border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.05]"
                      : "border-white/[0.07] bg-white/[0.015] opacity-65 hover:opacity-85"
            }`}
        >
            <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ backgroundColor: asset.color }} aria-hidden="true" />

            <div className="flex items-start justify-between gap-3">
                <WalletAvatar
                    wallet={asset}
                    className={`h-[72px] w-[72px] rounded-2xl border shadow-lg ${isFavorite ? "border-amber-200/25" : "border-white/[0.12]"}`}
                    iconSize={38}
                    iconStrokeWidth={1.55}
                />

                <div className="flex flex-col items-end gap-1.5">
                    {isFavorite ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100">
                            <Star size={11} className="fill-amber-200 text-amber-200" />
                            Favorito
                        </span>
                    ) : null}
                    {!isActive ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">{archivedLabel}</span>
                    ) : null}
                </div>
            </div>

            <div className="mt-4 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/38">{assetTypeLabel}</p>
                <h3 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-white">{asset.name}</h3>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2">
                {metrics.map((metric) => (
                    <div
                        key={metric.label}
                        className={`rounded-xl border px-3 py-2.5 ${metric.wide ? "col-span-2" : ""} ${metric.emphasis ? "border-white/[0.12] bg-black/25" : "border-white/[0.07] bg-black/15"}`}
                    >
                        <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/38">{metric.label}</dt>
                        <dd className={`mt-1 truncate ${metric.emphasis ? "text-lg font-semibold text-white" : "text-sm font-medium text-white/78"}`}>{metric.value}</dd>
                    </div>
                ))}
            </dl>
        </article>
        </motion.div>
    );
}
