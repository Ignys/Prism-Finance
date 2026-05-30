import { useMemo } from "react";
import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarRange, CreditCard, Landmark, PieChart, ReceiptText, Sparkles, Trophy, WalletCards } from "lucide-react";
import type { Transaction } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";

export type ReportRange = 6 | 9;

interface MonthReport {
    monthKey: string;
    label: string;
    shortLabel: string;
    income: number;
    spending: number;
    walletSpending: number;
    creditCardSpending: number;
    net: number;
    transactionCount: number;
}

interface CategoryReport {
    key: string;
    label: string;
    icon: string;
    color: string;
    type: "income" | "expense";
    amount: number;
    count: number;
}

interface MethodReport {
    key: "wallet" | "credit_card";
    label: string;
    amount: number;
    count: number;
    colorClassName: string;
    iconClassName: string;
}

interface ReportsSummary {
    income: number;
    spending: number;
    net: number;
    savingsRate: number | null;
    transactionCount: number;
    biggestCategory: CategoryReport | null;
    mostFrequentCategory: CategoryReport | null;
    averageTicket: number;
    bestMonth: MonthReport | null;
    worstMonth: MonthReport | null;
    methodReports: MethodReport[];
}

interface PlanningReportsTabProps {
    range: ReportRange;
    transactions: Transaction[];
}

const MONTH_KEY_FORMAT = "yyyy-MM";
const CATEGORY_FALLBACK_COLOR = "#737373";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function formatCurrency(value: number): string {
    return currencyFormatter.format(roundToCents(value));
}

function formatPercent(value: number | null): string {
    return value === null ? "--" : `${roundToCents(value).toFixed(1)}%`;
}

function parseMonthKey(monthKey: string): Date | null {
    const parsedDate = parse(monthKey.trim(), MONTH_KEY_FORMAT, new Date());
    return isValid(parsedDate) ? startOfMonth(parsedDate) : null;
}

function getCurrentMonthKey(referenceDate = new Date()): string {
    return format(startOfMonth(referenceDate), MONTH_KEY_FORMAT);
}

function shiftMonth(monthKey: string, offset: number): string {
    const parsedMonth = parseMonthKey(monthKey);
    return format(addMonths(parsedMonth ?? startOfMonth(new Date()), offset), MONTH_KEY_FORMAT);
}

function formatMonthLabel(monthKey: string, pattern = "MMM/yy"): string {
    const parsedMonth = parseMonthKey(monthKey);
    if (!parsedMonth) {
        return monthKey;
    }

    return format(parsedMonth, pattern, { locale: ptBR }).replace(".", "");
}

function getReportableTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter((transaction) => {
        if (transaction.status !== "paid" && transaction.status !== "pending") {
            return false;
        }

        if (transaction.type !== "income" && transaction.type !== "spending") {
            return false;
        }

        return transaction.systemKind !== "invoice_payment";
    });
}

function buildMonthReports(transactions: Transaction[], range: ReportRange): MonthReport[] {
    const currentMonth = getCurrentMonthKey();
    const monthKeys = Array.from({ length: range }, (_, index) => shiftMonth(currentMonth, index - range + 1));
    const reports = new Map<string, MonthReport>(
        monthKeys.map((monthKey) => [
            monthKey,
            {
                monthKey,
                label: formatMonthLabel(monthKey, "MMMM 'de' yyyy"),
                shortLabel: formatMonthLabel(monthKey),
                income: 0,
                spending: 0,
                walletSpending: 0,
                creditCardSpending: 0,
                net: 0,
                transactionCount: 0,
            },
        ]),
    );

    transactions.forEach((transaction) => {
        const monthKey = getMonthKeyFromDateValue(transaction.date);
        const report = reports.get(monthKey);
        if (!report) {
            return;
        }

        report.transactionCount += 1;
        if (transaction.type === "income") {
            report.income = roundToCents(report.income + transaction.value);
        } else {
            report.spending = roundToCents(report.spending + transaction.value);
            if (transaction.paymentMethod === "credit_card") {
                report.creditCardSpending = roundToCents(report.creditCardSpending + transaction.value);
            } else {
                report.walletSpending = roundToCents(report.walletSpending + transaction.value);
            }
        }

        report.net = roundToCents(report.income - report.spending);
    });

    return Array.from(reports.values());
}

