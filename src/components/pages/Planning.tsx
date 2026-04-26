import { Check, ChevronDown, CreditCard as CreditCardIcon, MapPin, Plus, Target, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
    type CreditCard,
    type CreditCardInvoice,
    type LedgerEntry,
    type PlanningGoal,
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
import { getMonthKeyFromDateValue } from "../../context/financeTypes";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { parseAppDate } from "../../lib/localDate";
import { AuthShell } from "../layout/AuthShell";

type BalanceTone = "positive" | "tight" | "negative";
type ItemIconTone = "expense" | "income";
type SimulatedIncomeSource = "simulated_income" | "legacy_override";

interface IncomeItem {
    id: string;
    label: string;
    amount: number;
    iconName: string | null;
}

interface SimulatedIncomeItem {
    id: string;
    label: string;
    amount: number;
    iconName: string | null;
    source: SimulatedIncomeSource;
    overrideMonthKey?: string;
}

interface MonthReality {
    income: number;
    incomeItems: IncomeItem[];
    walletSpendings: number;
    invoiceSpendings: number;
    inheritedExpenses: number;
    activeInheritedExpenses: number;
    disabledInheritedExpenses: number;
    inheritedItems: InheritedExpenseItem[];
}

interface InheritedExpenseItem {
    id: string;
    source: "transaction" | "invoice";
    label: string;
    amount: number;
    iconName: string | null;
    isDisabled: boolean;
}

interface DraftState {
    description: string;
    amount: string;
}

interface GoalStatus {
    goal: PlanningGoal;
    isReached: boolean;
    shortage: number;
    monthlyExtra: number;
}

interface MonthProjection extends MonthReality {
    monthKey: string;
    monthLabel: string;
    shortMonthLabel: string;
    isCurrentMonth: boolean;
    simulatedIncome: number;
    simulatedIncomeItems: SimulatedIncomeItem[];
    currentIncome: number;
    simulatedExpenses: number;
    simulatedExpenseItems: PlanningSimulatedExpense[];
    originalMonthBalance: number;
    currentMonthBalance: number;
    originalAccumulated: number;
    currentAccumulated: number;
    goalStatuses: GoalStatus[];
}

interface TimelineProjection {
    openingBalance: number;
    months: MonthProjection[];
}

interface PlanningTimelineSectionProps {
    title: string;
    expanded: boolean;
    onToggle: () => void;
    controlsId: string;
    itemCount: number;
    total: number;
    totalClassName?: string;
    disabledText?: string | null;
    withTopBorder?: boolean;
    children?: ReactNode;
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

interface PlanningDraftCardProps {
    tone: "income" | "expense";
    draft: DraftState;
    onDescriptionChange: (value: string) => void;
    onAmountChange: (value: string) => void;
    onSave: () => void;
}

const TIMELINE_MONTHS = 7;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

const shortMonthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
});

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function padMonthPart(value: number): string {
    return String(value).padStart(2, "0");
}

function parseMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        year,
        monthIndex: month - 1,
    };
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return `${referenceDate.getFullYear()}-${padMonthPart(referenceDate.getMonth() + 1)}`;
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return getCurrentMonthKey();
    }

    const shifted = new Date(parsedMonth.year, parsedMonth.monthIndex + offset, 1);
    return `${shifted.getFullYear()}-${padMonthPart(shifted.getMonth() + 1)}`;
}

