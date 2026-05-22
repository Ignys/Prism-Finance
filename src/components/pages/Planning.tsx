import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Columns2, Columns3Cog, CreditCard as CreditCardIcon, Plus, Rows2, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
    type CreditCard,
    type CreditCardInvoice,
    type LedgerEntry,
    type PlanningSimulatedExpense,
    type PlanningSimulatedIncome,
    type PlanningState,
    type Transaction,
    type Wallet,
    useFinanceActions,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceLedgerEntries,
    useFinancePlanning,
    useFinanceTransactions,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { getMonthKeyFromDateValue } from "../../context/financeTypes";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { parseAppDate } from "../../lib/localDate";
import { AuthShell } from "../layout/AuthShell";
import { PlanningSimulationModal } from "../modal/PlanningSimulationModal";

type BalanceTone = "positive" | "tight" | "negative";
type ItemIconTone = "expense" | "income";
type SimulatedIncomeSource = "simulated_income" | "legacy_override";
type PlanningPanel = "income" | "inherited_expenses" | "projections";

interface IncomeItem {
    id: string;
    label: string;
    amount: number;
    iconName: string | null;
    isDisabled: boolean;
}

interface SimulatedIncomeItem {
    id: string;
    label: string;
    amount: number;
    iconName: string | null;
    source: SimulatedIncomeSource;
    overrideMonthKey?: string;
}

interface InheritedExpenseItem {
    id: string;
    source: "transaction" | "invoice";
    label: string;
    amount: number;
    iconName: string | null;
    isDisabled: boolean;
}

interface MonthReality {
    originalIncome: number;
    activeIncome: number;
    originalIncomeCount: number;
    activeIncomeCount: number;
    incomeItems: IncomeItem[];
    walletSpendings: number;
    invoiceSpendings: number;
    inheritedExpenses: number;
    activeInheritedExpenses: number;
    disabledInheritedExpenses: number;
    inheritedItems: InheritedExpenseItem[];
}

interface MonthProjection extends MonthReality {
    monthKey: string;
    monthLabel: string;
    shortMonthLabel: string;
    year: string;
    isCurrentMonth: boolean;
    openingMonthBalance: number;
    simulatedIncome: number;
    simulatedIncomeItems: SimulatedIncomeItem[];
    currentIncome: number;
    simulatedExpenses: number;
    simulatedExpenseItems: PlanningSimulatedExpense[];
    originalMonthBalance: number;
    currentMonthBalance: number;
    originalAccumulated: number;
    currentAccumulated: number;
}

interface TimelineProjection {
    openingBalance: number;
    months: MonthProjection[];
}

interface PlanningTimelineSectionProps {
    horizontalMode?: boolean;
    title: string;
    active: boolean;
    onSelect: () => void;
    visibleItemCount: number;
    totalItemCount: number;
    total: number;
    totalClassName?: string;
}

interface PlanningListRowProps {
    label: string;
    amount: number;
    iconName: string | null;
    iconTone: ItemIconTone;
    valueClassName: string;
    onDelete?: () => void;
    deleteLabel?: string;
}

const TIMELINE_MONTH_OPTIONS = [3, 6, 9, 12] as const;
const DEFAULT_TIMELINE_MONTHS = 9;
const MONTH_KEY_FORMAT = "yyyy-MM";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

const BALANCE_TONE_CLASS_NAMES: Record<BalanceTone, string> = {
    negative: "text-red-300",
    tight: "text-amber-300",
    positive: "text-emerald-300",
};

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMonthKey(monthKey: string): Date | null {
    const parsedDate = parse(monthKey.trim(), MONTH_KEY_FORMAT, new Date());
    if (!isValid(parsedDate)) {
        return null;
    }

    return startOfMonth(parsedDate);
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return format(startOfMonth(referenceDate), MONTH_KEY_FORMAT);
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    return format(addMonths(parsedMonth, offset), MONTH_KEY_FORMAT);
}

function formatMonthLabel(monthKey: string, pattern = "MMMM 'de' yyyy"): string {
    const parsedMonth = parseMonthKey(monthKey);
    return parsedMonth ? capitalizeLabel(format(parsedMonth, pattern, { locale: ptBR }).replace(".", "")) : monthKey;
}

function formatCurrency(value: number): string {
    return currencyFormatter.format(roundToCents(value));
}

function parseCurrencyInput(input: string): number {
    const compact = input.trim().replace(/[^\d,.-]/g, "");
    if (!compact) {
        return 0;
    }

    const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return roundToCents(Math.max(0, Math.abs(parsed)));
}

function isIncludedStatus(status: Transaction["status"]): boolean {
    return status === "paid" || status === "pending";
}

function getMonthStartTime(monthKey: string): number {
    return parseMonthKey(monthKey)?.getTime() ?? Date.now();
}