function buildCategoryReports(transactions: Transaction[]): CategoryReport[] {
    const reports = new Map<string, CategoryReport>();

    transactions
        .filter((transaction) => transaction.type === "spending")
        .forEach((transaction) => {
            const key = transaction.category.id ? `id:${transaction.category.id}` : `label:${transaction.category.label}`;
            const current = reports.get(key);

            if (current) {
                current.amount = roundToCents(current.amount + transaction.value);
                current.count += 1;
                return;
            }

            reports.set(key, {
                key,
                label: transaction.category.label,
                icon: transaction.category.icon,
                color: transaction.category.color ?? CATEGORY_FALLBACK_COLOR,
                type: transaction.category.type,
                amount: roundToCents(transaction.value),
                count: 1,
            });
        });

    return Array.from(reports.values()).sort((a, b) => b.amount - a.amount);
}

function buildSummary(monthReports: MonthReport[], categoryReports: CategoryReport[], transactions: Transaction[]): ReportsSummary {
    const income = roundToCents(monthReports.reduce((sum, report) => sum + report.income, 0));
    const spending = roundToCents(monthReports.reduce((sum, report) => sum + report.spending, 0));
    const walletSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.walletSpending, 0));
    const creditCardSpending = roundToCents(monthReports.reduce((sum, report) => sum + report.creditCardSpending, 0));
    const spendingTransactions = transactions.filter((transaction) => {
        const monthKey = getMonthKeyFromDateValue(transaction.date);
        return transaction.type === "spending" && monthReports.some((report) => report.monthKey === monthKey);
    });
    const net = roundToCents(income - spending);
    const savingsRate = income > 0 ? (net / income) * 100 : null;
    const bestMonth = monthReports.reduce<MonthReport | null>((best, report) => (!best || report.net > best.net ? report : best), null);
    const worstMonth = monthReports.reduce<MonthReport | null>((worst, report) => (!worst || report.net < worst.net ? report : worst), null);
    const mostFrequentCategory = categoryReports.reduce<CategoryReport | null>((mostFrequent, report) => (!mostFrequent || report.count > mostFrequent.count ? report : mostFrequent), null);

    return {
        income,
        spending,
        net,
        savingsRate,
        transactionCount: transactions.filter((transaction) => monthReports.some((report) => report.monthKey === getMonthKeyFromDateValue(transaction.date))).length,
        biggestCategory: categoryReports[0] ?? null,
        mostFrequentCategory,
        averageTicket: spendingTransactions.length > 0 ? roundToCents(spending / spendingTransactions.length) : 0,
        bestMonth,
        worstMonth,
        methodReports: [
            {
                key: "wallet",
                label: "Carteira",
                amount: walletSpending,
                count: spendingTransactions.filter((transaction) => transaction.paymentMethod === "wallet").length,
                colorClassName: "bg-cyan-400",
                iconClassName: "text-cyan-200 bg-cyan-500/12",
            },
            {
                key: "credit_card",
                label: "Cartao",
                amount: creditCardSpending,
                count: spendingTransactions.filter((transaction) => transaction.paymentMethod === "credit_card").length,
                colorClassName: "bg-amber-400",
                iconClassName: "text-amber-200 bg-amber-500/12",
            },
        ],
    };
}

