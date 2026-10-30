import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../../context/ModalContext";
import { splitAmountAcrossInstallments } from "../../context/finance/helpers";
import { extractCurrencyDigits, formatCurrencyFromDigits } from "../../lib/currencyMask";
import { MonthGridPanel } from "../common/MonthGridPanel";
import { AnchoredOverlay } from "../transactions/AnchoredOverlay";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { IconTextField } from "../transactions/IconTextField";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { ModalBody, ModalCancelButton, ModalFooter, ModalHeader, ModalPanel } from "./ModalChrome";
import { ModalStructure } from "./ModalStructure";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

export interface PlanningSimulationModalDraft {
    description: string;
    amountInput: string;
    monthKey: string;
    tone: "income" | "expense";
    /** Preenchido (>= 2) só para despesa parcelada; `amountInput` é o valor total. */
    installmentCount: number | null;
}

interface PlanningSimulationModalInitialValues {
    description: string;
    amount: number;
    monthKey: string;
    tone: "income" | "expense";
    installmentCount?: number;
}

type PlanningSimulationKind = "income" | "expense" | "installment_expense";

interface PlanningSimulationModalProps {
    tone: "income" | "expense";
    monthKey: string;
    initialValues?: PlanningSimulationModalInitialValues;
    title?: string;
    onSubmit: (draft: PlanningSimulationModalDraft) => Promise<void> | void;
}

interface PlanningToneOption extends ComboboxOptionBase {
    id: PlanningSimulationKind;
    tone: "income" | "expense";
    icon: typeof ArrowUpRight;
}

const PLANNING_TONE_OPTIONS: PlanningToneOption[] = [
    {
        id: "income",
        label: "Receita",
        searchText: "receita entrada ganho income",
        tone: "income",
        icon: ArrowUpRight,
    },
    {
        id: "expense",
        label: "Despesa",
        searchText: "despesa gasto saida expense",
        tone: "expense",
        icon: ArrowDownRight,
    },
    {
        id: "installment_expense",
        label: "Despesa parcelada",
        searchText: "despesa parcelada parcelas parcelamento installment",
        tone: "expense",
        icon: Layers,
    },
];

const DEFAULT_INSTALLMENT_COUNT_INPUT = "2";

function isPlanningSimulationKind(value: string): value is PlanningSimulationKind {
    return PLANNING_TONE_OPTIONS.some((option) => option.id === value);
}

function resolveInitialKind(tone: "income" | "expense", initialValues?: PlanningSimulationModalInitialValues): PlanningSimulationKind {
    if (!initialValues) {
        return tone;
    }

    return initialValues.tone === "expense" && initialValues.installmentCount ? "installment_expense" : initialValues.tone;
}

function capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseMonthKey(monthKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return new Date(year, month - 1, 1);
}


export function formatMonthDisplay(monthKey: string): string {
    const parsed = parseMonthKey(monthKey);
    if (!parsed) {
        return "Selecione um mes";
    }

    return capitalizeLabel(MONTH_LABEL_FORMATTER.format(parsed));
}

function formatAmountInputFromNumber(amount: number): string {
    const cents = Math.round(Math.max(0, Math.abs(amount)) * 100);
    return formatCurrencyFromDigits(String(cents));
}

