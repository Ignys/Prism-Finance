import { AnimatePresence, motion } from "framer-motion";
import { FunnelPlus, Search, X } from "lucide-react";
import type { TransactionStatus } from "../../../context/FinanceContext";
import { INPUT_CLASS, SELECT_CLASS, STATUS_LABELS, STATUS_ORDER, type SelectOption, type TagOption } from "./transactionsPageShared";

interface TransactionsFiltersPanelProps {
    showAdvancedFilters: boolean;
    searchQuery: string;
    selectedCategoryKey: string;
    selectedBeneficiary: string;
    selectedStatus: "all" | TransactionStatus;
    selectedTagIds: string[];
    minAmount: string;
    maxAmount: string;
    categoryOptions: SelectOption[];
    beneficiaryOptions: string[];
    tagOptions: TagOption[];
    hasAdvancedFilters: boolean;
    onToggleAdvancedFilters: () => void;
    onClearAdvancedFilters: () => void;
    onSearchQueryChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onBeneficiaryChange: (value: string) => void;
    onStatusChange: (value: "all" | TransactionStatus) => void;
    onMinAmountChange: (value: string) => void;
    onMaxAmountChange: (value: string) => void;
    onTagToggle: (tagId: string) => void;
}

export function TransactionsFiltersPanel({
    showAdvancedFilters,
    searchQuery,
    selectedCategoryKey,
    selectedBeneficiary,
    selectedStatus,
    selectedTagIds,
    minAmount,
    maxAmount,
    categoryOptions,
    beneficiaryOptions,
    tagOptions,
    hasAdvancedFilters,
    onToggleAdvancedFilters,
    onClearAdvancedFilters,
    onSearchQueryChange,
    onCategoryChange,
    onBeneficiaryChange,
    onStatusChange,
    onMinAmountChange,
    onMaxAmountChange,
    onTagToggle,
}: TransactionsFiltersPanelProps) {
    return (
        <section className="">
            <div className="relative flex flex-col gap-1">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="w-full min-w-0">
                        <div className="relative w-full">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => onSearchQueryChange(event.target.value)}
                                placeholder="Buscar"
                                className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
                            />
                        </div>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 py-1.5 lg:w-auto lg:flex-nowrap">
                        <button
                            type="button"
                            onClick={onToggleAdvancedFilters}
                            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/75 transition-all hover:border-white/[0.2] hover:bg-white/[0.08] sm:flex-none"
                        >
                            <FunnelPlus size={14} />
                            {showAdvancedFilters ? "Ocultar" : "Mostrar"}
                        </button>
                        {hasAdvancedFilters && (
                            <button
                                type="button"
                                onClick={onClearAdvancedFilters}
                                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 truncate rounded-full border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/70 transition-all hover:border-white/[0.2] hover:bg-white/[0.08] sm:flex-none"
                            >
                                <X size={14} />
                                Limpar filtros
                            </button>
                        )}
                    </div>
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
                                    {tagOptions.length < 1 && <p className="text-sm text-white/45">Nenhuma tag vinculada as transações.</p>}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
