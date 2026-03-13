import { Wallet as WalletIcon } from "lucide-react";
import type { Wallet } from "../../context/FinanceContext";
import { isDefaultWalletIcon, normalizeWalletColor, normalizeWalletIcon } from "../../lib/walletVisual";

interface WalletAvatarProps {
    wallet: Pick<Wallet, "icon" | "name" | "color">;
    className?: string;
    iconSize?: number;
    iconStrokeWidth?: number;
}

const BASE_CLASS = "inline-flex items-center justify-center overflow-hidden";

export function WalletAvatar({ wallet, className = "h-10 w-10 rounded-xl border border-white/10", iconSize = 18, iconStrokeWidth = 1.8 }: WalletAvatarProps) {
    const resolvedIcon = normalizeWalletIcon(wallet.icon);
    const resolvedColor = normalizeWalletColor(wallet.color);
    const mergedClassName = `${BASE_CLASS} ${className}`;

    if (isDefaultWalletIcon(resolvedIcon)) {
        return (
            <span className={mergedClassName} style={{ backgroundColor: resolvedColor }}>
                <WalletIcon size={iconSize} strokeWidth={iconStrokeWidth} className="text-white" aria-hidden="true" />
            </span>
        );
    }

    return <img src={resolvedIcon} alt={wallet.name} className={`${mergedClassName} object-cover`} />;
}
