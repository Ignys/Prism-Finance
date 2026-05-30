import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, FunnelPlus, Plus, Search, X } from "lucide-react";
import type { TransactionStatus, Wallet } from "../../../context/FinanceContext";
import { StatementMonthSelector } from "../../common/StatementMonthSelector";
import { INPUT_CLASS, SELECT_CLASS, STATUS_LABELS, STATUS_ORDER, type SelectOption, type TagOption, type TransactionsTabKey } from "./transactionsPageShared";

interface TransactionsFiltersPanelProps {
    activeTab: TransactionsTabKey;
    selectedMonth: string;
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
    categoryOptions: SelectOption[];
    beneficiaryOptions: string[];
    tagOptions: TagOption[];
    wallets: Wallet[];
    hasAdvancedFilters: boolean;
    onTabChange: (tab: TransactionsTabKey) => void;
    onToggleAdvancedFilters: () => void;
    onClearAdvancedFilters: () => void;
    onMonthChange: (value: string) => void;
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
    onCreateFromActiveTab: () => void;
}

export function TransactionsFiltersPanel({
    activeTab,
    selectedMonth,
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
    categoryOptions,
    beneficiaryOptions,
    tagOptions,
    wallets,
    hasAdvancedFilters,
    onTabChange,
    onToggleAdvancedFilters,
    onClearAdvancedFilters,
    onMonthChange,
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
    onCreateFromActiveTab,
}: TransactionsFiltersPanelProps) {
    const canCreateTransaction = activeTab !== "transfer";
    const createLabel = activeTab === "income" ? "Adicionar receita" : "Adicionar despesa";
    const tabs = [
        { key: "income" as const, label: "Receitas", icon: ArrowUpRight },
        { key: "spending" as const, label: "Despesas", icon: ArrowDownRight },
        { key: "transfer" as const, label: "Transferências", icon: ArrowRightLeft },
    ];

    return (
        <section className="pt-1 ">
            <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                        <h1 className="text-2xl font-semibold text-white">Transações</h1>
                    </div>
                    <StatementMonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} ariaLabel="Selecionar mês e ano das transações" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const Icon = tab.icon;
                        const iconContainerClass =
                            tab.key === "income"
                                ? isActive
                                    ? "border-emerald-300/45 bg-emerald-500/18 text-emerald-100"
                                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300/85 group-hover:border-emerald-300/35 group-hover:bg-emerald-500/16 group-hover:text-emerald-200"
                                : tab.key === "spending"
                                  ? isActive
                                      ? "border-red-300/45 bg-red-500/18 text-red-100"
                                      : "border-red-400/20 bg-red-500/10 text-red-300/85 group-hover:border-red-300/35 group-hover:bg-red-500/16 group-hover:text-red-200"
                                  : isActive
                                    ? "border-neutral-300/45 text-neutral-50"
                                    : "border-white/[0.14] text-white/80 group-hover:border-white/[0.24] group-hover:text-white";

                        return (
                            <button
                                type="button"
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                aria-pressed={isActive}
                                className={`group inline-flex items-center gap-2 rounded-xl border pl-2 pr-3 py-2 text-left transition-all duration-200 ${
                                    isActive
                                        ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50"
                                        : "border-white/[0.09] bg-white/[0.02] text-white/80 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white"
                                }`}
                            >
                                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${iconContainerClass}`}>
                                    <Icon size={18} strokeWidth={2.2} />
                                </span>
                                <span className="text-sm">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex h-10 justify-between gap-3">
                    <div className="w-full">
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
                    <div className="flex py-1.5 gap-2">
                        <button
                            type="button"
                            onClick={onToggleAdvancedFilters}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/75 transition-all hover:border-white/[0.2] hover:bg-white/[0.08]"
                        >
                            <FunnelPlus size={14} />
                            {showAdvancedFilters ? "Ocultar" : "Mostrar"}
                        </button>
                        {hasAdvancedFilters && (
                            <button
                                type="button"
                                onClick={onClearAdvancedFilters}
                                className="inline-flex truncate cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/70 transition-all hover:border-white/[0.2] hover:bg-white/[0.08]"
                            >
                                <X size={14} />
                                Limpar filtros
                            </button>
                        )}
                        {canCreateTransaction && (
                            <button
                                type="button"
                                onClick={onCreateFromActiveTab}
                                className="inline-flex truncate cursor-pointer items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-emerald-100 transition-all hover:border-emerald-300/45 hover:bg-emerald-500/20"
                            >
                                <Plus size={14} />
                                {createLabel}
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
