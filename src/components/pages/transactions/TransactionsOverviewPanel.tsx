import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, CalendarRange } from "lucide-react";
import type { Wallet } from "../../../context/FinanceContext";
import { AnchoredOverlay } from "../../transactions/AnchoredOverlay";
import { MonthPickerControl } from "../../common/MonthPickerControl";
import { WalletAvatar } from "../../common/WalletAvatar";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import type { ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";
import {
    currencyFormatter,
    formatMonthLabel,
    INPUT_CLASS,
    shiftMonth,
    type TransactionsDateMode,
    type TransactionsSummary,
    type TransactionsTabKey,
} from "./transactionsPageShared";

interface TransactionsOverviewPanelProps {
    wallets: Wallet[];
    selectedWalletIds: string[];
    onWalletIdsChange: (walletIds: string[]) => void;
    activeTab: TransactionsTabKey;
    onTypeSelect: (type: TransactionsTabKey) => void;
    dateMode: TransactionsDateMode;
    onDateModeChange: (mode: TransactionsDateMode) => void;
    selectedMonth: string;
    onMonthChange: (monthKey: string) => void;
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    summary: TransactionsSummary;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

const TYPE_CHIPS = [
    { key: "income" as const, label: "Receitas", icon: ArrowUpRight },
    { key: "spending" as const, label: "Despesas", icon: ArrowDownRight },
    { key: "transfer" as const, label: "Transf.", icon: ArrowRightLeft },
];

const TYPE_TONE: Record<TransactionsTabKey, { activeBorder: string; activeBg: string; activeText: string; amount: string }> = {
    income: { activeBorder: "border-emerald-300/45", activeBg: "bg-emerald-500/18", activeText: "text-emerald-100", amount: "text-emerald-200" },
    spending: { activeBorder: "border-red-300/45", activeBg: "bg-red-500/18", activeText: "text-red-100", amount: "text-red-300" },
    transfer: { activeBorder: "border-neutral-300/45", activeBg: "bg-neutral-500/15", activeText: "text-neutral-50", amount: "text-white" },
};

function formatDateShort(value: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return null;
    }

    return `${match[3]}/${match[2]}`;
}

interface PeriodPickerControlProps {
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
}

/**
 * Botao-gatilho + popover (via AnchoredOverlay) com os campos "de"/"ate" empilhados.
 * Evita que os dois <input type="date"> estourem a largura do card do overview.
 */
function PeriodPickerControl({ dateFrom, dateTo, onDateFromChange, onDateToChange }: PeriodPickerControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const fromLabel = formatDateShort(dateFrom);
    const toLabel = formatDateShort(dateTo);
    const summary = fromLabel && toLabel ? `${fromLabel} – ${toLabel}` : fromLabel ? `A partir de ${fromLabel}` : toLabel ? `Ate ${toLabel}` : "Selecionar periodo";

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !overlayRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick, true);
        document.addEventListener("keydown", handleEscapeKey);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick, true);
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen]);

    return (
        <div className="relative flex items-center justify-center">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label="Selecionar periodo"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.06]"
            >
                <CalendarRange size={14} className="shrink-0 text-white/45" />
                {summary}
            </button>

            <AnchoredOverlay
                anchorRef={triggerRef}
                overlayRef={overlayRef}
                isOpen={isOpen}
                overlayWidth={220}
                align="center"
                className="rounded-2xl border border-white/[0.12] bg-[#0e0e0e]/95 p-3 shadow-[0_30px_70px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
                <div className="flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-[0.1em] text-white/45">De</span>
                        <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className={INPUT_CLASS} aria-label="Data inicial" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-[0.1em] text-white/45">Ate</span>
                        <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className={INPUT_CLASS} aria-label="Data final" />
                    </label>
                </div>
            </AnchoredOverlay>
        </div>
    );
}

function WalletOptionContent({ option }: { option: WalletOption }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 shrink-0 rounded-md border border-white/[0.12]" iconSize={14} />
            <span className="truncate text-sm text-white">{option.label}</span>
        </span>
    );
}

// Espelha o trigger do seletor de carteira do modal de transação (avatar + nome), mas somando "+N" quando há mais de uma selecionada.
function WalletSelectedSummary({ options }: { options: WalletOption[] }) {
    const [first, ...rest] = options;
    if (!first) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={first.wallet} className="h-7 w-7 shrink-0 rounded-md border border-white/[0.12]" iconSize={14} />
            <span className="truncate text-sm text-white">
                {first.label}
                {rest.length > 0 ? ` +${rest.length}` : ""}
            </span>
        </span>
    );
}