function buildPulseText(summary: ReportsSummary): string {
    if (summary.transactionCount === 0) {
        return "Ainda nao ha volume suficiente para ler seu padrao financeiro.";
    }

    if (summary.income <= 0 && summary.spending > 0) {
        return "O periodo tem despesas registradas sem receitas correspondentes.";
    }

    if (summary.savingsRate !== null && summary.savingsRate >= 20) {
        return "Seu fluxo recente esta respirando bem: parte relevante da renda ficou preservada.";
    }

    if (summary.net < 0) {
        return "O periodo fechou pressionado; vale revisar as categorias que mais pesaram.";
    }

    if (summary.biggestCategory && summary.spending > 0 && summary.biggestCategory.amount / summary.spending >= 0.45) {
        return `${summary.biggestCategory.label} concentra quase metade das despesas analisadas.`;
    }

    return "O periodo esta equilibrado, sem uma categoria dominando demais o resultado.";
}

function buildBarOptions(): ChartOptions<"bar"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: "rgba(255,255,255,0.58)" },
            },
            y: {
                grid: { color: "rgba(255,255,255,0.07)" },
                ticks: {
                    color: "rgba(255,255,255,0.5)",
                    callback: (value) => formatCurrency(Number(value)).replace("R$", "").trim(),
                },
            },
        },
        plugins: {
            legend: {
                labels: { color: "rgba(255,255,255,0.72)", boxWidth: 10, boxHeight: 10 },
            },
            tooltip: {
                backgroundColor: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                callbacks: {
                    label: (context: TooltipItem<"bar">) => `${context.dataset.label}: ${formatCurrency(Number(context.parsed.y ?? 0))}`,
                },
            },
        },
    };
}

function buildDoughnutOptions(total: number): ChartOptions<"doughnut"> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(10,10,10,0.96)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                callbacks: {
                    label: (context: TooltipItem<"doughnut">) => {
                        const value = Number(context.parsed ?? 0);
                        const percent = total > 0 ? (value / total) * 100 : 0;
                        return `${formatCurrency(value)} (${percent.toFixed(1)}%)`;
                    },
                },
            },
        },
    };
}

