import { WalletAvatar } from "../../common/WalletAvatar";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import type { AccountReportRow } from "./planningAccountReports";
import { formatReportCurrency } from "./planningReportFormatting";

interface PlanningReportsAccountsSectionProps {
    kind: "wallets" | "cards";
    rows: AccountReportRow[];
}

/** Comparativo entre as contas selecionadas: saldo/fatura de cada uma e o movimento no período. */
export function PlanningReportsAccountsSection({ kind, rows }: PlanningReportsAccountsSectionProps) {
    const isCards = kind === "cards";
    const totalPosition = rows.reduce((sum, row) => sum + Math.max(0, row.position), 0);
    const ordered = [...rows].sort((left, right) => right.position - left.position);

    return (
        <PlanningReportsPanel
            title={isCards ? "Cartão a cartão" : "Carteira a carteira"}
        >
            {!isCards && totalPosition > 0 ? (
                <div className="mb-5 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Distribuição do saldo entre as carteiras">
                    {ordered.filter((row) => row.position > 0).map((row) => (
                        <span key={row.id} style={{ width: `${(row.position / totalPosition) * 100}%`, backgroundColor: row.account.color }} title={`${row.account.name}: ${formatReportCurrency(row.position)}`} />
                    ))}
                </div>
            ) : null}

            <div className="elegant-scrollbar -mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[480px] text-sm">
                    <thead>
                        <tr className="text-left text-xs text-white/45">
                            <th className="pb-2 font-normal">{isCards ? "Cartão" : "Carteira"}</th>
                            {isCards ? null : <th className="pb-2 text-right font-normal">Entradas</th>}
                            <th className="pb-2 text-right font-normal">{isCards ? "Gasto" : "Saídas"}</th>
                            {isCards ? null : <th className="pb-2 text-right font-normal">Resultado</th>}
                            <th className="pb-2 text-right font-normal">{isCards ? "Em aberto" : "Saldo"}</th>
                            {isCards ? <th className="w-32 pb-2 pl-4 font-normal">Limite</th> : null}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]" style={REPORT_MONO_STYLE}>
                        {ordered.map((row) => {
                            const usedPercent = row.limit ? Math.min(100, (row.position / row.limit) * 100) : 0;
                            return (
                                <tr key={row.id}>
                                    <td className="py-2.5 pr-3">
                                        <span className="flex min-w-0 items-center gap-2 font-sans text-white/85">
                                            <WalletAvatar wallet={row.account} className="h-7 w-7 shrink-0 rounded-md" iconSize={14} />
                                            <span className="truncate">{row.account.name}</span>
                                        </span>
                                    </td>
                                    {isCards ? null : <td className="py-2.5 text-right text-emerald-200/90">{formatReportCurrency(row.income)}</td>}
                                    <td className="py-2.5 text-right text-rose-200/90">{formatReportCurrency(row.spending)}</td>
                                    {isCards ? null : (
                                        <td className={`py-2.5 text-right ${row.net >= 0 ? "text-white/80" : "text-orange-200"}`}>{formatReportCurrency(row.net)}</td>
                                    )}
                                    <td className="py-2.5 text-right text-white">{formatReportCurrency(row.position)}</td>
                                    {isCards ? (
                                        <td className="py-2.5 pl-4" title={row.limit ? `${usedPercent.toFixed(0)}% de ${formatReportCurrency(row.limit)}` : "Sem limite cadastrado"}>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                                <div className={`h-full rounded-full ${usedPercent >= 80 ? "bg-rose-400" : "bg-violet-300"}`} style={{ width: `${usedPercent}%` }} />
                                            </div>
                                            <span className="mt-1 block text-[11px] text-white/40">{row.limit ? `${usedPercent.toFixed(0)}%` : "--"}</span>
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </PlanningReportsPanel>
    );
}
