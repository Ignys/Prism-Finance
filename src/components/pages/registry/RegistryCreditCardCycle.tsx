import { daysUntilMonthDay } from "./creditCardCycle";

interface RegistryCreditCardCycleProps {
    closingDay: number;
    dueDay: number;
    color: string;
    isActive: boolean;
}

function CycleDot({ isNext, color }: { isNext: boolean; color: string }) {
    return (
        <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full border"
            style={isNext ? { backgroundColor: color, borderColor: color, boxShadow: `0 0 0 3px ${color}33` } : { borderColor: "rgba(255,255,255,0.3)" }}
        />
    );
}

export function RegistryCreditCardCycle({ closingDay, dueDay, color, isActive }: RegistryCreditCardCycleProps) {
    const untilClosing = daysUntilMonthDay(closingDay);
    const untilDue = daysUntilMonthDay(dueDay);
    const closingIsNext = isActive && untilClosing <= untilDue;
    const dueIsNext = isActive && !closingIsNext;

    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {!isActive ? <span>Arquivado</span> : null}
            <span className="inline-flex items-center gap-2">
                <CycleDot isNext={closingIsNext} color={color} />
                <span className={closingIsNext ? "text-white/85" : ""}>
                    Fecha <span className="tabular-nums">{closingDay}</span>
                </span>
                <span aria-hidden="true" className="h-px w-5 bg-white/20" />
                <CycleDot isNext={dueIsNext} color={color} />
                <span className={dueIsNext ? "text-white/85" : ""}>
                    vence <span className="tabular-nums">{dueDay}</span>
                </span>
            </span>
        </span>
    );
}
