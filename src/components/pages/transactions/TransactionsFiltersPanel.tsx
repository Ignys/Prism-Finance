import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FunnelPlus, Search, X } from "lucide-react";
import type { TransactionStatus, Wallet } from "../../../context/FinanceContext";
import { INPUT_CLASS, SELECT_CLASS, STATUS_LABELS, STATUS_ORDER, type SelectOption, type TagOption } from "./transactionsPageShared";

function getCurrentMonthKey(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
}

function shiftMonth(monthKey: string, offset: number): string {
    const [yearPart, monthPart] = monthKey.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return getCurrentMonthKey();
    }

    const shifted = new Date(year, month - 1 + offset, 1);
    const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, "0");
    return `${shifted.getFullYear()}-${shiftedMonth}`;
}

interface MonthYearSelectorProps {
    selectedMonth: string;
    onMonthChange: (value: string) => void;
}

function MonthYearSelector({ selectedMonth, onMonthChange }: MonthYearSelectorProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-neutral-900 px-1 py-1">
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Mes anterior"
                title="Mes anterior"
            >
                <ChevronLeft size={16} />
            </button>
            <label htmlFor="transactions-month-selector" className="sr-only">
                Mes e ano
            </label>
            <input
                id="transactions-month-selector"
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                    if (event.target.value) {
                        onMonthChange(event.target.value);
                    }
                }}
                className="rounded-full border border-white/[0.08] bg-black/25 px-3 py-1.5 text-sm text-white outline-none transition-colors focus:border-white/[0.24] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
            />
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Proximo mes"
                title="Proximo mes"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}

interface TransactionsFiltersPanelProps {
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
}

export function TransactionsFiltersPanel({
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
}: TransactionsFiltersPanelProps) {
    return (
        <section className="pt-1 ">
            <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                        <h1 className="text-2xl font-semibold text-white">Transações</h1>
                    </div>
                    <MonthYearSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
                </div>
                <div className="flex justify-between gap-3">
                    <div className="w-full">
                        <div className="relative w-full">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => onSearchQueryChange(event.target.value)}
                                placeholder="Buscar por descrição, beneficiário, categoria, carteira ou tag"
                                className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-white/70 transition-all hover:border-white/[0.2] hover:bg-white/[0.08]"
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
