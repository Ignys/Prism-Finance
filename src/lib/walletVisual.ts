export const DEFAULT_WALLET_ICON = "/wallet.svg";
export const DEFAULT_CREDIT_CARD_ICON = "lucide:credit-card";
export const DEFAULT_WALLET_COLOR = "#3B82F6";

export function normalizeWalletIcon(value: string | null | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : DEFAULT_WALLET_ICON;
}

export function isDefaultWalletIcon(value: string | null | undefined): boolean {
    return normalizeWalletIcon(value) === DEFAULT_WALLET_ICON;
}

export function isDefaultCreditCardIcon(value: string | null | undefined): boolean {
    return normalizeWalletIcon(value) === DEFAULT_CREDIT_CARD_ICON;
}

export function normalizeWalletColor(value: string | null | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : DEFAULT_WALLET_COLOR;
}
