import { format } from "date-fns";
import { DEFAULT_WALLET_ID, type Transaction, type Wallet } from "../../context/FinanceContext";
import { parseAppDate } from "../../lib/localDate";

export const REMOVED_WALLET: Wallet = {
    id: "removedWallet",
    name: "Carteira removida",
    icon: "/wallet.svg",
    type: "checking",
    balance: 0,
    initialBalance: 0,
    currency: "BRL",
    color: "#6B7280",
    isActive: false,
    includeInMainTotals: true,
    createdAt: new Date().toISOString(),
};

export function resolveTransactionWallet(wallets: Wallet[], walletId: string): Wallet {
    return wallets.find((item) => item.id === walletId) ?? REMOVED_WALLET;
}

export function formatTransactionDate(date: string, output = "dd/MM"): string {
    const parsedDate = parseAppDate(date);
    if (!parsedDate) {
        return output === "dd/MM/yyyy" ? "--/--/----" : "--/--";
    }
    return format(parsedDate, output);
}

export function formatCurrencyBRL(value: number): string {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isDefaultWallet(walletId: string): boolean {
    return walletId === DEFAULT_WALLET_ID;
}

export function getTransactionTypeMeta(type: Transaction["type"]): {
    label: string;
    amountColorClass: string;
    badgeClass: string;
} {
    if (type === "income") {
        return {
            label: "Entrada",
            amountColorClass: "text-emerald-400",
            badgeClass: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        };
    }

    if (type === "transfer") {
        return {
            label: "Transferencia",
            amountColorClass: "text-sky-300",
            badgeClass: "border-sky-400/25 bg-sky-500/10 text-sky-200",
        };
    }

    return {
        label: "Saida",
        amountColorClass: "text-red-400",
        badgeClass: "border-red-400/25 bg-red-500/10 text-red-200",
    };
}
