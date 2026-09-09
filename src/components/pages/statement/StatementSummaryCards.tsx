import { CreditCard, TrendingDown, Wallet } from "lucide-react";
import type { SummaryCardData } from "../../common/SummaryCard";
import { SummaryCardsGrid } from "../../common/SummaryCard";
import type { StatementSummary } from "./statementPageShared";
import { formatCurrency } from "./statementPageShared";

interface StatementSummaryCardsProps {
    summary: StatementSummary;
}

export function StatementSummaryCards({ summary }: StatementSummaryCardsProps) {
    const cards: SummaryCardData[] = [
        {
            id: "invoice-value",
            title: "Valor da fatura",
            value: formatCurrency(summary.spentInMonth),
            badge: summary.transactionCountInMonth,
            tone: "negative",
            icon: TrendingDown,
        },
        {
            id: "available-limit",
            title: "Limite disponivel",
            value: formatCurrency(summary.availableLimitEstimate),
            tone: "positive",
            icon: Wallet,
        },
        {
            id: "total-limit",
            title: "Limite total",
            value: formatCurrency(summary.limitTotalScope),
            tone: "neutral",
            icon: CreditCard,
        },
    ];

    return <SummaryCardsGrid cards={cards} />;
}