function getOpeningBalance(monthKey: string, wallets: Wallet[], ledgerEntries: LedgerEntry[]): number {
    const activeWallets = wallets.filter((wallet) => wallet.isActive);
    const activeWalletIds = new Set(activeWallets.map((wallet) => wallet.id));
    const monthStartTime = getMonthStartTime(monthKey);
    const initialBalance = activeWallets.reduce((sum, wallet) => sum + wallet.initialBalance, 0);
    const ledgerBeforeMonth = ledgerEntries.reduce((sum, entry) => {
        if (!activeWalletIds.has(entry.walletId)) {
            return sum;
        }

        const entryDate = parseAppDate(entry.createdAt);
        if (!entryDate || entryDate.getTime() >= monthStartTime) {
            return sum;
        }

        return sum + entry.amount;
    }, 0);

    return roundToCents(initialBalance + ledgerBeforeMonth);
}

function sumAmounts<T extends { amount: number }>(items: T[]): number {
    return roundToCents(items.reduce((sum, item) => sum + item.amount, 0));
}

function getAmountClassName(tone: "income" | "expense" | "simulation", amount: number): string {
    if (tone === "income") {
        return amount < 0 ? "text-red-200" : "text-emerald-200";
    }

    if (tone === "expense") {
        return "text-red-200";
    }

    return "text-orange-200";
}

function getProjectionNetClassName(amount: number): string {
    if (amount > 0) {
        return "text-emerald-200";
    }

    if (amount < 0) {
        return "text-orange-200";
    }

    return "text-white/60";
}

function getNextTimelineMonthCount(currentCount: number): number {
    const currentIndex = TIMELINE_MONTH_OPTIONS.findIndex((option) => option === currentCount);
    if (currentIndex === -1) {
        return DEFAULT_TIMELINE_MONTHS;
    }

    return TIMELINE_MONTH_OPTIONS[(currentIndex + 1) % TIMELINE_MONTH_OPTIONS.length];
}

function pushPlanningItemByMonth<T extends { monthKey: string }>(map: Map<string, T[]>, item: T) {
    const items = map.get(item.monthKey) ?? [];
    items.push(item);
    map.set(item.monthKey, items);
}

function getMonthReality(params: {
    monthKey: string;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    disabledInheritedExpenseIds: Set<string>;
    disabledIncomeIds: Set<string>;
}): MonthReality {
    const { monthKey, wallets, creditCards, creditCardInvoices, transactions, disabledInheritedExpenseIds, disabledIncomeIds } = params;
    const activeWalletIds = new Set(wallets.filter((wallet) => wallet.isActive).map((wallet) => wallet.id));
    const activeCardIds = new Set(creditCards.filter((card) => card.isActive).map((card) => card.id));
    const cardNameById = new Map(creditCards.map((card) => [card.id, card.name]));

    let income = 0;
    let walletSpendings = 0;
    const incomeItems: IncomeItem[] = [];
    const inheritedItems: InheritedExpenseItem[] = [];

    for (const transaction of transactions) {
        if (!isIncludedStatus(transaction.status) || getMonthKeyFromDateValue(transaction.date) !== monthKey) {
            continue;
        }

        if (transaction.type === "income") {
            if (activeWalletIds.has(transaction.inWallet)) {
                income += transaction.value;
                incomeItems.push({
                    id: `income-transaction:${transaction.id}`,
                    label: transaction.description.trim() || transaction.category.label,
                    amount: roundToCents(transaction.value),
                    iconName: transaction.category.icon,
                    isDisabled: disabledIncomeIds.has(`income-transaction:${transaction.id}`),
                });
            }
            continue;
        }

        if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card" && activeWalletIds.has(transaction.inWallet)) {
            walletSpendings += transaction.value;
            inheritedItems.push({
                id: `transaction:${transaction.id}`,
                source: "transaction",
                label: transaction.description.trim() || transaction.category.label,
                amount: roundToCents(transaction.value),
                iconName: transaction.category.icon,
                isDisabled: disabledInheritedExpenseIds.has(`transaction:${transaction.id}`),
            });
        }
    }

    let invoiceSpendings = 0;
    for (const invoice of creditCardInvoices) {
        if (!activeCardIds.has(invoice.creditCardId) || getMonthKeyFromDateValue(invoice.dueDate) !== monthKey) {
            continue;
        }

        const openAmount = roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount));
        if (openAmount <= 0) {
            continue;
        }

        invoiceSpendings += openAmount;
        inheritedItems.push({
            id: `invoice:${invoice.id}`,
            source: "invoice",
            label: `Fatura ${cardNameById.get(invoice.creditCardId) ?? "cartao"}`,
            amount: openAmount,
            iconName: null,
            isDisabled: disabledInheritedExpenseIds.has(`invoice:${invoice.id}`),
        });
    }

    incomeItems.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
    inheritedItems.sort((a, b) => {
        if (a.source !== b.source) {
            return a.source === "invoice" ? 1 : -1;
        }
        return a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
    });

    const inheritedExpenses = roundToCents(walletSpendings + invoiceSpendings);
    const disabledIncome = roundToCents(incomeItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0));
    const disabledInheritedExpenses = roundToCents(inheritedItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0));

    return {
        originalIncome: roundToCents(income),
        activeIncome: roundToCents(income - disabledIncome),
        originalIncomeCount: incomeItems.length,
        activeIncomeCount: incomeItems.filter((item) => !item.isDisabled).length,
        incomeItems,
        walletSpendings: roundToCents(walletSpendings),
        invoiceSpendings: roundToCents(invoiceSpendings),
        inheritedExpenses,
        activeInheritedExpenses: roundToCents(inheritedExpenses - disabledInheritedExpenses),
        disabledInheritedExpenses,
        inheritedItems,
    };
}

