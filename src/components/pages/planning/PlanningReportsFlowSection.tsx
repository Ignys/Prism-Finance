import { useMemo, useState } from "react";
import type { Transaction } from "../../../context/FinanceContext";
import { BalancoMensal } from "../home/charts/BalancoMensal";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { formatReportCurrency } from "./planningReportFormatting";
import type { MonthReport } from "./planningReportsUtils";

const GRID_LINES = 4;
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

interface PlanningReportsFlowSectionProps {
    monthReports: MonthReport[];
    transactions: Transaction[];
    walletIds: string[];
}

export function PlanningReportsFlowSection({ monthReports, transactions, walletIds }: PlanningReportsFlowSectionProps) {
    const walletTransactions = useMemo(() => {
        const ids = new Set(walletIds);
        return transactions.filter((transaction) => ids.has(transaction.inWallet));
    }, [transactions, walletIds]);

    // Com um mês só, colunas não comparam nada: usa o mesmo balanço diário da Home.
    if (monthReports.length === 1) {
        return <BalancoMensal monthKey={monthReports[0].monthKey} transactions={walletTransactions} hideCaptions className="h-full" />;
    }

    return (
        <PlanningReportsPanel title="Mês a mês">
            <MonthBars monthReports={monthReports} />
        </PlanningReportsPanel>
    );
}

interface Totals {
    income: number;
    spending: number;
}

/** Números do mês em foco; sem foco, os do período inteiro. */
function Readout({ income, spending }: Totals) {
    const net = income - spending;
    const items = [
        { label: "Entrou", value: formatReportCurrency(income), rule: "border-emerald-400", text: "text-white" },
        { label: "Saiu", value: formatReportCurrency(spending), rule: "border-rose-400", text: "text-white" },
        { label: "Balanço", value: `${net >= 0 ? "+" : "−"}${formatReportCurrency(Math.abs(net))}`, rule: "border-white/30", text: net >= 0 ? "text-emerald-200" : "text-orange-200" },
    ];

    return (
        <div className="mb-6" aria-live="polite">
            <dl className="grid grid-cols-3 gap-4">
                {items.map((item) => (
                    <div key={item.label} className={`min-w-0 border-l-2 pl-3 ${item.rule}`}>
                        <dt className="text-xs text-white/45">{item.label}</dt>
                        <dd className={`mt-1 truncate text-base @md:text-lg ${item.text}`} style={REPORT_MONO_STYLE} title={item.value}>
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/** Receita e despesa lado a lado em cada mês; o mês em foco alimenta o painel de números. */
function MonthBars({ monthReports }: { monthReports: MonthReport[] }) {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const peak = Math.max(1, ...monthReports.flatMap((report) => [report.income, report.spending]));
    const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => (peak / GRID_LINES) * index);
    const active = monthReports.find((report) => report.monthKey === activeKey);
    const totals: Totals = active
        ? { income: active.income, spending: active.spending }
        : {
              income: monthReports.reduce((sum, report) => sum + report.income, 0),
              spending: monthReports.reduce((sum, report) => sum + report.spending, 0),
          };

    return (
        <>
            <Readout {...totals} />
            <div className="flex flex-1 gap-3" onMouseLeave={() => setActiveKey(null)}>
                <ol className="flex h-44 w-9 shrink-0 flex-col-reverse justify-between text-right text-[10px] text-white/30" style={REPORT_MONO_STYLE} aria-hidden>
                    {ticks.map((tick) => (
                        <li key={tick} className="-my-1.5 leading-3">{compactFormatter.format(tick)}</li>
                    ))}
                </ol>
                <div className="elegant-scrollbar min-w-0 flex-1 overflow-x-auto pb-1">
                    <div className="relative" style={{ minWidth: `${monthReports.length * 36}px` }}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between" aria-hidden>
                            {ticks.map((tick) => (
                                <span key={tick} className="h-px w-full bg-white/[0.06]" />
                            ))}
                        </div>
                        <ol className="relative flex gap-1">
                            {monthReports.map((report) => (
                                <MonthColumn
                                    key={report.monthKey}
                                    report={report}
                                    peak={peak}
                                    dimmed={activeKey !== null && activeKey !== report.monthKey}
                                    active={activeKey === report.monthKey}
                                    onActivate={(isOn) => setActiveKey(isOn ? report.monthKey : null)}
                                />
                            ))}
                        </ol>
                    </div>
                </div>
            </div>
        </>
    );
}

interface MonthColumnProps {
    report: MonthReport;
    peak: number;
    dimmed: boolean;
    active: boolean;
    onActivate: (isOn: boolean) => void;
}

function MonthColumn({ report, peak, dimmed, active, onActivate }: MonthColumnProps) {
    return (
        <li className="min-w-0 flex-1">
            <button
                type="button"
                aria-pressed={active}
                aria-label={`Ver números de ${report.label}`}
                onMouseEnter={() => onActivate(true)}
                onFocus={() => onActivate(true)}
                onBlur={() => onActivate(false)}
                onClick={() => onActivate(!active)}
                className={`flex w-full flex-col items-center rounded-md transition-opacity focus-visible:outline focus-visible:outline-white/40 ${dimmed ? "opacity-35" : ""}`}
            >
                <span className={`flex h-44 w-full items-end justify-center gap-[3px] rounded-md transition-colors ${active ? "bg-white/[0.04]" : ""}`}>
                    <span className="w-[30%] max-w-4 rounded-t-[4px] bg-emerald-400/85" style={{ height: `${(report.income / peak) * 100}%` }} />
                    <span className="w-[30%] max-w-4 rounded-t-[4px] bg-rose-400/80" style={{ height: `${(report.spending / peak) * 100}%` }} />
                </span>
                <span className={`mt-2 text-[11px] capitalize ${active ? "text-white" : "text-white/50"}`}>{report.shortLabel}</span>
            </button>
        </li>
    );
}
