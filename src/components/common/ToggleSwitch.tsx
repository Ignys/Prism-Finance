interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
}

/** Toggle on/off padrão do app (substitui checkboxes). `label` é usado como nome acessível. */
export function ToggleSwitch({ checked, onChange, label, disabled = false }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                checked ? "border-emerald-400/45 bg-emerald-500/20" : "border-white/[0.14] bg-white/[0.06]"
            }`}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );
}
