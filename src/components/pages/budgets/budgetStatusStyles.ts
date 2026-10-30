import type { BudgetStatus } from "./budgetUtils";

interface BudgetStatusStyle {
    label: string;
    chipClassName: string;
    barClassName: string;
    forecastBarClassName: string;
    dotClassName: string;
    textClassName: string;
}

export const BUDGET_STATUS_STYLES: Record<BudgetStatus, BudgetStatusStyle> = {
    ok: {
        label: "Dentro do teto",
        chipClassName: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        barClassName: "bg-emerald-400/85",
        forecastBarClassName: "bg-emerald-400/30",
        dotClassName: "bg-emerald-400",
        textClassName: "text-emerald-200",
    },
    warning: {
        label: "Atenção",
        chipClassName: "border-amber-400/25 bg-amber-500/10 text-amber-200",
        barClassName: "bg-amber-400/85",
        forecastBarClassName: "bg-amber-400/30",
        dotClassName: "bg-amber-400",
        textClassName: "text-amber-200",
    },
    at_risk: {
        label: "Vai estourar",
        chipClassName: "border-orange-400/25 bg-orange-500/10 text-orange-200",
        barClassName: "bg-orange-400/85",
        forecastBarClassName: "bg-orange-400/35",
        dotClassName: "bg-orange-400",
        textClassName: "text-orange-200",
    },
    exceeded: {
        label: "Estourado",
        chipClassName: "border-red-400/30 bg-red-500/10 text-red-200",
        barClassName: "bg-red-400/90",
        forecastBarClassName: "bg-red-400/35",
        dotClassName: "bg-red-400",
        textClassName: "text-red-200",
    },
};
