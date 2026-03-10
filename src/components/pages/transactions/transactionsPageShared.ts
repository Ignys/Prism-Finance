import type { Transaction, TransactionStatus } from "../../../context/FinanceContext";
import { normalizeComparisonText } from "../../../context/finance/helpers";

export type QuickTypeFilter = "all" | "income" | "spending";
export type SortMode = "date-desc" | "date-asc" | "value-desc" | "value-asc";

export interface SelectOption {
    value: string;
    label: string;
}

export interface TagOption {
    id: string;
    name: string;
    color: string | null;
}

export interface TransactionsSummary {
    count: number;
    income: number;
    spending: number;
    transfer: number;
    pending: number;
}

export interface TransactionsFilterState {
    quickFilter: QuickTypeFilter;
    sortMode: SortMode;
    showAdvancedFilters: boolean;
    searchQuery: string;
    selectedCategoryKey: string;
    selectedWalletId: string;
    selectedBeneficiary: string;
    selectedStatus: "all" | TransactionStatus;
    selectedTagIds: string[];
    dateFrom: string;
    dateTo: string;
    minAmount: string;
    maxAmount: string;
}

export const QUICK_FILTER_LABELS: Record<QuickTypeFilter, string> = {
    all: "Todas",
    income: "Receitas",
    spending: "Despesas",
};

export const QUICK_FILTER_ORDER: QuickTypeFilter[] = ["all", "income", "spending"];

export const STATUS_LABELS: Record<TransactionStatus, string> = {
    pending: "Pendente",
    paid: "Pago",
    cancelled: "Cancelada",
    skipped: "Ignorada",
};

export const STATUS_ORDER: TransactionStatus[] = ["pending", "paid", "cancelled", "skipped"];

export const STATUS_BADGE_CLASS: Record<TransactionStatus, string> = {
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    paid: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    cancelled: "border-red-400/30 bg-red-500/10 text-red-200",
    skipped: "border-slate-400/25 bg-slate-500/10 text-slate-200",
};

export const SELECT_CLASS = "w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/[0.24]";
export const INPUT_CLASS = "w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/[0.24]";

export const INITIAL_FILTER_STATE: TransactionsFilterState = {
    quickFilter: "all",
    sortMode: "date-desc",
    showAdvancedFilters: false,
    searchQuery: "",
    selectedCategoryKey: "all",
    selectedWalletId: "all",
    selectedBeneficiary: "all",
    selectedStatus: "all",
    selectedTagIds: [],
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
};

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function hasActiveAdvancedFilters(filters: TransactionsFilterState): boolean {
    return (
        Boolean(filters.searchQuery.trim()) ||
        filters.selectedCategoryKey !== "all" ||
        filters.selectedWalletId !== "all" ||
        filters.selectedBeneficiary !== "all" ||
        filters.selectedStatus !== "all" ||
        filters.selectedTagIds.length > 0 ||
        Boolean(filters.dateFrom) ||
        Boolean(filters.dateTo) ||
        Boolean(filters.minAmount.trim()) ||
        Boolean(filters.maxAmount.trim())
    );
}

export function parseNumberish(value: string): number | null {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.abs(parsed);
}

export function getTransactionCategoryKey(transaction: Transaction): string {
    if (transaction.categoryId) {
        return `id:${transaction.categoryId}`;
    }

    const principal = normalizeComparisonText(transaction.category.principal);
    const sub = transaction.category.sub ? normalizeComparisonText(transaction.category.sub) : "";
    return `name:${principal}::${sub}`;
}

export function getTransactionCategoryLabel(transaction: Transaction): string {
    if (transaction.category.sub) {
        return `${transaction.category.principal} / ${transaction.category.sub}`;
    }
    return transaction.category.principal;
}

export function getTransactionSearchSource(transaction: Transaction, walletName: string): string {
    return [
        transaction.description,
        transaction.beneficiary,
        transaction.category.principal,
        transaction.category.sub ?? "",
        walletName,
        ...transaction.tags.map((tag) => tag.name),
    ].join(" ");
}

export function compareTransactions(a: Transaction, b: Transaction, sortMode: SortMode): number {
    if (sortMode === "date-asc") {
        if (a.date === b.date) {
            return a.meta.criado_em.localeCompare(b.meta.criado_em);
        }
        return a.date.localeCompare(b.date);
    }

    if (sortMode === "date-desc") {
        if (a.date === b.date) {
            return b.meta.criado_em.localeCompare(a.meta.criado_em);
        }
        return b.date.localeCompare(a.date);
    }

    if (sortMode === "value-asc") {
        return a.value - b.value;
    }

    return b.value - a.value;
}