function formatMonthLabel(monthKey: string): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    const formatted = monthLabelFormatter.format(new Date(parsedMonth.year, parsedMonth.monthIndex, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatShortMonthLabel(monthKey: string): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    const formatted = shortMonthLabelFormatter.format(new Date(parsedMonth.year, parsedMonth.monthIndex, 1)).replace(".", "");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return Date.now();
    }

    return new Date(parsedMonth.year, parsedMonth.monthIndex, 1).getTime();
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

function formatItemCount(count: number): string {
    return `${count} ${count === 1 ? "item" : "itens"}`;
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
}): MonthReality {
    const { monthKey, wallets, creditCards, creditCardInvoices, transactions, disabledInheritedExpenseIds } = params;
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
    const disabledInheritedExpenses = roundToCents(inheritedItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0));

    return {
        income: roundToCents(income),
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

function getToneClassName(tone: BalanceTone): string {
    if (tone === "negative") {
        return "text-red-300";
    }

    if (tone === "tight") {
        return "text-amber-300";
    }

    return "text-emerald-300";
}

function buildTimelineProjection(params: {
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactions: Transaction[];
    ledgerEntries: LedgerEntry[];
    planning: PlanningState;
    expenseDrafts: Record<string, DraftState>;
    incomeDrafts: Record<string, DraftState>;
}): TimelineProjection {
    const currentMonth = getCurrentMonthKey();
    const monthKeys = Array.from({ length: TIMELINE_MONTHS }, (_, index) => shiftMonth(currentMonth, index));
    const openingBalance = getOpeningBalance(currentMonth, params.wallets, params.ledgerEntries);
    const disabledInheritedExpenseIds = new Set(params.planning.disabledInheritedExpenseIds ?? []);
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
            const reality = getMonthReality({
                monthKey,
                wallets: params.wallets,
                creditCards: params.creditCards,
                creditCardInvoices: params.creditCardInvoices,
                transactions: params.transactions,
                disabledInheritedExpenseIds,
            });
            const expenseDraftAmount = parseCurrencyInput(params.expenseDrafts[monthKey]?.amount ?? "");
            const incomeDraftAmount = parseCurrencyInput(params.incomeDrafts[monthKey]?.amount ?? "");
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
                const legacyDelta = roundToCents(legacyRevenueOverride.amount - reality.income);
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

            const simulatedIncome = roundToCents(sumAmounts(simulatedIncomeItems) + incomeDraftAmount);
            const simulatedExpenses = roundToCents(sumAmounts(simulatedExpenseItems) + expenseDraftAmount);
            const currentIncome = roundToCents(reality.income + simulatedIncome);
            const originalMonthBalance = roundToCents(reality.income - reality.inheritedExpenses);
            const currentMonthBalance = roundToCents(currentIncome - reality.activeInheritedExpenses - simulatedExpenses);

            originalAccumulated = roundToCents(originalAccumulated + originalMonthBalance);
            currentAccumulated = roundToCents(currentAccumulated + currentMonthBalance);

            const goalStatuses = params.planning.goals
                .filter((goal) => goal.targetMonth === monthKey)
                .map((goal) => {
                    const shortage = roundToCents(Math.max(0, goal.targetAmount - currentAccumulated));
                    return {
                        goal,
                        isReached: shortage <= 0,
                        shortage,
                        monthlyExtra: roundToCents(shortage / Math.max(1, index + 1)),
                    };
                });

            return {
                ...reality,
                monthKey,
                monthLabel: formatMonthLabel(monthKey),
                shortMonthLabel: formatShortMonthLabel(monthKey),
                isCurrentMonth: index === 0,
                simulatedIncome,
                simulatedIncomeItems,
                currentIncome,
                simulatedExpenses,
                simulatedExpenseItems,
                originalMonthBalance,
                currentMonthBalance,
                originalAccumulated,
                currentAccumulated,
                goalStatuses,
            };
        }),
    };
}

function mergePlanningUpdate(planning: PlanningState, update: Partial<PlanningState>): PlanningState {
    return {
        simulatedExpenses: update.simulatedExpenses ?? planning.simulatedExpenses,
        simulatedIncomes: update.simulatedIncomes ?? planning.simulatedIncomes,
        revenueOverrides: update.revenueOverrides ?? planning.revenueOverrides,
        goals: update.goals ?? planning.goals,
        disabledInheritedExpenseIds: update.disabledInheritedExpenseIds ?? planning.disabledInheritedExpenseIds ?? [],
    };
}

function PlanningMetric({ label, value, className = "text-white" }: { label: string; value: number; className?: string }) {
    return (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">{label}</p>
            <p className={`mt-1 text-lg font-semibold ${className}`}>{formatCurrency(value)}</p>
        </div>
    );
}

function PlanningTimelineSection({
    title,
    expanded,
    onToggle,
    controlsId,
    itemCount,
    total,
    totalClassName = "text-white/78",
    disabledText = null,
    withTopBorder = true,
    children,
}: PlanningTimelineSectionProps) {
    return (
        <div className={withTopBorder ? "border-t border-white/[0.07] pt-2" : ""}>
            <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-2 pb-1" aria-expanded={expanded} aria-controls={controlsId}>
                <div className="flex flex-col">
                    <p className="text-xs uppercase tracking-wider text-white/42">{title}</p>
                </div>
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55">
                    <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
            </button>
            <div className="ml-0.5 flex flex-col border-l border-white/[0.3] pl-2">
                <p className="flex justify-between text-sm text-white/78">
                    <span>{formatItemCount(itemCount)}</span>
                    <span className={totalClassName}>{formatCurrency(total)}</span>
                </p>
                {disabledText ? <p className="text-xs text-red-400/30">{disabledText}</p> : null}
            </div>
            {expanded ? (
                <div id={controlsId} className="mt-2 space-y-2">
                    {children}
                </div>
            ) : null}
        </div>
    );
}