/**
 * Painel de controle/overview da aba de transacoes.
 * Substitui os 3 cards empilhados (TransactionsSummaryCards) por um unico card
 * onde o usuario escolhe as carteiras, o tipo (receitas/despesas/transferencias)
 * e o periodo (mes unico ou intervalo de datas) a visualizar, e ve o resumo filtrado.
 */
export function TransactionsOverviewPanel({
    wallets,
    selectedWalletIds,
    onWalletIdsChange,
    activeTab,
    onTypeSelect,
    dateMode,
    onDateModeChange,
    selectedMonth,
    onMonthChange,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    summary,
}: TransactionsOverviewPanelProps) {
    const walletOptions = useMemo<WalletOption[]>(() => wallets.map((wallet) => ({ id: wallet.id, label: wallet.name, searchText: wallet.name, wallet })), [wallets]);
    const tone = TYPE_TONE[activeTab];
    const paidPercent = summary.total.amount > 0 ? Math.min(100, Math.max(0, Math.round((summary.paid.amount / summary.total.amount) * 100))) : 0;

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4"
        >
            <div className={`pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full blur-3xl ${activeTab === "income" ? "bg-emerald-400/10" : activeTab === "spending" ? "bg-red-400/10" : "bg-white/[0.06]"}`} />

            {/* Seletor de carteiras */}
            <div className="relative">
                <MultiSelectCombobox
                    hideLabel
                    label="Carteiras"
                    values={selectedWalletIds}
                    placeholder="Todas as carteiras"
                    emptyMessage="Nenhuma carteira encontrada."
                    options={walletOptions}
                    onChange={onWalletIdsChange}
                    renderOptionContent={(option) => <WalletOptionContent option={option} />}
                    renderSelectedSummary={(selected) => <WalletSelectedSummary options={selected} />}
                    triggerClassName="flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2.5 text-left text-sm text-white transition-colors hover:border-white/[0.2]"
                />
            </div>

            {/* Tipo de transacao */}
            <div className="relative mt-3.5 grid grid-cols-3 gap-1.5">
                {TYPE_CHIPS.map((chip) => {
                    const isActive = activeTab === chip.key;
                    const Icon = chip.icon;
                    const chipTone = TYPE_TONE[chip.key];

                    return (
                        <button
                            key={chip.key}
                            type="button"
                            onClick={() => onTypeSelect(chip.key)}
                            aria-pressed={isActive}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-all ${
                                isActive ? `${chipTone.activeBorder} ${chipTone.activeBg} ${chipTone.activeText}` : "border-white/[0.09] bg-white/[0.02] text-white/60 hover:border-white/[0.2] hover:bg-white/[0.05]"
                            }`}
                            title={chip.label}
                        >
                            <Icon size={15} strokeWidth={2.2} />
                            <span className="truncate text-[10px] uppercase tracking-[0.04em]">{chip.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Seletor de periodo: mes unico ou intervalo */}
            <div className="relative mt-3.5 border-y border-white/[0.06] py-2.5">
                <div className="flex items-center justify-center gap-1 pb-2">
                    <button
                        type="button"
                        onClick={() => onDateModeChange("month")}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.05em] transition-colors ${
                            dateMode === "month" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70"
                        }`}
                    >
                        Mês
                    </button>
                    <button
                        type="button"
                        onClick={() => onDateModeChange("period")}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.05em] transition-colors ${
                            dateMode === "period" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70"
                        }`}
                    >
                        Período
                    </button>
                </div>

                {dateMode === "month" ? (
                    <MonthPickerControl selectedMonth={selectedMonth} onMonthChange={onMonthChange} formatMonthLabel={formatMonthLabel} shiftMonth={shiftMonth} />
                ) : (
                    <PeriodPickerControl dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={onDateFromChange} onDateToChange={onDateToChange} />
                )}
            </div>

            {/* Total do periodo */}
            <div className="relative mt-3.5">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Total</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60">{summary.total.count}</span>
                </div>
                <p className={`mt-1 text-xl font-semibold tracking-wide ${tone.amount}`}>{currencyFormatter.format(summary.total.amount)}</p>
            </div>

            {/* Proporcao pago x pendente */}
            <div className="relative mt-3.5">
                <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Pago</span>
                    <span>{paidPercent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-400/25">
                    <div className="h-full rounded-full bg-emerald-400/70 transition-all" style={{ width: `${paidPercent}%` }} />
                </div>
            </div>

            {/* Pago / pendente */}
            <div className="relative mt-3 flex items-center justify-between gap-2">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Pago ({summary.paid.count})</p>
                    <p className="mt-0.5 text-sm font-medium text-emerald-200">{currencyFormatter.format(summary.paid.amount)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Pendente ({summary.pending.count})</p>
                    <p className="mt-0.5 text-sm font-medium text-amber-200">{currencyFormatter.format(summary.pending.amount)}</p>
                </div>
            </div>
        </motion.article>
    );
}