function getBalanceTone(value: number, income: number): BalanceTone {
    if (value < 0) {
        return "negative";
    }

    if (value <= Math.max(300, income * 0.1)) {
        return "tight";
    }

    return "positive";
}

function buildTimelineProjection(params: {
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    ledgerEntries: LedgerEntry[];
    planning: PlanningState;
    monthsToShow: number;
}): TimelineProjection {
    const currentMonth = getCurrentMonthKey();
    const safeMonthsToShow = TIMELINE_MONTH_OPTIONS.includes(params.monthsToShow as (typeof TIMELINE_MONTH_OPTIONS)[number]) ? params.monthsToShow : DEFAULT_TIMELINE_MONTHS;
    const monthKeys = Array.from({ length: safeMonthsToShow }, (_, index) => shiftMonth(currentMonth, index));
    const openingBalance = getOpeningBalance(currentMonth, params.wallets, params.ledgerEntries);
    const disabledInheritedExpenseIds = new Set(params.planning.disabledInheritedExpenseIds ?? []);
    const disabledIncomeIds = new Set(params.planning.disabledIncomeIds ?? []);
    const revenueOverridesByMonth = new Map(params.planning.revenueOverrides.map((override) => [override.monthKey, override]));
    const simulatedExpensesByMonth = new Map<string, PlanningSimulatedExpense[]>();
    const simulatedIncomesByMonth = new Map<string, PlanningSimulatedIncome[]>();

    params.planning.simulatedExpenses.forEach((expense) => {
        pushPlanningItemByMonth(simulatedExpensesByMonth, expense);
    });

    params.planning.simulatedIncomes.forEach((income) => {
        pushPlanningItemByMonth(simulatedIncomesByMonth, income);
    });

    let originalAccumulated = openingBalance;
    let currentAccumulated = openingBalance;

    return {
        openingBalance,
        months: monthKeys.map((monthKey, index) => {
            const openingMonthBalance = currentAccumulated;
            const reality = getMonthReality({
                monthKey,
                wallets: params.wallets,
                creditCards: params.creditCards,
                creditCardInvoices: params.creditCardInvoices,
                transactions: params.transactions,
                disabledInheritedExpenseIds,
                disabledIncomeIds,
            });
            const simulatedExpenseItems = simulatedExpensesByMonth.get(monthKey) ?? [];
            const simulatedIncomeItems: SimulatedIncomeItem[] = (simulatedIncomesByMonth.get(monthKey) ?? []).map((income) => ({
                id: income.id,
                label: income.description.trim() || "Receita simulada",
                amount: income.amount,
                iconName: null,
                source: "simulated_income",
            }));
            const legacyRevenueOverride = revenueOverridesByMonth.get(monthKey);

            if (legacyRevenueOverride) {
                const legacyDelta = roundToCents(legacyRevenueOverride.amount - reality.originalIncome);
                if (Math.abs(legacyDelta) > 0.009) {
                    simulatedIncomeItems.push({
                        id: `legacy-override:${monthKey}`,
                        label: "Ajuste legado de receita",
                        amount: legacyDelta,
                        iconName: null,
                        source: "legacy_override",
                        overrideMonthKey: monthKey,
                    });
                }
            }

            const simulatedIncome = roundToCents(sumAmounts(simulatedIncomeItems));
            const simulatedExpenses = roundToCents(sumAmounts(simulatedExpenseItems));
            const currentIncome = roundToCents(reality.activeIncome + simulatedIncome);
            const originalMonthBalance = roundToCents(reality.originalIncome - reality.inheritedExpenses);
            const currentMonthBalance = roundToCents(currentIncome - reality.activeInheritedExpenses - simulatedExpenses);

            originalAccumulated = roundToCents(originalAccumulated + originalMonthBalance);
            currentAccumulated = roundToCents(currentAccumulated + currentMonthBalance);

            return {
                ...reality,
                monthKey,
                monthLabel: formatMonthLabel(monthKey),
                shortMonthLabel: formatMonthLabel(monthKey, "MMMM"),
                year: formatMonthLabel(monthKey, "yyyy"),
                isCurrentMonth: index === 0,
                openingMonthBalance,
                simulatedIncome,
                simulatedIncomeItems,
                currentIncome,
                simulatedExpenses,
                simulatedExpenseItems,
                originalMonthBalance,
                currentMonthBalance,
                originalAccumulated,
                currentAccumulated,
            };
        }),
    };
}

