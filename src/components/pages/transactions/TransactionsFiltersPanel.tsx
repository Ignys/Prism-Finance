import { AnimatePresence, motion } from "framer-motion";
import { Filter, Search, X } from "lucide-react";
import type { TransactionStatus, Wallet } from "../../../context/FinanceContext";
import {
    INPUT_CLASS,
    QUICK_FILTER_LABELS,
    QUICK_FILTER_ORDER,
    SELECT_CLASS,
    STATUS_LABELS,
    STATUS_ORDER,
    type QuickTypeFilter,
    type SelectOption,
    type SortMode,
    type TagOption,
} from "./transactionsPageShared";

interface TransactionsFiltersPanelProps {
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
    quickFilterCounts: Record<QuickTypeFilter, number>;
    categoryOptions: SelectOption[];
    beneficiaryOptions: string[];
    tagOptions: TagOption[];
    wallets: Wallet[];
    hasAdvancedFilters: boolean;
    onToggleAdvancedFilters: () => void;
    onClearAdvancedFilters: () => void;
    onQuickFilterChange: (filter: QuickTypeFilter) => void;
    onSortModeChange: (sortMode: SortMode) => void;
    onSearchQueryChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onWalletChange: (value: string) => void;
    onBeneficiaryChange: (value: string) => void;
    onStatusChange: (value: "all" | TransactionStatus) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onMinAmountChange: (value: string) => void;
    onMaxAmountChange: (value: string) => void;
    onTagToggle: (tagId: string) => void;
}

export function TransactionsFiltersPanel({
    quickFilter,
    sortMode,
    showAdvancedFilters,
    searchQuery,
    selectedCategoryKey,
    selectedWalletId,
    selectedBeneficiary,
    selectedStatus,
    selectedTagIds,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    quickFilterCounts,
    categoryOptions,
    beneficiaryOptions,
    tagOptions,
    wallets,
    hasAdvancedFilters,
    onToggleAdvancedFilters,
    onClearAdvancedFilters,
    onQuickFilterChange,
    onSortModeChange,
    onSearchQueryChange,
    onCategoryChange,
    onWalletChange,
    onBeneficiaryChange,
    onStatusChange,
    onDateFromChange,
    onDateToChange,
    onMinAmountChange,
    onMaxAmountChange,
    onTagToggle,
}: TransactionsFiltersPanelProps) {
    return (
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className="pointer-events-none absolute -left-20 -top-20 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-left">
                        <p className="text-lg font-medium text-white">Transacoes</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onToggleAdvancedFilters}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/75 transition-all hover:border-white/[0.2] hover:bg-white/[0.08]"
                        >
                            <Filter size={14} />
                            {showAdvancedFilters ? "Ocultar avancados" : "Mostrar avancados"}
                        </button>

                        {hasAdvancedFilters && (
                            <button
                                type="button"
                                onClick={onClearAdvancedFilters}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/70 transition-all hover:border-white/[0.2] hover:bg-white/[0.08]"
                            >
                                <X size={14} />
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {QUICK_FILTER_ORDER.map((filterType) => {
                        const isActive = quickFilter === filterType;
                        return (
                            <button
                                key={filterType}
                                type="button"
                                onClick={() => onQuickFilterChange(filterType)}
                                className={[
                                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] transition-all",
                                    isActive ? "border-white/[0.24] bg-white/[0.11] text-white" : "border-white/[0.1] bg-white/[0.02] text-white/65 hover:border-white/[0.2] hover:text-white",
                                ].join(" ")}
                            >
                                {QUICK_FILTER_LABELS[filterType]}
                                <span className="rounded-full border border-white/[0.14] bg-black/25 px-2 py-0.5 text-[10px]">{quickFilterCounts[filterType]}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                    <label className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                            placeholder="Buscar por descricao, beneficiario, categoria, carteira ou tag"
                            className={`${INPUT_CLASS} pl-9`}
                        />
                    </label>

                    <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as SortMode)} className={SELECT_CLASS}>
                        <option value="date-desc">Mais recentes</option>
                        <option value="date-asc">Mais antigas</option>
                        <option value="value-desc">Maior valor</option>
                        <option value="value-asc">Menor valor</option>
                    </select>
                </div>

                <AnimatePresence initial={false}>
                    {showAdvancedFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                        >
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Categoria</span>
                                    <select value={selectedCategoryKey} onChange={(event) => onCategoryChange(event.target.value)} className={SELECT_CLASS}>
                                        <option value="all">Todas</option>
                                        {categoryOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Carteira</span>
                                    <select value={selectedWalletId} onChange={(event) => onWalletChange(event.target.value)} className={SELECT_CLASS}>
                                        <option value="all">Todas</option>
                                        {wallets.map((wallet) => (
                                            <option key={wallet.id} value={wallet.id}>
                                                {wallet.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Beneficiario</span>
                                    <select value={selectedBeneficiary} onChange={(event) => onBeneficiaryChange(event.target.value)} className={SELECT_CLASS}>
                                        <option value="all">Todos</option>
                                        {beneficiaryOptions.map((beneficiary) => (
                                            <option key={beneficiary} value={beneficiary}>
                                                {beneficiary}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Status</span>
                                    <select value={selectedStatus} onChange={(event) => onStatusChange(event.target.value as "all" | TransactionStatus)} className={SELECT_CLASS}>
                                        <option value="all">Todos</option>
                                        {STATUS_ORDER.map((status) => (
                                            <option key={status} value={status}>
                                                {STATUS_LABELS[status]}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Data inicial</span>
                                    <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className={INPUT_CLASS} />
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Data final</span>
                                    <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className={INPUT_CLASS} />
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Valor minimo</span>
                                    <input type="text" inputMode="decimal" value={minAmount} onChange={(event) => onMinAmountChange(event.target.value)} placeholder="0,00" className={INPUT_CLASS} />
                                </label>

                                <label>
                                    <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Valor maximo</span>
                                    <input type="text" inputMode="decimal" value={maxAmount} onChange={(event) => onMaxAmountChange(event.target.value)} placeholder="0,00" className={INPUT_CLASS} />
                                </label>
                            </div>

                            <div className="mt-3">
                                <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-white/45">Tags (qualquer uma)</span>
                                <div className="flex flex-wrap gap-2">
                                    {tagOptions.map((tag) => {
                                        const selected = selectedTagIds.includes(tag.id);
                                        return (
                                            <button
                                                type="button"
                                                key={tag.id}
                                                onClick={() => onTagToggle(tag.id)}
                                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                                    selected ? "border-white/35 text-white" : "border-white/12 text-white/65 hover:border-white/25 hover:text-white"
                                                }`}
                                                style={{ backgroundColor: selected ? `${tag.color ?? "#64748B"}4D` : `${tag.color ?? "#64748B"}26` }}
                                            >
                                                {tag.name}
                                            </button>
                                        );
                                    })}
                                    {tagOptions.length < 1 && <p className="text-sm text-white/45">Nenhuma tag vinculada as transacoes.</p>}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
