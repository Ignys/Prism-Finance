import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits } from "../../lib/currencyMask";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "../transactions/transactionForm.constants";
import { ModalStructure } from "./ModalStructure";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
});

interface PlanningSimulationModalProps {
    tone: "income" | "expense";
    monthKey: string;
    onSubmit: (draft: { description: string; amountInput: string; monthKey: string; tone: "income" | "expense" }) => Promise<void> | void;
}

interface PlanningToneOption extends ComboboxOptionBase {
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
];

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

function formatMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function formatMonthDisplay(monthKey: string): string {
    const parsed = parseMonthKey(monthKey);
    if (!parsed) {
        return "Selecione um mes";
    }

    return capitalizeLabel(MONTH_LABEL_FORMATTER.format(parsed));
}

function PlanningMonthField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const selectedMonth = useMemo(() => parseMonthKey(value), [value]);
    const [isOpen, setIsOpen] = useState(false);
    const [visibleYear, setVisibleYear] = useState(() => (selectedMonth ?? new Date()).getFullYear());
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!selectedMonth) {
            return;
        }

        setVisibleYear(selectedMonth.getFullYear());
    }, [selectedMonth]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current || containerRef.current.contains(event.target as Node)) {
                return;
            }

            setIsOpen(false);
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscapeKey);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscapeKey);
        };
    }, [isOpen]);

    const monthOptions = useMemo(
        () =>
            Array.from({ length: 12 }, (_, index) => {
                const date = new Date(visibleYear, index, 1);
                const monthKey = formatMonthKey(date);
                return {
                    monthKey,
                    label: capitalizeLabel(new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "")),
                };
            }),
        [visibleYear],
    );

    return (
        <div ref={containerRef} className="relative flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Mês</span>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-[50px] w-full items-center justify-between rounded-xl border border-white/[0.1] bg-black/35 px-3 text-left text-sm text-white transition-colors hover:border-white/[0.2] focus-visible:border-white/[0.26] focus-visible:outline-none"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays size={15} className="shrink-0 text-emerald-200/85" />
                    <span className="truncate">{formatMonthDisplay(value)}</span>
                </span>
                <ChevronDown size={15} className={`shrink-0 text-white/65 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-white/[0.12] bg-[#141414] p-2 shadow-[0_20px_50px_-26px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setVisibleYear((currentYear) => currentYear - 1)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                            aria-label="Ano anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <span className="text-sm font-medium text-white/90">{visibleYear}</span>

                        <button
                            type="button"
                            onClick={() => setVisibleYear((currentYear) => currentYear + 1)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white"
                            aria-label="Proximo ano"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {monthOptions.map((monthOption) => {
                            const isSelected = monthOption.monthKey === value;
                            return (
                                <button
                                    key={monthOption.monthKey}
                                    type="button"
                                    onClick={() => {
                                        onChange(monthOption.monthKey);
                                        setIsOpen(false);
                                    }}
                                    className={`rounded-lg border px-2 py-2 text-xs font-medium uppercase tracking-[0.08em] transition-colors ${
                                        isSelected
                                            ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100"
                                            : "border-white/[0.15] bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                                    }`}
                                >
                                    {monthOption.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
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

export function PlanningSimulationModal({ tone, monthKey, onSubmit }: PlanningSimulationModalProps) {
    const { closeModal } = useModal();
    const [selectedTone, setSelectedTone] = useState<"income" | "expense">(tone);
    const [selectedMonthKey, setSelectedMonthKey] = useState(monthKey);
    const [description, setDescription] = useState("");
    const [amountInput, setAmountInput] = useState("R$ 0,00");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const descriptionPlaceholder = selectedTone === "income" ? "Descrição da receita" : "Descrição do gasto";
    const submitClassName = "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20"

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

        setSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                description,
                amountInput,
                monthKey: selectedMonthKey,
                tone: selectedTone,
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
            <div className="rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <header className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm ml-1 uppercase opacity-50">Nova projeção</h2>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>

                <section className="mt-4 flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                        <input
                            className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24]"
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
                    </label>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <PlanningMonthField value={selectedMonthKey} onChange={setSelectedMonthKey} />

                        <SingleSelectCombobox
                            disableSearch
                            label="Tipo"
                            value={selectedTone}
                            placeholder="Selecione um tipo"
                            emptyMessage="Nenhum tipo encontrado."
                            options={PLANNING_TONE_OPTIONS}
                            onChange={(value) => {
                                if (value === "income" || value === "expense") {
                                    setSelectedTone(value);
                                    return;
                                }

                                setSelectedTone("expense");
                            }}
                            renderOptionContent={(option) => <PlanningToneOptionContent option={option} />}
                            labelClassName={FIELD_LABEL_CLASS}
                        />
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Descricao</span>
                        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={descriptionPlaceholder} className={FIELD_INPUT_CLASS} />
                    </label>
                </section>

                {error ? <p className="mt-3 text-sm text-amber-200/90">{error}</p> : null}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className={`inline-flex min-w-32 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${submitClassName}`}
                    >
                        {submitting ? "Salvando..." : "Salvar"}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