function mergePlanningUpdate(planning: PlanningState, update: Partial<PlanningState>): PlanningState {
    return {
        simulatedExpenses: update.simulatedExpenses ?? planning.simulatedExpenses,
        simulatedIncomes: update.simulatedIncomes ?? planning.simulatedIncomes,
        revenueOverrides: update.revenueOverrides ?? planning.revenueOverrides,
        disabledInheritedExpenseIds: update.disabledInheritedExpenseIds ?? planning.disabledInheritedExpenseIds ?? [],
        disabledIncomeIds: update.disabledIncomeIds ?? planning.disabledIncomeIds ?? [],
    };
}

function PlanningTimelineSection({ title, active, onSelect, visibleItemCount, totalItemCount, total, totalClassName = "text-white/78", horizontalMode = false }: PlanningTimelineSectionProps) {
    const renderedCount = visibleItemCount === totalItemCount ? visibleItemCount.toString() : `${visibleItemCount}/${totalItemCount}`;
    if (horizontalMode) {
        return (
            <div>
                <button
                    type="button"
                    onClick={onSelect}
                    className={`w-38 rounded border p-1.5 px-2.5 h-full text-left transition-colors ${
                        active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <p className={`text-[11px] uppercase tracking-wider ${active ? "text-cyan-100" : "text-white/42"}`}>{title}</p>
                        <span className="rounded-full bg-white/10 px-1 text-xs text-white/70">{renderedCount}</span>
                    </div>
                    <div className={`flex items-center justify-between text-sm ${active ? "border-cyan-300/35" : "border-white/[0.3]"}`}>
                        <span className={totalClassName}>{formatCurrency(total)}</span>
                    </div>
                </button>
            </div>
        );
    }
    return (
        <div>
            <button
                type="button"
                onClick={onSelect}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/[0.06] bg-black/18 hover:border-white/[0.12] hover:bg-white/[0.045]"
                }`}
            >
                <p className={`text-xs uppercase tracking-wider ${active ? "text-cyan-100" : "text-white/42"}`}>{title}</p>
                <div className={`mt-1 flex items-center justify-between ${active ? "border-cyan-300/35" : "border-white/[0.3]"}`}>
                    <span className="rounded-full bg-white/10 p-0.5 px-1.5 text-xs text-white/70">{renderedCount}</span>
                    <span className={totalClassName}>{formatCurrency(total)}</span>
                </div>
            </button>
        </div>
    );
}

function PlanningListRow({ label, amount, iconName, iconTone, valueClassName, onDelete, deleteLabel }: PlanningListRowProps) {
    const Icon = getCategoryIconComponent(iconName, iconTone);

    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/18 p-1.5 pr-2.5">
            <div className="flex min-w-0 items-center gap-2">
                <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        iconTone === "income" ? "bg-emerald-500/10 text-emerald-200" : "bg-orange-500/10 text-orange-200"
                    }`}
                >
                    <Icon size={14} />
                </span>
                <p className="truncate text-sm text-white/82">{label}</p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${valueClassName}`}>{formatCurrency(amount)}</span>
                {onDelete ? (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-red-200"
                        aria-label={deleteLabel}
                        title="Remover"
                    >
                        <Trash2 size={14} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function PlanningToggleRow({
    active,
    amount,
    label,
    iconTone,
    iconName,
    onToggle,
    toggleId,
    customIcon,
}: {
    active: boolean;
    amount: number;
    label: string;
    iconTone: ItemIconTone;
    iconName: string | null;
    onToggle: (itemId: string) => void;
    toggleId: string;
    customIcon?: typeof CreditCardIcon;
}) {
    const Icon = customIcon ?? getCategoryIconComponent(iconName, iconTone);
    const activeIconClassName = iconTone === "income" ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200";
    const activeAmountClassName = iconTone === "income" ? "text-emerald-200" : "text-red-200";
    const activeIndicatorClassName = iconTone === "income" ? "border-emerald-400/50 bg-emerald-400/70" : "border-red-400/50 bg-red-400/70";

    return (
        <button
            type="button"
            onClick={() => onToggle(toggleId)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-1.5 pr-2.5 text-left transition-colors ${
                active
                    ? "border-white/[0.06] bg-black/18 text-white/78 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    : "border-white/[0.04] bg-black/10 text-white/34 hover:border-white/[0.1] hover:text-white/60"
            }`}
            title={active ? "Ignorar" : "Ativar"}
        >
            <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${active ? activeIconClassName : "bg-white/[0.04] text-white/35"}`}>
                    <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 text-xs font-medium ${active ? activeAmountClassName : "text-white/35"}`}>{formatCurrency(amount)}</span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${active ? activeIndicatorClassName : "border-white/20 bg-transparent"}`} />
            </div>
        </button>
    );
}

export function PlanningPage() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactions = useFinanceTransactions();
    const ledgerEntries = useFinanceLedgerEntries();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();
    const { openModal } = useModal();

    const [compareMode, setCompareMode] = useState(true);
    const [horizontalMode, setHorizontalMode] = useState(false);
    const [timelineMonthCount, setTimelineMonthCount] = useState(DEFAULT_TIMELINE_MONTHS);
    const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentMonthKey());
    const [selectedPanel, setSelectedPanel] = useState<PlanningPanel>("income");

    const projection = useMemo(
        () =>
            buildTimelineProjection({
                wallets,
                creditCards,
                creditCardInvoices,
                transactions,
                ledgerEntries,
                planning,
                monthsToShow: timelineMonthCount,
            }),
        [creditCardInvoices, creditCards, ledgerEntries, planning, timelineMonthCount, transactions, wallets],
    );

    const currentMonth = projection.months[0] ?? null;
    const selectedMonth = projection.months.find((month) => month.monthKey === selectedMonthKey) ?? currentMonth;
    const selectedPanelTitle = selectedPanel === "income" ? "Receitas" : selectedPanel === "inherited_expenses" ? "Despesas" : "Projecoes";

    const commitExpenseDraft = async (monthKey: string, draft: { description: string; amountInput: string }) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar o gasto.");
        }

        const expense: PlanningSimulatedExpense = {
            id: `planning-expense-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Gasto simulado",
            amount,
            createdAt: new Date().toISOString(),
        };

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: [...planning.simulatedExpenses, expense],
            }),
        );
    };

    const commitIncomeDraft = async (monthKey: string, draft: { description: string; amountInput: string }) => {
        const amount = parseCurrencyInput(draft.amountInput);
        if (amount <= 0) {
            throw new Error("Informe um valor maior que zero para salvar a receita.");
        }

        const income: PlanningSimulatedIncome = {
            id: `planning-income-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Receita simulada",
            amount,
            createdAt: new Date().toISOString(),
        };

        await updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: [...planning.simulatedIncomes, income],
            }),
        );
    };

    const handleDeleteExpense = (expenseId: string) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: planning.simulatedExpenses.filter((expense) => expense.id !== expenseId),
            }),
        );
    };

    const handleDeleteIncome = (income: SimulatedIncomeItem) => {
        if (income.source === "legacy_override" && income.overrideMonthKey) {
            void updatePlanningState(
                mergePlanningUpdate(planning, {
                    revenueOverrides: planning.revenueOverrides.filter((override) => override.monthKey !== income.overrideMonthKey),
                }),
            );
            return;
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: planning.simulatedIncomes.filter((item) => item.id !== income.id),
            }),
        );
    };

    const handleToggleIncome = (incomeId: string) => {
        const disabledIds = new Set(planning.disabledIncomeIds ?? []);
        if (disabledIds.has(incomeId)) {
            disabledIds.delete(incomeId);
        } else {
            disabledIds.add(incomeId);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledIncomeIds: Array.from(disabledIds),
            }),
        );
    };

    const handleToggleInheritedExpense = (expenseId: string) => {
        const disabledIds = new Set(planning.disabledInheritedExpenseIds ?? []);
        if (disabledIds.has(expenseId)) {
            disabledIds.delete(expenseId);
        } else {
            disabledIds.add(expenseId);
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                disabledInheritedExpenseIds: Array.from(disabledIds),
            }),
        );
    };

    const handleSubmitSimulation = async (draft: { description: string; amountInput: string; monthKey: string; tone: "income" | "expense" }) => {
        if (draft.tone === "income") {
            await commitIncomeDraft(draft.monthKey, draft);
            return;
        }

        await commitExpenseDraft(draft.monthKey, draft);
    };

    const openSimulationModal = (month: MonthProjection, tone: "income" | "expense") => {
        openModal(<PlanningSimulationModal tone={tone} monthKey={month.monthKey} onSubmit={handleSubmitSimulation} />);
    };

    const handleSelectPanel = (monthKey: string, panel: PlanningPanel) => {
        setSelectedMonthKey(monthKey);
        setSelectedPanel(panel);
    };

    const renderVerticalMonths = (month: MonthProjection) => {
        const visibleMonthBalance = compareMode ? month.currentMonthBalance : month.originalMonthBalance;
        const visibleAccumulated = compareMode ? month.currentAccumulated : month.originalAccumulated;
        const visibleIncome = compareMode ? month.activeIncome : month.originalIncome;
        const visibleIncomeCount = compareMode ? month.activeIncomeCount : month.originalIncomeCount;
        const visibleExpenseCount = compareMode ? month.inheritedItems.filter((item) => !item.isDisabled).length : month.inheritedItems.length;
        const projectionItemCount = compareMode ? month.simulatedIncomeItems.length + month.simulatedExpenseItems.length : 0;
        const projectionTotal = compareMode ? roundToCents(month.simulatedIncome - month.simulatedExpenses) : 0;
        const footerBalanceTone = getBalanceTone(visibleMonthBalance, compareMode ? month.currentIncome : month.originalIncome);
        const isSelectedMonth = selectedMonth?.monthKey === month.monthKey;

        return (
            <article key={month.monthKey} className={`flex shrink-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 ${!horizontalMode ? "w-[300px]" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xl font-semibold text-white">
                            {month.shortMonthLabel}
                            <span className="text-xs mx-1 text-white/60 font-light">{month.year}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {month.isCurrentMonth ? <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200">Atual</span> : null}
                    </div>
                </div>

                <div className="mt-4 space-y-1">
                    <div>
                        <button
                            type="button"
                            className={`w-full px-1 pb-1.5 mb-1.5 text-left transition-colors border-b border-white/[0.07]`}
                        >
                            <div className="flex justify-between items-center">
                                <p className={`text-xs font-light uppercase tracking-wider text-white/42`}>SALDO INICIAL DO MÊS</p>
                                <span className="text-sm font-light text-white/42">{formatCurrency(month.openingMonthBalance)}</span>
                            </div>
                        </button>
                    </div>
                    <PlanningTimelineSection
                        title="Receitas"
                        active={isSelectedMonth && selectedPanel === "income"}
                        onSelect={() => handleSelectPanel(month.monthKey, "income")}
                        visibleItemCount={visibleIncomeCount}
                        totalItemCount={month.originalIncomeCount}
                        total={visibleIncome}
                        totalClassName={getAmountClassName("income", visibleIncome)}
                    />
                    <PlanningTimelineSection
                        title="Despesas"
                        active={isSelectedMonth && selectedPanel === "inherited_expenses"}
                        onSelect={() => handleSelectPanel(month.monthKey, "inherited_expenses")}
                        visibleItemCount={visibleExpenseCount}
                        totalItemCount={month.inheritedItems.length}
                        total={compareMode ? month.activeInheritedExpenses : month.inheritedExpenses}
                        totalClassName={getAmountClassName("expense", month.inheritedExpenses)}
                    />
                    <PlanningTimelineSection
                        title="Projecoes"
                        active={isSelectedMonth && selectedPanel === "projections"}
                        onSelect={() => handleSelectPanel(month.monthKey, "projections")}
                        visibleItemCount={projectionItemCount}
                        totalItemCount={projectionItemCount}
                        total={projectionTotal}
                        totalClassName={getProjectionNetClassName(projectionTotal)}
                    />
                </div>

                <footer className="mt-auto pt-4">
                    <div className="space-y-3 border-t border-white/[0.07] pt-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanço mensal</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compareMode ? "bg-cyan-500/12 text-cyan-200" : "bg-white/[0.05] text-white/48"}`}>
                                {compareMode ? "Projeções" : "Original"}
                            </span>
                        </div>
                        <p className={`mt-1 text-2xl font-semibold ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>{formatCurrency(visibleMonthBalance)}</p>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo final</p>
                            <p className={`mt-1 text-xl font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(visibleAccumulated)}</p>
                        </div>
                    </div>
                </footer>
            </article>
        );
    };

    const renderHorizontalMonths = (month: MonthProjection) => {
        const visibleMonthBalance = compareMode ? month.currentMonthBalance : month.originalMonthBalance;
        const visibleAccumulated = compareMode ? month.currentAccumulated : month.originalAccumulated;
        const visibleIncome = compareMode ? month.activeIncome : month.originalIncome;
        const visibleIncomeCount = compareMode ? month.activeIncomeCount : month.originalIncomeCount;
        const visibleExpenseCount = compareMode ? month.inheritedItems.filter((item) => !item.isDisabled).length : month.inheritedItems.length;
        const projectionItemCount = compareMode ? month.simulatedIncomeItems.length + month.simulatedExpenseItems.length : 0;
        const projectionTotal = compareMode ? roundToCents(month.simulatedIncome - month.simulatedExpenses) : 0;
        const footerBalanceTone = getBalanceTone(visibleMonthBalance, compareMode ? month.currentIncome : month.originalIncome);
        const isSelectedMonth = selectedMonth?.monthKey === month.monthKey;

        return (
            <article key={month.monthKey} className={`flex justify-between rounded-lg border border-white/[0.08] bg-white/[0.035] p-3`}>
                <header className="flex flex-col items-start justify-center gap-1.5">
                    <div>
                        <p className="text-xl font-semibold text-white">
                            {month.shortMonthLabel}
                            <span className="text-xs mx-1.5 text-white/60 font-light">{month.year}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-4 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compareMode ? "bg-cyan-500/12 text-cyan-200" : "bg-white/[0.05] text-white/48"}`}>
                            {compareMode ? "Projeções" : "Original"}
                        </span>
                    </div>
                </header>

                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`w-50 px-1 pr-3 mr-1 text-left transition-colors border-r border-white/[0.07]`}
                        >
                            <div className="flex flex-col justify-center items-end gap-0.5">
                                <p className={`text-[11px] font-light uppercase tracking-wider text-white/42`}>SALDO INICIAL DO MÊS</p>
                                <span className="text-sm font-light text-white/42">{formatCurrency(month.openingMonthBalance)}</span>
                            </div>
                        </button>

                        <PlanningTimelineSection
                            horizontalMode
                            title="Receitas"
                            active={isSelectedMonth && selectedPanel === "income"}
                            onSelect={() => handleSelectPanel(month.monthKey, "income")}
                            visibleItemCount={visibleIncomeCount}
                            totalItemCount={month.originalIncomeCount}
                            total={visibleIncome}
                            totalClassName={getAmountClassName("income", visibleIncome)}
                        />
                        <PlanningTimelineSection
                            horizontalMode
                            title="Despesas"
                            active={isSelectedMonth && selectedPanel === "inherited_expenses"}
                            onSelect={() => handleSelectPanel(month.monthKey, "inherited_expenses")}
                            visibleItemCount={visibleExpenseCount}
                            totalItemCount={month.inheritedItems.length}
                            total={compareMode ? month.activeInheritedExpenses : month.inheritedExpenses}
                            totalClassName={getAmountClassName("expense", month.inheritedExpenses)}
                        />
                        <PlanningTimelineSection
                            horizontalMode
                            title="Projecoes"
                            active={isSelectedMonth && selectedPanel === "projections"}
                            onSelect={() => handleSelectPanel(month.monthKey, "projections")}
                            visibleItemCount={projectionItemCount}
                            totalItemCount={projectionItemCount}
                            total={projectionTotal}
                            totalClassName={getProjectionNetClassName(projectionTotal)}
                        />
                    </div>

                    <footer className="px-3 h-full">
                        <div className="flex items-center h-full">
                            <div className=" flex flex-col justify-end gap-2 border-x px-4 border-neutral-700 w-45">
                                <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanço mensal</p>
                                <p className={` text-xl font-semibold ${BALANCE_TONE_CLASS_NAMES[footerBalanceTone]}`}>{formatCurrency(visibleMonthBalance)}</p>
                            </div>
                            <div className=" flex flex-col justify-end gap-2 px-4 w-45">
                                <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo final</p>
                                <p className={` text-xl font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(visibleAccumulated)}</p>
                            </div>
                        </div>
                    </footer>
                </div>
            </article>
        );
    };

    const renderAsideContent = () => {
        if (!selectedMonth) {
            return <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/52">Nenhum mês disponivel.</p>;
        }

        if (selectedPanel === "income") {
            return (
                <div className="mt-2 flex flex-col gap-1 elegant-scrollbar overflow-y-auto">
                    {selectedMonth.incomeItems.length === 0 ? (
                        <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Nenhuma receita neste mês.</p>
                    ) : null}
                    {selectedMonth.incomeItems.map((item) => (
                        <PlanningToggleRow
                            key={item.id}
                            toggleId={item.id}
                            label={item.label}
                            amount={item.amount}
                            iconName={item.iconName}
                            iconTone="income"
                            active={!item.isDisabled}
                            onToggle={handleToggleIncome}
                        />
                    ))}
                </div>
            );
        }

        if (selectedPanel === "inherited_expenses") {
            return (
                <div className="mt-2 flex flex-col gap-1 elegant-scrollbar overflow-y-auto">
                    {selectedMonth.inheritedItems.length === 0 ? (
                        <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Você não tem despesas nesse mês.</p>
                    ) : null}
                    {selectedMonth.inheritedItems.map((item) => (
                        <PlanningToggleRow
                            key={item.id}
                            toggleId={item.id}
                            label={item.label}
                            amount={item.amount}
                            iconName={item.iconName}
                            iconTone="expense"
                            active={!item.isDisabled}
                            onToggle={handleToggleInheritedExpense}
                            customIcon={item.source === "invoice" ? CreditCardIcon : undefined}
                        />
                    ))}
                </div>
            );
        }

        const hasSimulatedIncomes = selectedMonth.simulatedIncomeItems.length > 0;
        const hasSimulatedExpenses = selectedMonth.simulatedExpenseItems.length > 0;
        const hasProjectionItems = hasSimulatedIncomes || hasSimulatedExpenses;

        return (
            <>
                <div className="mt-3 flex flex-col gap-3 elegant-scrollbar overflow-y-auto">
                    {!hasProjectionItems ? <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/52">Você não criou nenhuma projeção nesse mês.</p> : null}

                    {hasSimulatedIncomes ? (
                        <section className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Receitas</p>
                            {selectedMonth.simulatedIncomeItems.map((item) => (
                                <PlanningListRow
                                    key={item.id}
                                    label={item.label}
                                    amount={item.amount}
                                    iconName={item.iconName}
                                    iconTone="income"
                                    valueClassName={getAmountClassName("income", item.amount)}
                                    onDelete={() => handleDeleteIncome(item)}
                                    deleteLabel="Remover receita simulada"
                                />
                            ))}
                        </section>
                    ) : null}

                    {hasSimulatedExpenses ? (
                        <section className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Despesas</p>
                            {selectedMonth.simulatedExpenseItems.map((expense) => (
                                <PlanningListRow
                                    key={expense.id}
                                    label={expense.description}
                                    amount={expense.amount}
                                    iconName={null}
                                    iconTone="expense"
                                    valueClassName={getAmountClassName("simulation", expense.amount)}
                                    onDelete={() => handleDeleteExpense(expense.id)}
                                    deleteLabel="Remover gasto simulado"
                                />
                            ))}
                        </section>
                    ) : null}
                </div>
            </>
        );
    };

    return (
        <AuthShell mainClassName="text-white">
            <div className="flex justify-self-center flex-col min-h-[calc(100vh-8rem)] w-[90%] gap-4 pb-3 mt-1">
                <header className="flex flex-wrap items-center justify-between gap-3 text-left">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Planejamento</h1>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/75">
                        <span>Projeções</span>
                        <input type="checkbox" checked={compareMode} onChange={(event) => setCompareMode(event.target.checked)} className="peer sr-only" />
                        <span className="relative h-6 w-11 rounded-full bg-white/[0.12] transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-cyan-500/70 peer-checked:after:translate-x-5" />
                    </label>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
                    <section className="flex min-w-0 w-full flex-col rounded-lg border border-white/[0.08] bg-[#101010] p-4 text-left">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-200">
                                    <TrendingUp size={17} />
                                </span>
                                <p className="text-lg font-medium text-white">Timeline</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-full border border-white/[0.1] px-3 py-1 text-sm inline-flex items-center gap-2 hover:bg-white/[0.05]"
                                    onClick={() => setHorizontalMode(!horizontalMode)}
                                >
                                    {!horizontalMode ? (
                                        <>
                                            <Rows2 size={14} />
                                            Visualização vertical
                                        </>
                                    ) : (
                                        <>
                                            <Columns2 size={14} />
                                            Visualização horizontal
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineMonthCount((currentCount) => getNextTimelineMonthCount(currentCount))}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-3 py-1 text-sm transition-colors hover:bg-white/[0.05]"
                                    title="Clique para alternar a quantidade de meses exibidos"
                                >
                                    {timelineMonthCount} meses
                                </button>
                            </div>
                        </div>

                        <div className={`elegant-scrollbar grow -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 ${!horizontalMode ? "flex-row" : "flex-col"}`}>
                            {horizontalMode ? projection.months.map(renderHorizontalMonths) : projection.months.map(renderVerticalMonths)}
                        </div>
                    </section>

                    <aside className="sticky top-0 w-full max-w-[420px] shrink-0 rounded-lg border border-white/[0.08] bg-[#111111] p-4 text-left">
                        <div className="sticky top-30">
                            <div className=" flex items-center justify-between">
                                <div className="flex gap-2 items-center">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/12 text-fuchsia-200">
                                        <Columns3Cog size={18} />
                                    </span>
                                    <div>
                                        <p className="text-lg font-medium text-white">{selectedPanelTitle}</p>
                                        <p className="text-xs text-white/42">{selectedMonth?.monthLabel ?? currentMonth?.monthLabel ?? "Mês atual"}</p>
                                    </div>
                                </div>
                                <div>
                                    {selectedPanel === "projections" && (
                                        <button
                                            type="button"
                                            onClick={() => openSimulationModal(selectedMonth!, "income")}
                                            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-medium uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/16"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {renderAsideContent()}
                        </div>
                    </aside>
                </div>
            </div>
        </AuthShell>
    );
}
