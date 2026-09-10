interface CardCommitmentFieldProps {
    value: "forecast" | "posted";
    onChange: (value: "forecast" | "posted") => void;
    disabled?: boolean;
    postedDisabled?: boolean;
}

export function CardCommitmentField({ value, onChange, disabled = false, postedDisabled = false }: CardCommitmentFieldProps) {
    return (
        <div aria-label="Status do gasto no cartão" className="flex gap-1 rounded-xl border border-white/[0.1] bg-black/35 p-1">
            <button
                type="button"
                onClick={() => onChange("forecast")}
                disabled={disabled}
                title="Ainda não foi efetivamente lançado no cartão"
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    value === "forecast" ? "bg-amber-500/20 text-amber-200" : "text-white/65 hover:bg-white/[0.06]"
                }`}
            >
                Previsto
            </button>
            <button
                type="button"
                onClick={() => onChange("posted")}
                disabled={disabled || postedDisabled}
                title={postedDisabled ? "Ocorrências recorrentes futuras permanecem previstas até a data programada" : "Já compõe a fatura e o limite utilizado"}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    value === "posted" ? "bg-emerald-500/20 text-emerald-200" : "text-white/65 hover:bg-white/[0.06]"
                }`}
            >
                Lançado
            </button>
        </div>
    );
}
