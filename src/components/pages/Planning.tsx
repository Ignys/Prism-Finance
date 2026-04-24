import { Check, CreditCard as CreditCardIcon, MapPin, Pencil, Plus, Target, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import {
    type CreditCard,
    type CreditCardInvoice,
    type LedgerEntry,
    type PlanningGoal,
    type PlanningSimulatedExpense,
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

interface MonthReality {
    income: number;
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

interface ExpenseDraft {
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
    currentIncome: number;
    simulatedExpenses: number;
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
    const inheritedItems: InheritedExpenseItem[] = [];

    for (const transaction of transactions) {
        if (!isIncludedStatus(transaction.status) || getMonthKeyFromDateValue(transaction.date) !== monthKey) {
            continue;
        }

        if (transaction.type === "income") {
            if (activeWalletIds.has(transaction.inWallet)) {
                income += transaction.value;
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

    inheritedItems.sort((a, b) => {
        if (a.source !== b.source) {
            return a.source === "invoice" ? 1 : -1;
        }
        return a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
    });

    const inheritedExpenses = roundToCents(walletSpendings + invoiceSpendings);
    const disabledInheritedExpenses = roundToCents(
        inheritedItems.filter((item) => item.isDisabled).reduce((sum, item) => sum + item.amount, 0),
    );

    return {
        income: roundToCents(income),
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
    expenseDrafts: Record<string, ExpenseDraft>;
    revenueInputs: Record<string, string>;
}): TimelineProjection {
    const currentMonth = getCurrentMonthKey();
    const monthKeys = Array.from({ length: TIMELINE_MONTHS }, (_, index) => shiftMonth(currentMonth, index));
    const openingBalance = getOpeningBalance(currentMonth, params.wallets, params.ledgerEntries);
    const revenueOverridesByMonth = new Map(params.planning.revenueOverrides.map((override) => [override.monthKey, override.amount]));
    const disabledInheritedExpenseIds = new Set(params.planning.disabledInheritedExpenseIds ?? []);
    const simulatedExpensesByMonth = new Map<string, number>();

    params.planning.simulatedExpenses.forEach((expense) => {
        simulatedExpensesByMonth.set(expense.monthKey, roundToCents((simulatedExpensesByMonth.get(expense.monthKey) ?? 0) + expense.amount));
    });

    Object.entries(params.expenseDrafts).forEach(([monthKey, draft]) => {
        const amount = parseCurrencyInput(draft.amount);
        if (amount > 0) {
            simulatedExpensesByMonth.set(monthKey, roundToCents((simulatedExpensesByMonth.get(monthKey) ?? 0) + amount));
        }
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
            const revenueInput = params.revenueInputs[monthKey];
            const currentIncome =
                revenueInput !== undefined ? parseCurrencyInput(revenueInput) : revenueOverridesByMonth.get(monthKey) ?? reality.income;
            const simulatedExpenses = simulatedExpensesByMonth.get(monthKey) ?? 0;
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
                currentIncome,
                simulatedExpenses,
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

function MonthAmountRow({ label, value, className = "text-white/85" }: { label: string; value: number; className?: string }) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/45">{label}</span>
            <span className={`font-medium ${className}`}>{formatCurrency(value)}</span>
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

export function PlanningPage() {
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactions = useFinanceTransactions();
    const ledgerEntries = useFinanceLedgerEntries();
    const planning = useFinancePlanning();
    const { updatePlanningState } = useFinanceActions();

    const [compareMode, setCompareMode] = useState(false);
    const [openExpenseMonth, setOpenExpenseMonth] = useState<string | null>(null);
    const [expenseDrafts, setExpenseDrafts] = useState<Record<string, ExpenseDraft>>({});
    const [revenueInputs, setRevenueInputs] = useState<Record<string, string>>({});
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
                revenueInputs,
            }),
        [creditCardInvoices, creditCards, expenseDrafts, ledgerEntries, planning, revenueInputs, transactions, wallets],
    );

    const visibleMonthKeys = useMemo(() => projection.months.map((month) => month.monthKey), [projection.months]);
    const visibleMonthSet = useMemo(() => new Set(visibleMonthKeys), [visibleMonthKeys]);
    const currentMonth = projection.months[0] ?? null;
    const currentFreeBalance = currentMonth ? roundToCents(currentMonth.income - currentMonth.inheritedExpenses) : 0;

    const expensesByMonth = useMemo(() => {
        const map = new Map<string, PlanningSimulatedExpense[]>();
        planning.simulatedExpenses.forEach((expense) => {
            const items = map.get(expense.monthKey) ?? [];
            items.push(expense);
            map.set(expense.monthKey, items);
        });
        return map;
    }, [planning.simulatedExpenses]);

    const handleExpenseDraftChange = (monthKey: string, nextDraft: Partial<ExpenseDraft>) => {
        setExpenseDrafts((current) => ({
            ...current,
            [monthKey]: {
                description: current[monthKey]?.description ?? "",
                amount: current[monthKey]?.amount ?? "",
                ...nextDraft,
            },
        }));
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

        setExpenseDrafts((current) => {
            const { [monthKey]: _removed, ...rest } = current;
            return rest;
        });
        setOpenExpenseMonth(null);
    };

    const handleDeleteExpense = (expenseId: string) => {
        void updatePlanningState(
            mergePlanningUpdate(planning, {
                simulatedExpenses: planning.simulatedExpenses.filter((expense) => expense.id !== expenseId),
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

    const handleRevenueFocus = (month: MonthProjection) => {
        setRevenueInputs((current) => ({
            ...current,
            [month.monthKey]: current[month.monthKey] ?? formatCurrency(month.currentIncome),
        }));
    };

    const handleRevenueBlur = (month: MonthProjection) => {
        const rawValue = revenueInputs[month.monthKey];
        if (rawValue === undefined) {
            return;
        }

        const amount = parseCurrencyInput(rawValue);
        const nextOverrides = planning.revenueOverrides.filter((override) => override.monthKey !== month.monthKey);
        if (Math.abs(amount - month.income) > 0.009) {
            nextOverrides.push({
                monthKey: month.monthKey,
                amount,
                updatedAt: new Date().toISOString(),
            });
        }

        void updatePlanningState(
            mergePlanningUpdate(planning, {
                revenueOverrides: nextOverrides,
            }),
        );

        setRevenueInputs((current) => {
            const { [month.monthKey]: _removed, ...rest } = current;
            return rest;
        });
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

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1800px] flex-col gap-4 px-4 pb-6 pt-2 lg:px-6">
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
                            <PlanningMetric label="Renda mensal liquida" value={currentMonth?.income ?? 0} className="text-emerald-300" />
                            <PlanningMetric label="Compromissos cadastrados" value={currentMonth?.inheritedExpenses ?? 0} className="text-red-300" />
                            <PlanningMetric
                                label="Saldo livre"
                                value={currentFreeBalance}
                                className={getToneClassName(getBalanceTone(currentFreeBalance, currentMonth?.income ?? 0))}
                            />
                        </div>

                        <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo inicial projetado</p>
                            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(projection.openingBalance)}</p>
                        </div>
                    </aside>

                    <section className="min-w-0 rounded-lg border border-white/[0.08] bg-[#101010] p-4 text-left">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-200">
                                    <TrendingUp size={17} />
                                </span>
                                <p className="text-lg font-medium text-white">Timeline</p>
                            </div>
                            <span className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-white/48">{TIMELINE_MONTHS} meses</span>
                        </div>

                        <div className="elegant-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
                            {projection.months.map((month) => {
                                const balanceTone = getBalanceTone(month.currentMonthBalance, month.currentIncome);
                                const expenses = expensesByMonth.get(month.monthKey) ?? [];
                                const draft = expenseDrafts[month.monthKey] ?? { description: "", amount: "" };

                                return (
                                    <article key={month.monthKey} className="flex min-h-[560px] w-[290px] shrink-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xl font-semibold text-white">{month.shortMonthLabel}</p>
                                                <p className="text-xs text-white/42">{month.monthLabel}</p>
                                            </div>
                                            {month.isCurrentMonth && <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200">Atual</span>}
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            <label className="block">
                                                <span className="mb-1 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-white/42">
                                                    Receita
                                                    <Pencil size={11} />
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={revenueInputs[month.monthKey] ?? formatCurrency(month.currentIncome)}
                                                    onFocus={() => handleRevenueFocus(month)}
                                                    onChange={(event) =>
                                                        setRevenueInputs((current) => ({
                                                            ...current,
                                                            [month.monthKey]: event.target.value,
                                                        }))
                                                    }
                                                    onBlur={() => handleRevenueBlur(month)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            event.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm font-medium text-emerald-200 outline-none transition-colors focus:border-emerald-300/35"
                                                />
                                            </label>

                                            <MonthAmountRow label="Gastos herdados" value={month.inheritedExpenses} className="text-red-200" />
                                            <MonthAmountRow label="Gastos simulados" value={month.simulatedExpenses} className={month.simulatedExpenses > 0 ? "text-orange-200" : "text-white/55"} />
                                        </div>

                                        {compareMode && (
                                            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.08] bg-black/20 p-2">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/38">Original</p>
                                                    <p className={`mt-1 text-sm font-semibold ${getToneClassName(getBalanceTone(month.originalMonthBalance, month.income))}`}>
                                                        {formatCurrency(month.originalMonthBalance)}
                                                    </p>
                                                    <p className="text-xs text-white/40">{formatCurrency(month.originalAccumulated)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/38">Atual</p>
                                                    <p className={`mt-1 text-sm font-semibold ${getToneClassName(balanceTone)}`}>{formatCurrency(month.currentMonthBalance)}</p>
                                                    <p className="text-xs text-white/40">{formatCurrency(month.currentAccumulated)}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Balanço do mês</p>
                                                <p className={`mt-1 text-2xl font-semibold ${getToneClassName(balanceTone)}`}>{formatCurrency(month.currentMonthBalance)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.14em] text-white/42">Saldo final</p>
                                                <p className={`mt-1 text-xl font-semibold ${month.currentAccumulated < 0 ? "text-red-300" : "text-white"}`}>{formatCurrency(month.currentAccumulated)}</p>
                                            </div>
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
                                                            <p className="mt-0.5 text-xs opacity-85">
                                                                {status.isReached ? "Meta atingida" : `Faltam ${formatCurrency(status.shortage)}`}
                                                            </p>
                                                            {!status.isReached && <p className="mt-1 text-xs opacity-75">Guardando {formatCurrency(status.monthlyExtra)}/mes a mais, voce atinge essa meta.</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-auto space-y-2 pt-4">
                                            {expenses.length > 0 && (
                                                <div className="space-y-1.5">
                                                    {expenses.map((expense) => (
                                                        <div key={expense.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/18 px-2.5 py-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm text-white/82">{expense.description}</p>
                                                                <p className="text-xs text-orange-200">{formatCurrency(expense.amount)}</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteExpense(expense.id)}
                                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.07] hover:text-red-200"
                                                                aria-label="Remover gasto simulado"
                                                                title="Remover"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {openExpenseMonth === month.monthKey ? (
                                                <div className="rounded-lg border border-orange-300/20 bg-orange-500/[0.08] p-2">
                                                    <input
                                                        value={draft.description}
                                                        onChange={(event) => handleExpenseDraftChange(month.monthKey, { description: event.target.value })}
                                                        placeholder="Descricao"
                                                        className="mb-2 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/35"
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={draft.amount}
                                                            inputMode="decimal"
                                                            onChange={(event) => handleExpenseDraftChange(month.monthKey, { amount: event.target.value })}
                                                            onBlur={() => commitExpenseDraft(month.monthKey)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    commitExpenseDraft(month.monthKey);
                                                                }
                                                            }}
                                                            placeholder="0,00"
                                                            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-orange-300/35"
                                                        />
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => commitExpenseDraft(month.monthKey)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-400/18 text-orange-100 transition-colors hover:bg-orange-400/25"
                                                            aria-label="Salvar gasto simulado"
                                                            title="Salvar"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenExpenseMonth(month.monthKey)}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:border-orange-300/25 hover:bg-orange-500/10 hover:text-orange-100"
                                                >
                                                    <Plus size={15} />
                                                    Simular gasto
                                                </button>
                                            )}
                                        </div>
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
                            {planning.goals.length < 1 && <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/52">Nenhuma meta cadastrada.</p>}
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
                                            <p className={`mt-1 text-xs ${reached ? "text-emerald-300" : "text-red-300"}`}>
                                                {reached ? "Atingida na timeline" : `Faltam ${formatCurrency(shortage)}`}
                                            </p>
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