export function PlanningMonthField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current || containerRef.current.contains(event.target as Node) || overlayRef.current?.contains(event.target as Node)) {
                return;
            }

            setIsOpen(false);
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscapeKey);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className="relative flex flex-col">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-[50px] w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 text-left text-sm text-white transition-colors hover:border-white/[0.2] focus-visible:border-white/[0.26] focus-visible:outline-none"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label="Mês"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <TransactionFieldIcon icon={CalendarDays} className="text-emerald-200/85" />
                    <span className="truncate">{formatMonthDisplay(value)}</span>
                </span>
                <ChevronDown size={15} className={`shrink-0 text-white/65 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnchoredOverlay
                anchorRef={triggerRef}
                overlayRef={overlayRef}
                isOpen={isOpen}
                overlayWidth={240}
                className="rounded-2xl border border-white/[0.1] bg-[#0e0e0e]/95 p-2.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
                <MonthGridPanel
                    selectedMonth={value}
                    onMonthChange={(monthKey) => {
                        onChange(monthKey);
                        setIsOpen(false);
                    }}
                />
            </AnchoredOverlay>
        </div>
    );
}

function PlanningToneOptionContent({ option }: { option: PlanningToneOption }) {
    const Icon = option.icon;
    const iconClassName =
        option.tone === "income"
            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
            : "border-red-400/25 bg-red-500/10 text-red-200";

    return (
        <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${iconClassName}`}>
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function PlanningSimulationModal({ tone, monthKey, initialValues, title = "Nova projeção", onSubmit }: PlanningSimulationModalProps) {
    const { closeModal } = useModal();
    const [selectedKind, setSelectedKind] = useState<PlanningSimulationKind>(() => resolveInitialKind(tone, initialValues));
    const [installmentCountInput, setInstallmentCountInput] = useState(String(initialValues?.installmentCount ?? DEFAULT_INSTALLMENT_COUNT_INPUT));
    const [selectedMonthKey, setSelectedMonthKey] = useState(initialValues?.monthKey ?? monthKey);
    const [description, setDescription] = useState(initialValues?.description ?? "");
    const [amountInput, setAmountInput] = useState(initialValues ? formatAmountInputFromNumber(initialValues.amount) : "R$ 0,00");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const selectedTone = selectedKind === "income" ? "income" : "expense";
    const isInstallment = selectedKind === "installment_expense";
    const installmentCount = Number(installmentCountInput);
    const amountCents = Number(extractCurrencyDigits(amountInput) || "0");
    const installmentAmounts =
        isInstallment && Number.isInteger(installmentCount) && installmentCount >= 2 && amountCents >= installmentCount
            ? splitAmountAcrossInstallments(amountCents / 100, installmentCount)
            : null;
    const descriptionPlaceholder = selectedTone === "income" ? "Descrição da receita" : "Descrição do gasto";
    const submitClassName = "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20";

    useEffect(() => {
        setSelectedKind(resolveInitialKind(tone, initialValues));
        setInstallmentCountInput(String(initialValues?.installmentCount ?? DEFAULT_INSTALLMENT_COUNT_INPUT));
        setSelectedMonthKey(initialValues?.monthKey ?? monthKey);
        setDescription(initialValues?.description ?? "");
        setAmountInput(initialValues ? formatAmountInputFromNumber(initialValues.amount) : "R$ 0,00");
        setError(null);
        setSubmitting(false);
    }, [initialValues, monthKey, tone]);

    const handleAmountChange = (value: string) => {
        setAmountInput(formatCurrencyFromDigits(extractCurrencyDigits(value)));
    };

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }

        if (extractCurrencyDigits(amountInput) === "" || /^0+$/.test(extractCurrencyDigits(amountInput))) {
            setError("Informe um valor para salvar a simulacao.");
            return;
        }

        if (!selectedMonthKey.trim()) {
            setError("Selecione um mes valido.");
            return;
        }

        if (isInstallment && !installmentAmounts) {
            setError("Informe pelo menos 2 parcelas, cada uma com valor de pelo menos R$ 0,01.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                description,
                amountInput,
                monthKey: selectedMonthKey,
                tone: selectedTone,
                installmentCount: isInstallment ? installmentCount : null,
            });
            closeModal();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : "Nao foi possivel salvar a simulacao.";
            setError(message);
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure height="auto" width="600px">
            <ModalPanel>
                <ModalHeader title={title} disabled={submitting} />

                <ModalBody className="flex flex-col gap-2">
                    <input
                        aria-label="Valor"
                        className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl tabular-nums text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={amountInput}
                        onChange={(event) => handleAmountChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                void handleSubmit();
                            }
                        }}
                    />

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <PlanningMonthField value={selectedMonthKey} onChange={setSelectedMonthKey} />

                        <SingleSelectCombobox
                            disableSearch
                            hideLabel
                            label="Tipo"
                            value={selectedKind}
                            placeholder="Selecione um tipo"
                            emptyMessage="Nenhum tipo encontrado."
                            options={PLANNING_TONE_OPTIONS}
                            onChange={(value) => setSelectedKind(isPlanningSimulationKind(value) ? value : "expense")}
                            renderOptionContent={(option) => <PlanningToneOptionContent option={option} />}
                        />
                    </div>

                    {isInstallment ? (
                        <div className="flex flex-col gap-1">
                            <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                                <TransactionFieldIcon icon={Layers} />
                                <span className="flex-1 text-sm text-white/70">Quantidade de parcelas</span>
                                <input
                                    aria-label="Quantidade de parcelas"
                                    className="w-16 rounded-lg border border-white/[0.12] bg-black/30 px-2 py-1 text-right text-sm tabular-nums text-white outline-none focus:border-white/[0.24]"
                                    type="number"
                                    min={2}
                                    step={1}
                                    value={installmentCountInput}
                                    onChange={(event) => setInstallmentCountInput(event.target.value)}
                                />
                            </label>
                            <p className="pl-1 text-xs text-white/50">
                                {installmentAmounts
                                    ? `Valor total dividido em ${installmentAmounts.length}x de ${formatAmountInputFromNumber(installmentAmounts[0])}, a partir do mês selecionado.`
                                    : "O valor informado é o total, dividido mês a mês a partir do mês selecionado."}
                            </p>
                        </div>
                    ) : null}

                    <IconTextField ariaLabel="Descrição" value={description} onChange={setDescription} placeholder={descriptionPlaceholder} />
                </ModalBody>

                {error ? <p className="mt-3 pl-1 text-sm text-amber-200/90">{error}</p> : null}

                <ModalFooter>
                    <ModalCancelButton disabled={submitting} />
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className={`inline-flex min-w-28 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${submitClassName}`}
                    >
                        {submitting ? "Salvando..." : "Salvar"}
                    </button>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}