export function PlanningReportsTab({ range, transactions }: PlanningReportsTabProps) {
    const reportableTransactions = useMemo(() => getReportableTransactions(transactions), [transactions]);
    const monthReports = useMemo(() => buildMonthReports(reportableTransactions, range), [range, reportableTransactions]);
    const monthKeys = useMemo(() => new Set(monthReports.map((report) => report.monthKey)), [monthReports]);
    const periodTransactions = useMemo(() => reportableTransactions.filter((transaction) => monthKeys.has(getMonthKeyFromDateValue(transaction.date))), [monthKeys, reportableTransactions]);
    const categoryReports = useMemo(() => buildCategoryReports(periodTransactions), [periodTransactions]);
    const summary = useMemo(() => buildSummary(monthReports, categoryReports, periodTransactions), [categoryReports, monthReports, periodTransactions]);
    const hasReportData = summary.transactionCount > 0;
    const totalMethodSpending = summary.methodReports.reduce((sum, method) => sum + method.amount, 0);

    const barData = useMemo(
        () => ({
            labels: monthReports.map((report) => report.shortLabel),
            datasets: [
                {
                    label: "Receitas",
                    data: monthReports.map((report) => report.income),
                    backgroundColor: "rgba(52, 211, 153, 0.72)",
                    borderRadius: 6,
                },
                {
                    label: "Despesas",
                    data: monthReports.map((report) => report.spending),
                    backgroundColor: "rgba(248, 113, 113, 0.72)",
                    borderRadius: 6,
                },
            ],
        }),
        [monthReports],
    );

    const doughnutData = useMemo(
        () => ({
            labels: categoryReports.map((category) => category.label),
            datasets: [
                {
                    label: "Despesas",
                    data: categoryReports.map((category) => category.amount),
                    backgroundColor: categoryReports.map((category) => category.color),
                    borderWidth: 0,
                    hoverOffset: 6,
                    spacing: 2,
                },
            ],
        }),
        [categoryReports],
    );

    const barOptions = useMemo(() => buildBarOptions(), []);
    const doughnutOptions = useMemo(() => buildDoughnutOptions(summary.spending), [summary.spending]);
    const pulseText = buildPulseText(summary);

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-3 text-left">
            {!hasReportData ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-white/[0.08] bg-[#111111] p-8 text-center">
                    <div className="max-w-sm">
                        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
                            <ReceiptText size={21} />
                        </span>
                        <p className="mt-4 text-lg font-medium text-white">Sem transacoes para relatar</p>
                        <p className="mt-2 text-sm text-white/48">Receitas e despesas pagas ou pendentes vao aparecer aqui assim que forem registradas.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                        <MetricCard icon={ArrowUpRight} label="Receitas" value={formatCurrency(summary.income)} toneClassName="text-emerald-200 bg-emerald-500/12" />
                        <MetricCard icon={ArrowDownRight} label="Despesas" value={formatCurrency(summary.spending)} toneClassName="text-red-200 bg-red-500/12" />
                        <MetricCard
                            icon={Activity}
                            label="Saldo liquido"
                            value={formatCurrency(summary.net)}
                            toneClassName={summary.net >= 0 ? "text-emerald-200 bg-emerald-500/12" : "text-orange-200 bg-orange-500/12"}
                        />
                        <MetricCard icon={Sparkles} label="Economia" value={formatPercent(summary.savingsRate)} toneClassName="text-cyan-200 bg-cyan-500/12" />
                        <MetricCard
                            icon={Trophy}
                            label="Maior categoria"
                            value={summary.biggestCategory?.label ?? "--"}
                            helper={summary.biggestCategory ? formatCurrency(summary.biggestCategory.amount) : undefined}
                            toneClassName="text-amber-200 bg-amber-500/12"
                        />
                        <MetricCard icon={ReceiptText} label="Transacoes" value={String(summary.transactionCount)} toneClassName="text-violet-200 bg-violet-500/12" />
                    </div>

                    <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
                        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-medium text-white">Receitas vs despesas</p>
                                    <p className="text-xs text-white/42">Evolucao mensal das transacoes registradas</p>
                                </div>
                                <CalendarRange size={18} className="text-white/42" />
                            </div>
                            <div className="h-[315px]">
                                <Bar data={barData} options={barOptions} />
                            </div>
                        </section>

                        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-medium text-white">Gastos por categoria</p>
                                    <p className="text-xs text-white/42">Participacao no periodo selecionado</p>
                                </div>
                                <PieChart size={18} className="text-white/42" />
                            </div>
                            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
                                <div className="mx-auto h-[220px] w-[220px] rounded-lg border border-white/[0.06] bg-black/20 p-2">
                                    {summary.spending > 0 ? (
                                        <Doughnut data={doughnutData} options={doughnutOptions} />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.08em] text-white/42">Sem despesas</div>
                                    )}
                                </div>
                                <div className="elegant-scrollbar max-h-[240px] space-y-1 overflow-y-auto pr-1">
                                    {categoryReports.slice(0, 7).map((category) => (
                                        <CategoryRow key={category.key} category={category} total={summary.spending} />
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-medium text-white">Para onde o dinheiro foi</p>
                                    <p className="text-xs text-white/42">Ranking com ticket medio e peso no total de gastos</p>
                                </div>
                                <ReceiptText size={18} className="text-white/42" />
                            </div>
                            <div className="space-y-2">
                                {categoryReports.slice(0, 5).map((category, index) => (
                                    <RankingRow key={category.key} category={category} index={index} total={summary.spending} />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-200">
                                    <Sparkles size={17} />
                                </span>
                                <div>
                                    <p className="text-base font-medium text-white">Pulso financeiro</p>
                                    <p className="text-xs text-white/42">Leitura rapida do periodo</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <PulseLine icon={Trophy} label="Melhor mes" value={summary.bestMonth ? `${summary.bestMonth.shortLabel} (${formatCurrency(summary.bestMonth.net)})` : "--"} />
                                <PulseLine
                                    icon={Activity}
                                    label="Mes mais pressionado"
                                    value={summary.worstMonth ? `${summary.worstMonth.shortLabel} (${formatCurrency(summary.worstMonth.net)})` : "--"}
                                />
                                <PulseLine
                                    icon={PieChart}
                                    label="Mais recorrente"
                                    value={summary.mostFrequentCategory ? `${summary.mostFrequentCategory.label} (${summary.mostFrequentCategory.count}x)` : "--"}
                                />
                                <PulseLine icon={ReceiptText} label="Ticket medio" value={formatCurrency(summary.averageTicket)} />
                            </div>
                            <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white/68">{pulseText}</div>
                            <div className="mt-3 space-y-2">
                                {summary.methodReports.map((method) => (
                                    <MethodLine key={method.key} method={method} total={totalMethodSpending} />
                                ))}
                            </div>
                        </section>
                    </div>
                </>
            )}
        </section>
    );
}

function MetricCard({ icon: Icon, label, value, helper, toneClassName }: { icon: typeof Activity; label: string; value: string; helper?: string; toneClassName: string }) {
    return (
        <article className="rounded-lg border border-white/[0.08] bg-[#111111] p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/38">{label}</p>
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClassName}`}>
                    <Icon size={14} />
                </span>
            </div>
            <p className="mt-2 truncate text-lg font-semibold text-white" title={value}>
                {value}
            </p>
            {helper ? <p className="mt-1 truncate text-xs text-white/48">{helper}</p> : null}
        </article>
    );
}

function CategoryRow({ category, total }: { category: CategoryReport; total: number }) {
    const CategoryIcon = getCategoryIconComponent(category.icon, category.type);
    const percent = total > 0 ? (category.amount / total) * 100 : 0;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04]" style={{ color: category.color }}>
                    <CategoryIcon size={14} />
                </span>
                <span className="truncate text-sm text-white/78">{category.label}</span>
            </div>
            <div className="shrink-0 text-right text-sm">
                <p className="font-semibold text-white">{formatCurrency(category.amount)}</p>
                <p className="text-xs text-white/42">{percent.toFixed(1)}%</p>
            </div>
        </div>
    );
}

function RankingRow({ category, index, total }: { category: CategoryReport; index: number; total: number }) {
    const averageTicket = category.count > 0 ? category.amount / category.count : 0;
    const percent = total > 0 ? (category.amount / total) * 100 : 0;

    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/72">{index + 1}</span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{category.label}</p>
                        <p className="text-xs text-white/42">
                            {category.count} transacoes, ticket medio {formatCurrency(averageTicket)}
                        </p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(category.amount)}</p>
                    <p className="text-xs text-white/42">{percent.toFixed(1)}%</p>
                </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: category.color }} />
            </div>
        </div>
    );
}

function PulseLine({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="flex items-center gap-2 text-white/54">
                <Icon size={14} />
                <span className="text-xs uppercase tracking-[0.1em]">{label}</span>
            </div>
            <span className="min-w-0 truncate text-right text-sm font-medium text-white/84">{value}</span>
        </div>
    );
}

function MethodLine({ method, total }: { method: MethodReport; total: number }) {
    const percent = total > 0 ? (method.amount / total) * 100 : 0;
    const Icon = method.key === "credit_card" ? CreditCard : WalletCards;
    const DetailIcon = method.key === "credit_card" ? CreditCard : Landmark;

    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${method.iconClassName}`}>
                        <Icon size={14} />
                    </span>
                    <div>
                        <p className="text-sm font-medium text-white">{method.label}</p>
                        <p className="flex items-center gap-1 text-xs text-white/42">
                            <DetailIcon size={11} />
                            {method.count} lancamentos
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(method.amount)}</p>
                    <p className="text-xs text-white/42">{percent.toFixed(1)}%</p>
                </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${method.colorClassName}`} style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
        </div>
    );
}
