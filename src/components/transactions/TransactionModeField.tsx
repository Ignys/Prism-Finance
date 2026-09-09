import { CalendarRange, ReceiptText, Repeat, type LucideIcon } from "lucide-react";
import type { TransactionMode } from "../../context/FinanceContext";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";

interface TransactionModeOption extends ComboboxOptionBase {
    icon: LucideIcon;
}

const TRANSACTION_MODE_OPTIONS: TransactionModeOption[] = [
    { id: "single", label: "Única", searchText: "unica avulsa single", icon: ReceiptText },
    { id: "installment", label: "Parcelada", searchText: "parcelada parcelas installment", icon: CalendarRange },
    { id: "fixed", label: "Fixa mensal", searchText: "fixa mensal", icon: Repeat },
    { id: "recurring", label: "Recorrente", searchText: "recorrente quantidade meses", icon: Repeat },
];

interface TransactionModeFieldProps {
    mode: TransactionMode;
    installmentCountInput: string;
    onModeChange: (mode: TransactionMode) => void;
    onInstallmentCountChange: (value: string) => void;
    recurrenceCountInput: string;
    onRecurrenceCountChange: (value: string) => void;
    hideInstallmentCount?: boolean;
    disabled?: boolean;
}

function TransactionModeOptionContent({ option }: { option: TransactionModeOption }) {
    const Icon = option.icon;

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80">
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function TransactionModeField({
    mode,
    installmentCountInput,
    onModeChange,
    onInstallmentCountChange,
    recurrenceCountInput,
    onRecurrenceCountChange,
    hideInstallmentCount = false,
    disabled = false,
}: TransactionModeFieldProps) {
    const normalizeInstallmentCount = () => {
        const count = Number(installmentCountInput);
        onInstallmentCountChange(Number.isInteger(count) && count >= 2 ? String(count) : "2");
    };

    return (
        <div className="flex flex-col gap-2">
            <SingleSelectCombobox
                disableSearch
                label="Tipo"
                value={mode === "recurring" && !recurrenceCountInput ? "fixed" : mode}
                placeholder="Selecione um modo"
                emptyMessage="Nenhum modo encontrado."
                options={TRANSACTION_MODE_OPTIONS}
                onChange={(value) => {
                    if (value === "fixed" || value === "recurring") {
                        onRecurrenceCountChange(value === "fixed" ? "" : recurrenceCountInput || "6");
                        onModeChange("recurring");
                        return;
                    }
                    if (value === "installment" || value === "single") {
                        onModeChange(value);
                    }
                }}
                renderOptionContent={(option) => <TransactionModeOptionContent option={option} />}
                hideLabel
                disabled={disabled}
            />

            {mode === "recurring" && recurrenceCountInput !== "" && (
                <label className="flex flex-col gap-1.5 rounded-xl border border-dashed border-white/[0.1] bg-black/20 p-3">
                    <span className={FIELD_LABEL_CLASS}>Quantidade de meses</span>
                    <input className={FIELD_INPUT_CLASS} type="number" min={1} step={1} value={recurrenceCountInput} onChange={(event) => onRecurrenceCountChange(event.target.value || "0")} disabled={disabled} />
                    <span className="text-xs text-white/45">O valor inteiro se repete em cada mês.</span>
                </label>
            )}
            {mode === "installment" && !hideInstallmentCount && (
                <label className="flex flex-col gap-1.5 rounded-xl border border-dashed border-white/[0.1] bg-black/20 p-3">
                    <span className={FIELD_LABEL_CLASS}>Quantidade de parcelas</span>
                    <input
                        className={FIELD_INPUT_CLASS}
                        type="number"
                        min={2}
                        step={1}
                        inputMode="numeric"
                        value={installmentCountInput}
                        onChange={(event) => onInstallmentCountChange(event.target.value)}
                        onBlur={normalizeInstallmentCount}
                        disabled={disabled}
                    />
                    <span className="text-xs leading-relaxed text-white/45">
                        O valor total será dividido entre as parcelas, uma por mês a partir da data informada.
                    </span>
                </label>
            )}
        </div>
    );
}
