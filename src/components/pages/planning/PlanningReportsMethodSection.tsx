import { useState } from "react";
import { CreditCard, ReceiptText, WalletCards } from "lucide-react";
import { PlanningReportsPanel, REPORT_MONO_STYLE } from "./PlanningReportsPanel";
import { formatReportCurrency } from "./planningReportFormatting";
import type { MethodReport } from "./planningReportsUtils";

interface PlanningReportsMethodSectionProps {
    methodReports: MethodReport[];
}

// Mesmas cores das contas no seletor: carteira âmbar, cartão roxo, fatura de outro cartão cinza.
const METHOD_STYLE = {
    wallet: { color: "#fcd34d", Icon: WalletCards, hint: "Saiu direto do saldo das carteiras" },
    credit_card: { color: "#8b5cf6", Icon: CreditCard, hint: "Compras nos cartões selecionados" },
    invoice_payment: { color: "#d6d3d1", Icon: ReceiptText, hint: "Faturas pagas de cartões fora da seleção" },
} as const;

export function PlanningReportsMethodSection({ methodReports }: PlanningReportsMethodSectionProps) {
    const total = methodReports.reduce((sum, method) => sum + method.amount, 0);
    const ordered = [...methodReports].sort((a, b) => b.amount - a.amount);
    const [activeKey, setActiveKey] = useState<MethodReport["key"] | null>(null);
    const percentOf = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);

    return (
        <PlanningReportsPanel title="Formas de pagamento" aside={<span className="text-sm text-white/70" style={REPORT_MONO_STYLE}>{formatReportCurrency(total)}</span>}>
            {/* Uma barra só dividida pelas formas; a legenda embaixo traz os números. Foco numa fatia ou linha destaca o par. */}
            <div className="flex h-4 gap-[3px] overflow-hidden rounded-full" onMouseLeave={() => setActiveKey(null)}>
                {ordered.map((method) => (
                    <span
                        key={method.key}
                        className={`h-full transition-opacity first:rounded-l-full last:rounded-r-full ${activeKey && activeKey !== method.key ? "opacity-30" : ""}`}
                        style={{ width: `${percentOf(method.amount)}%`, backgroundColor: METHOD_STYLE[method.key].color }}
                        onMouseEnter={() => setActiveKey(method.key)}
                        title={`${method.label}: ${percentOf(method.amount).toFixed(0)}%`}
                    />
                ))}
            </div>

            <ul className="mt-5 flex flex-1 flex-col divide-y divide-white/[0.06]" onMouseLeave={() => setActiveKey(null)}>
                {ordered.map((method) => {
                    const { Icon, color, hint } = METHOD_STYLE[method.key];
                    return (
                        <li
                            key={method.key}
                            title={hint}
                            onMouseEnter={() => setActiveKey(method.key)}
                            className={`flex items-center gap-3 py-3 transition-opacity first:pt-0 last:pb-0 ${activeKey && activeKey !== method.key ? "opacity-45" : ""}`}
                        >
                            <Icon size={16} className="shrink-0" style={{ color }} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-white/85">{method.label}</p>
                                <p className="text-[11px] text-white/40">
                                    {method.count} {method.count === 1 ? "lançamento" : "lançamentos"}
                                </p>
                            </div>
                            <div className="shrink-0 text-right" style={REPORT_MONO_STYLE}>
                                <p className="text-sm text-white">{formatReportCurrency(method.amount)}</p>
                                <p className="text-[11px]" style={{ color }}>
                                    {percentOf(method.amount).toFixed(0)}%
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </PlanningReportsPanel>
    );
}
