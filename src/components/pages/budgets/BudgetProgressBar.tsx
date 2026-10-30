import { BUDGET_STATUS_STYLES } from "./budgetStatusStyles";
import type { BudgetProgress } from "./budgetUtils";

function toPercentOfScale(value: number, scale: number): string {
    return `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;
}

/** Barra realizado + previsto; acima do teto a escala cresce e o teto vira um marcador. */
export function BudgetProgressBar({ progress, className = "h-2" }: { progress: BudgetProgress; className?: string }) {
    const { budget, spent, projected, status } = progress;
    const styles = BUDGET_STATUS_STYLES[status];
    const scale = Math.max(budget.amount, projected);
    const alertAmount = (budget.amount * budget.alertPercent) / 100;

    return (
        <div
            className={`relative overflow-hidden rounded-full bg-white/[0.06] ${className}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={budget.amount}
            aria-valuenow={spent}
            aria-label="Uso do orçamento"
        >
            <div className={`absolute inset-y-0 left-0 rounded-full ${styles.forecastBarClassName}`} style={{ width: toPercentOfScale(projected, scale) }} />
            <div className={`absolute inset-y-0 left-0 rounded-full ${styles.barClassName}`} style={{ width: toPercentOfScale(spent, scale) }} />
            {budget.alertPercent < 100 ? (
                <span className="absolute inset-y-0 w-px bg-white/35" style={{ left: toPercentOfScale(alertAmount, scale) }} title={`Alerta em ${budget.alertPercent}%`} />
            ) : null}
            {scale > budget.amount ? <span className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: toPercentOfScale(budget.amount, scale) }} title="Teto" /> : null}
        </div>
    );
}
