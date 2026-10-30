import { PlanningReportsLineSection } from "./PlanningReportsLineSection";
import type { BalancePoint } from "./planningAccountReports";

export function PlanningReportsBalanceSection({ points }: { points: BalancePoint[] }) {
    return <PlanningReportsLineSection title="Saldo final" color="#fcd34d" points={points.map((point) => ({ ...point, value: point.balance }))} />;
}
