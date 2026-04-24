import { motion } from "framer-motion";
import type { PlanningSummary } from "./planningPageShared";
import { formatCurrency } from "./planningPageShared";

interface PlanningSummaryCardsProps {
    summary: PlanningSummary;
}

interface MetricCardItem {
    id: string;
    label: string;
    value: number;
    helper?: string;
    valueClassName?: string;
}

function resolveBalanceClassName(value: number): string {
    if (value < 0) {
        return "text-red-300";
    }

    if (value > 0) {
        return "text-emerald-300";
    }

    return "text-white";
}

function buildMetricCards(summary: PlanningSummary): MetricCardItem[] {
    const withSimulation = summary.projectedEndBalanceWithSimulation;
    const delta = summary.simulation.deltaVsBase;
    const impactHelper =
        summary.simulation.isValid && summary.simulation.deltaPercentVsBase !== null
            ? `${summary.simulation.deltaPercentVsBase.toFixed(1)}% vs base`
            : summary.simulation.isValid
              ? "Impacto absoluto no mes"
              : "Sem simulacao ativa";

    return [
        {
            id: "start-balance",
            label: "Saldo no inicio",
            value: summary.projection.startBalance,
            valueClassName: resolveBalanceClassName(summary.projection.startBalance),
        },
        {
            id: "income",
            label: `Receitas previstas (${summary.projection.incomeCount})`,
            value: summary.projection.incomesInMonth,
            valueClassName: "text-emerald-200",
        },
        {
            id: "spending",
            label: `Despesas previstas (${summary.projection.spendingCount})`,
            value: summary.projection.walletSpendingsInMonth,
            valueClassName: "text-red-200",
        },
        {
            id: "invoices",
            label: `Faturas em aberto (${summary.projection.invoiceCount})`,
            value: summary.projection.openInvoicesDueInMonth,
            valueClassName: "text-amber-200",
        },
        {
            id: "base-end-balance",
            label: "Saldo final previsto",
            value: summary.projection.projectedEndBalance,
            valueClassName: resolveBalanceClassName(summary.projection.projectedEndBalance),
        },
        {
            id: "simulation-impact",
            label: "Impacto da simulacao",
            value: summary.simulation.isValid ? Math.abs(summary.simulation.impactInSelectedMonth) : 0,
            helper: impactHelper,
            valueClassName: summary.simulation.isValid ? "text-orange-200" : "text-white/60",
        },
        {
            id: "simulation-end-balance",
            label: "Saldo final com simulacao",
            value: withSimulation,
            helper: summary.simulation.isValid ? `Delta: ${delta >= 0 ? "+" : ""}${formatCurrency(delta)}` : "Sem impacto aplicado",
            valueClassName: resolveBalanceClassName(withSimulation),
        },
    ];
}

export function PlanningSummaryCards({ summary }: PlanningSummaryCardsProps) {
    const cards = buildMetricCards(summary);

    return (
        <section className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
            {cards.map((card, index) => (
                <motion.article
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                    className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left"
                >
                    <div className="pointer-events-none absolute -bottom-24 -right-20 h-36 w-36 rounded-full bg-white/[0.05] blur-3xl" />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/38">{card.label}</p>
                    <p className={`mt-1 text-xl font-semibold ${card.valueClassName ?? "text-white"}`}>{formatCurrency(card.value)}</p>
                    {card.helper && <p className="mt-1 text-xs text-white/52">{card.helper}</p>}
                </motion.article>
            ))}
        </section>
    );
}