function PlanningListRow({ label, amount, iconName, iconTone, valueClassName, onDelete, deleteLabel }: PlanningListRowProps) {
    const Icon = getCategoryIconComponent(iconName, iconTone);

    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/18 px-2.5 py-2">
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

function InheritedExpenseRow({ item, onToggle }: { item: InheritedExpenseItem; onToggle: (expenseId: string) => void }) {
    const Icon = item.source === "invoice" ? CreditCardIcon : getCategoryIconComponent(item.iconName, "expense");
    const active = !item.isDisabled;

    return (
        <button
            type="button"
            onClick={() => onToggle(item.id)}
            className={`flex h-9 w-full items-center gap-2 rounded-lg border px-2 text-left transition-colors ${
                active
                    ? "border-white/[0.06] bg-black/18 text-white/78 hover:border-white/[0.12] hover:bg-white/[0.045]"
                    : "border-white/[0.04] bg-black/10 text-white/34 hover:border-white/[0.1] hover:text-white/60"
            }`}
            title={active ? "Desativar neste planejamento" : "Ativar neste planejamento"}
        >
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${active ? "bg-red-500/10 text-red-200" : "bg-white/[0.04] text-white/35"}`}>
                <Icon size={13} />
            </span>
            <span className={`min-w-0 flex-1 truncate text-xs ${active ? "" : "line-through"}`}>{item.label}</span>
            <span className={`shrink-0 text-xs font-medium ${active ? "text-red-200" : "text-white/35"}`}>{formatCurrency(item.amount)}</span>
            <span className={`h-3 w-3 shrink-0 rounded-full border ${active ? "border-emerald-300/50 bg-emerald-300/70" : "border-white/20 bg-transparent"}`} />
        </button>
    );
}

function PlanningDraftCard({ tone, draft, onDescriptionChange, onAmountChange, onSave }: PlanningDraftCardProps) {
    const wrapperClassName = tone === "income" ? "border-emerald-300/20 bg-emerald-500/[0.08]" : "border-orange-300/20 bg-orange-500/[0.08]";
    const inputFocusClassName = tone === "income" ? "focus:border-emerald-300/35" : "focus:border-orange-300/35";
    const buttonClassName = tone === "income" ? "bg-emerald-400/18 text-emerald-100 hover:bg-emerald-400/25" : "bg-orange-400/18 text-orange-100 hover:bg-orange-400/25";

    return (
        <div className={`rounded-lg border p-2 ${wrapperClassName}`}>
            <input
                value={draft.description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder={tone === "income" ? "Descricao da receita" : "Descricao do gasto"}
                className={`mb-2 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none ${inputFocusClassName}`}
            />
            <div className="flex gap-2">
                <input
                    value={draft.amount}
                    inputMode="decimal"
                    onChange={(event) => onAmountChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            onSave();
                        }
                    }}
                    placeholder="0,00"
                    className={`min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none ${inputFocusClassName}`}
                />
                <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onSave}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${buttonClassName}`}
                    aria-label={tone === "income" ? "Salvar receita simulada" : "Salvar gasto simulado"}
                    title="Salvar"
                >
                    <Check size={16} />
                </button>
            </div>
        </div>
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

    const [compareMode, setCompareMode] = useState(false);
    const [expandedIncomeMonths, setExpandedIncomeMonths] = useState<Record<string, boolean>>({});
    const [expandedInheritedMonths, setExpandedInheritedMonths] = useState<Record<string, boolean>>({});
    const [expandedSimulatedExpenseMonths, setExpandedSimulatedExpenseMonths] = useState<Record<string, boolean>>({});
    const [openIncomeMonth, setOpenIncomeMonth] = useState<string | null>(null);
    const [openExpenseMonth, setOpenExpenseMonth] = useState<string | null>(null);
    const [incomeDrafts, setIncomeDrafts] = useState<Record<string, DraftState>>({});
    const [expenseDrafts, setExpenseDrafts] = useState<Record<string, DraftState>>({});
    const [goalTitle, setGoalTitle] = useState("");
    const [goalAmount, setGoalAmount] = useState("");
    const [goalMonth, setGoalMonth] = useState(getCurrentMonthKey());

    const projection = useMemo(
        () =>
            buildTimelineProjection({
                wallets,
                creditCards,
                creditCardInvoices,
                transactions,
                ledgerEntries,
                planning,
                expenseDrafts,
                incomeDrafts,
            }),
        [creditCardInvoices, creditCards, expenseDrafts, incomeDrafts, ledgerEntries, planning, transactions, wallets],
    );

    const visibleMonthKeys = useMemo(() => projection.months.map((month) => month.monthKey), [projection.months]);
    const visibleMonthSet = useMemo(() => new Set(visibleMonthKeys), [visibleMonthKeys]);
    const currentMonth = projection.months[0] ?? null;
    const currentFreeBalance = currentMonth ? roundToCents(currentMonth.currentIncome - currentMonth.activeInheritedExpenses) : 0;

    const handleDraftChange = (monthKey: string, nextDraft: Partial<DraftState>, setDrafts: Dispatch<SetStateAction<Record<string, DraftState>>>) => {
        setDrafts((current) => ({
            ...current,
            [monthKey]: {
                description: current[monthKey]?.description ?? "",
                amount: current[monthKey]?.amount ?? "",
                ...nextDraft,
            },
        }));
    };

    const clearDraft = (monthKey: string, setDrafts: Dispatch<SetStateAction<Record<string, DraftState>>>) => {
        setDrafts((current) => {
            const { [monthKey]: _removed, ...rest } = current;
            return rest;
        });
    };

    const commitExpenseDraft = (monthKey: string) => {
        const draft = expenseDrafts[monthKey];
        if (!draft) {
            return;
        }

        const amount = parseCurrencyInput(draft.amount);
        if (amount <= 0) {
            return;
        }

        const expense: PlanningSimulatedExpense = {
            id: `planning-expense-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Gasto simulado",
            amount,
            createdAt: new Date().toISOString(),
        };

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: [...planning.simulatedExpenses, expense],
            }),
        );

        clearDraft(monthKey, setExpenseDrafts);
        setOpenExpenseMonth(null);
    };

    const commitIncomeDraft = (monthKey: string) => {
        const draft = incomeDrafts[monthKey];
        if (!draft) {
            return;
        }

        const amount = parseCurrencyInput(draft.amount);
        if (amount <= 0) {
            return;
        }

        const income: PlanningSimulatedIncome = {
            id: `planning-income-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            monthKey,
            description: draft.description.trim() || "Receita simulada",
            amount,
            createdAt: new Date().toISOString(),
        };

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedIncomes: [...planning.simulatedIncomes, income],
            }),
        );

        clearDraft(monthKey, setIncomeDrafts);
        setOpenIncomeMonth(null);
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

    const handleAddGoal = () => {
        const targetAmount = parseCurrencyInput(goalAmount);
        const normalizedTitle = goalTitle.trim();
        if (!normalizedTitle || targetAmount <= 0 || !visibleMonthSet.has(goalMonth)) {
            return;
        }

        const goal: PlanningGoal = {
            id: `planning-goal-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            title: normalizedTitle,
            targetAmount,
            targetMonth: goalMonth,
            createdAt: new Date().toISOString(),
        };

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                goals: [...planning.goals, goal],
            }),
        );
        setGoalTitle("");
        setGoalAmount("");
    };

    const handleDeleteGoal = (goalId: string) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                goals: planning.goals.filter((goal) => goal.id !== goalId),
            }),
        );
    };

    const toggleExpandedMonth = (monthKey: string, setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>) => {
        setExpanded((current) => ({
            ...current,
            [monthKey]: !current[monthKey],
        }));
    };

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[1800px] flex-col gap-4 px-4 pb-6 pt-2 lg:px-6">
                <header className="flex flex-wrap items-center justify-between gap-3 text-left">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Planejamento</h1>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/75">
                        <span>E se...?</span>
                        <input type="checkbox" checked={compareMode} onChange={(event) => setCompareMode(event.target.checked)} className="peer sr-only" />
                        <span className="relative h-6 w-11 rounded-full bg-white/[0.12] transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-cyan-500/70 peer-checked:after:translate-x-5" />
                    </label>
                </header>

                <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
                    <aside className="rounded-lg border border-white/[0.08] bg-[#111111] p-4 text-left">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-200">
                                <WalletCards size={18} />
                            </span>
                            <div>
                                <p className="text-lg font-medium text-white">Contexto</p>
                                <p className="text-xs text-white/42">{currentMonth?.monthLabel ?? "Mes atual"}</p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                            <PlanningMetric label="Renda mensal liquida" value={currentMonth?.currentIncome ?? 0} className="text-emerald-300" />
                            <PlanningMetric label="Compromissos cadastrados" value={currentMonth?.activeInheritedExpenses ?? 0} className="text-red-300" />
                            <PlanningMetric label="Saldo livre" value={currentFreeBalance} className={getToneClassName(getBalanceTone(currentFreeBalance, currentMonth?.currentIncome ?? 0))} />
                        </div>

                        <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo inicial projetado</p>
                            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(projection.openingBalance)}</p>
                        </div>
                    </aside>

                    <section className="flex min-w-0 flex-col rounded-lg border border-white/[0.08] bg-[#101010] p-4 text-left">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-200">
                                    <TrendingUp size={17} />
                                </span>
                                <p className="text-lg font-medium text-white">Timeline</p>
                            </div>
                            <span className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-white/48">{TIMELINE_MONTHS} meses</span>
                        </div>

                        <div className="elegant-scrollbar grow -mx-1 flex gap-3 overflow-x-auto px-1">
                            {projection.months.map((month) => {
                                const originalBalanceTone = getBalanceTone(month.originalMonthBalance, month.income);
                                const balanceTone = getBalanceTone(month.currentMonthBalance, month.currentIncome);
                                const visibleMonthBalance = compareMode ? month.currentMonthBalance : month.originalMonthBalance;
                                const visibleAccumulated = compareMode ? month.currentAccumulated : month.originalAccumulated;
                                const footerBalanceTone = compareMode ? balanceTone : getBalanceTone(month.originalMonthBalance, month.income);
                                const incomeDraft = incomeDrafts[month.monthKey] ?? { description: "", amount: "" };
                                const expenseDraft = expenseDrafts[month.monthKey] ?? { description: "", amount: "" };
                                const activeInheritedItemsCount = month.inheritedItems.filter((item) => !item.isDisabled).length;
                                const disabledInheritedItemsCount = month.inheritedItems.length - activeInheritedItemsCount;
                                const totalIncomeItems = month.incomeItems.length + month.simulatedIncomeItems.length;
                                const isIncomeExpanded = expandedIncomeMonths[month.monthKey] ?? false;
                                const isInheritedListExpanded = expandedInheritedMonths[month.monthKey] ?? false;
                                const isSimulatedExpensesExpanded = expandedSimulatedExpenseMonths[month.monthKey] ?? false;

                                return (
                                    <article key={month.monthKey} className="flex w-[300px] shrink-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                                        <div>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xl font-semibold text-white">{month.shortMonthLabel}</p>
                                                </div>
                                                {month.isCurrentMonth ? <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200">Atual</span> : null}
                                            </div>

                                            <div className="hidden">
                                                <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black/[0.15] p-1">
                                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/38">Original</p>
                                                    <div className="mt-2">
                                                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Balanco do mês</p>
                                                        <p className={`mt-1 text-sm font-semibold ${getToneClassName(originalBalanceTone)}`}>
                                                            {formatCurrency(month.originalMonthBalance)}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 border-t border-white/[0.06] pt-2">
                                                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Saldo final</p>
                                                        <p className={`mt-1 text-sm font-semibold ${month.originalAccumulated < 0 ? "text-red-300" : "text-white"}`}>
                                                            {formatCurrency(month.originalAccumulated)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="min-w-0 rounded-lg border border-cyan-400/12 bg-cyan-500/[0.03]">
                                                    <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-100/70">Simulado</p>
                                                    <div className="mt-2">
                                                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Balanco do mês</p>
                                                        <p className={`mt-1 text-sm font-semibold ${getToneClassName(balanceTone)}`}>{formatCurrency(month.currentMonthBalance)}</p>
                                                    </div>
                                                    <div className="mt-2 border-t border-white/[0.06] pt-2">
                                                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/34">Saldo final</p>
                                                        <p className={`mt-1 text-sm font-semibold ${month.currentAccumulated < 0 ? "text-red-300" : "text-white"}`}>
                                                            {formatCurrency(month.currentAccumulated)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            <PlanningTimelineSection
                                                title="Receita"
                                                expanded={isIncomeExpanded}
                                                onToggle={() => toggleExpandedMonth(month.monthKey, setExpandedIncomeMonths)}
                                                controlsId={`income-items-${month.monthKey}`}
                                                itemCount={totalIncomeItems}
                                                total={month.currentIncome}
                                                totalClassName={getAmountClassName("income", month.currentIncome)}
                                                withTopBorder={false}
                                            >
                                                <div className="elegant-scrollbar max-h-50 space-y-1 overflow-y-auto border-t border-white/[0.07] py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenIncomeMonth(month.monthKey)}
                                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 uppercase text-xs font-medium text-white/72 transition-colors hover:border-emerald-300/25 hover:bg-emerald-500/10 hover:text-emerald-100"
                                                    >
                                                        <Plus size={13} />
                                                        Simular receita
                                                    </button>

                                                    {openIncomeMonth === month.monthKey ? (
                                                        <PlanningDraftCard
                                                            tone="income"
                                                            draft={incomeDraft}
                                                            onDescriptionChange={(value) => handleDraftChange(month.monthKey, { description: value }, setIncomeDrafts)}
                                                            onAmountChange={(value) => handleDraftChange(month.monthKey, { amount: value }, setIncomeDrafts)}
                                                            onSave={() => commitIncomeDraft(month.monthKey)}
                                                        />
                                                    ) : null}
                                                    {totalIncomeItems === 0 ? <p className="px-2 py-1 text-xs text-white/42">Nenhuma receita neste mes.</p> : null}
                                                    {month.incomeItems.map((item) => (
                                                        <PlanningListRow
                                                            key={item.id}
                                                            label={item.label}
                                                            amount={item.amount}
                                                            iconName={item.iconName}
                                                            iconTone="income"
                                                            valueClassName={getAmountClassName("income", item.amount)}
                                                        />
                                                    ))}
                                                    {month.simulatedIncomeItems.map((item) => (
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
                                                </div>
                                            </PlanningTimelineSection>

                                            <PlanningTimelineSection
                                                title="Gastos reais"
                                                expanded={isInheritedListExpanded}
                                                onToggle={() => toggleExpandedMonth(month.monthKey, setExpandedInheritedMonths)}
                                                controlsId={`inherited-expenses-${month.monthKey}`}
                                                itemCount={activeInheritedItemsCount}
                                                total={month.inheritedExpenses}
                                                disabledText={
                                                    month.disabledInheritedExpenses > 0 ? `${disabledInheritedItemsCount} ${disabledInheritedItemsCount === 1 ? "desativado" : "desativados"}` : null
                                                }
                                            >
                                                <div className="elegant-scrollbar max-h-50 space-y-1 overflow-y-auto border-y border-white/[0.07] py-1">
                                                    {month.inheritedItems.length === 0 ? <p className="px-2 py-1 text-xs text-white/42">Nenhum gasto real neste mes.</p> : null}
                                                    {month.inheritedItems.map((item) => (
                                                        <InheritedExpenseRow key={item.id} item={item} onToggle={handleToggleInheritedExpense} />
                                                    ))}
                                                </div>
                                            </PlanningTimelineSection>

                                            <PlanningTimelineSection
                                                title="Gastos simulados"
                                                expanded={isSimulatedExpensesExpanded}
                                                onToggle={() => toggleExpandedMonth(month.monthKey, setExpandedSimulatedExpenseMonths)}
                                                controlsId={`simulated-expenses-${month.monthKey}`}
                                                itemCount={month.simulatedExpenseItems.length}
                                                total={month.simulatedExpenses}
                                                totalClassName={getAmountClassName("simulation", month.simulatedExpenses)}
                                            >
                                                <div className="elegant-scrollbar max-h-50 space-y-1 overflow-y-auto border-t border-white/[0.07] pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenExpenseMonth(month.monthKey)}
                                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 uppercase text-xs font-medium text-white/72 transition-colors hover:border-orange-300/25 hover:bg-orange-500/10 hover:text-orange-100"
                                                    >
                                                        <Plus size={13} />
                                                        Simular gasto
                                                    </button>

                                                    {openExpenseMonth === month.monthKey ? (
                                                        <PlanningDraftCard
                                                            tone="expense"
                                                            draft={expenseDraft}
                                                            onDescriptionChange={(value) => handleDraftChange(month.monthKey, { description: value }, setExpenseDrafts)}
                                                            onAmountChange={(value) => handleDraftChange(month.monthKey, { amount: value }, setExpenseDrafts)}
                                                            onSave={() => commitExpenseDraft(month.monthKey)}
                                                        />
                                                    ) : null}
                                                    
                                                    {month.simulatedExpenseItems.map((expense) => (
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
                                                </div>
                                            </PlanningTimelineSection>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {month.goalStatuses.map((status) => (
                                                <div
                                                    key={status.goal.id}
                                                    className={`rounded-lg border px-3 py-2 ${
                                                        status.isReached ? "border-emerald-400/28 bg-emerald-500/10 text-emerald-100" : "border-red-400/28 bg-red-500/10 text-red-100"
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <MapPin size={14} className="mt-0.5 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">{status.goal.title}</p>
                                                            <p className="mt-0.5 text-xs opacity-85">{status.isReached ? "Meta atingida" : `Faltam ${formatCurrency(status.shortage)}`}</p>
                                                            {!status.isReached ? (
                                                                <p className="mt-1 text-xs opacity-75">Guardando {formatCurrency(status.monthlyExtra)}/mes a mais, voce atinge essa meta.</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <footer className="mt-auto pt-4">
                                            <div className="space-y-3 border-t border-white/[0.07] pt-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanco do mes</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compareMode ? "bg-cyan-500/12 text-cyan-200" : "bg-white/[0.05] text-white/48"}`}>
                                                        {compareMode ? "Simulado" : "Original"}
                                                    </span>
                                                </div>
                                                <p className={`mt-1 text-2xl font-semibold ${getToneClassName(footerBalanceTone)}`}>{formatCurrency(visibleMonthBalance)}</p>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo final</p>
                                                    <p className={`mt-1 text-xl font-semibold ${visibleAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(visibleAccumulated)}</p>
                                                </div>
                                            </div>
                                        </footer>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="rounded-lg border border-white/[0.08] bg-[#111111] p-4 text-left">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/12 text-fuchsia-200">
                                <Target size={18} />
                            </span>
                            <div>
                                <p className="text-lg font-medium text-white">Metas</p>
                                <p className="text-xs text-white/42">{planning.goals.length} cadastradas</p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <input
                                value={goalTitle}
                                onChange={(event) => setGoalTitle(event.target.value)}
                                placeholder="Viagem para Floripa"
                                className="w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-fuchsia-300/35"
                            />
                            <input
                                value={goalAmount}
                                inputMode="decimal"
                                onChange={(event) => setGoalAmount(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        handleAddGoal();
                                    }
                                }}
                                placeholder="R$ 0,00"
                                className="w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-fuchsia-300/35"
                            />
                            <select
                                value={visibleMonthSet.has(goalMonth) ? goalMonth : visibleMonthKeys[0]}
                                onChange={(event) => setGoalMonth(event.target.value)}
                                className="w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-fuchsia-300/35"
                            >
                                {projection.months.map((month) => (
                                    <option key={month.monthKey} value={month.monthKey}>
                                        {month.monthLabel}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleAddGoal}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-fuchsia-500/18 px-3 py-2 text-sm font-medium text-fuchsia-100 transition-colors hover:bg-fuchsia-500/25"
                            >
                                <Plus size={15} />
                                Adicionar meta
                            </button>
                        </div>

                        <div className="mt-5 space-y-2">
                            {planning.goals.length < 1 ? <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/52">Nenhuma meta cadastrada.</p> : null}
                            {planning.goals.map((goal) => {
                                const targetMonth = projection.months.find((month) => month.monthKey === goal.targetMonth);
                                const accumulated = targetMonth?.currentAccumulated ?? 0;
                                const shortage = Math.max(0, goal.targetAmount - accumulated);
                                const reached = shortage <= 0;

                                return (
                                    <div key={goal.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">{goal.title}</p>
                                            <p className="mt-0.5 text-xs text-white/45">
                                                {formatCurrency(goal.targetAmount)} em {formatMonthLabel(goal.targetMonth)}
                                            </p>
                                            <p className={`mt-1 text-xs ${reached ? "text-emerald-300" : "text-red-300"}`}>{reached ? "Atingida na timeline" : `Faltam ${formatCurrency(shortage)}`}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-red-200"
                                            aria-label="Remover meta"
                                            title="Remover"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                </div>
            </div>
        </AuthShell>
    );
}
