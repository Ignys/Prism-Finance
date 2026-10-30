import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlanningBudget, PlanningBudgetRule } from "../../context/FinanceContext";
import { DEFAULT_BUDGET_ALERT_PERCENT, getBudgetRuleKey } from "../../context/finance/planningBudgets";
import { useModal } from "../../context/ModalContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { BudgetRuleField } from "../pages/budgets/BudgetRuleField";
import { type BudgetRuleLabelResolver, type BudgetRuleOptions, getBudgetDisplayName } from "../pages/budgets/budgetRuleOptions";
import type { BudgetRuleSet } from "../pages/budgets/budgetRules";
import { BudgetRulesPreviewPanel } from "../pages/budgets/BudgetRulesPreviewPanel";
import type { BudgetRulesPreview } from "../pages/budgets/budgetUtils";
import { formatReportCurrency } from "../pages/planning/planningReportFormatting";
import { IconTextField } from "../transactions/IconTextField";
import { ModalBody, ModalCancelButton, ModalError, ModalFooter, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";
import { ModalStructure } from "./ModalStructure";

export type BudgetFormDraft = Pick<PlanningBudget, "name" | "include" | "exclude" | "amount" | "alertPercent">;

interface BudgetFormModalProps {
    initialBudget?: PlanningBudget;
    ruleOptions: BudgetRuleOptions;
    labelOf: BudgetRuleLabelResolver;
    monthLabel: string;
    /** Nome de cada orçamento já salvo, para apontar sobreposições na prévia. */
    budgetNameById: Map<string, string>;
    previewRules: (rules: BudgetRuleSet) => BudgetRulesPreview;
    suggestAmount: (rules: BudgetRuleSet) => number | null;
    onSubmit: (draft: BudgetFormDraft) => Promise<void> | void;
}

function formatAmountInput(amount: number): string {
    return formatCurrencyFromDigits(String(Math.round(amount * 100)));
}

function withoutRule(rules: PlanningBudgetRule[], rule: PlanningBudgetRule): PlanningBudgetRule[] {
    const key = getBudgetRuleKey(rule);
    return rules.filter((item) => getBudgetRuleKey(item) !== key);
}

export function BudgetFormModal({ initialBudget, ruleOptions, labelOf, monthLabel, budgetNameById, previewRules, suggestAmount, onSubmit }: BudgetFormModalProps) {
    const { closeModal } = useModal();
    const [name, setName] = useState(initialBudget?.name ?? "");
    const [include, setInclude] = useState<PlanningBudgetRule[]>(initialBudget?.include ?? []);
    const [exclude, setExclude] = useState<PlanningBudgetRule[]>(initialBudget?.exclude ?? []);
    const [amountInput, setAmountInput] = useState(initialBudget ? formatAmountInput(initialBudget.amount) : "R$ 0,00");
    const [alertPercent, setAlertPercent] = useState(initialBudget?.alertPercent ?? DEFAULT_BUDGET_ALERT_PERCENT);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const rules = useMemo(() => ({ include, exclude }), [exclude, include]);
    const preview = useMemo(() => previewRules(rules), [previewRules, rules]);
    const suggestion = useMemo(() => (include.length > 0 ? suggestAmount(rules) : null), [include.length, rules, suggestAmount]);
    const namePlaceholder = include.length > 0 ? getBudgetDisplayName({ name: "", include }, labelOf) : "Ex.: Contas da casa";

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }

        const amount = parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput));
        if (include.length === 0) {
            setError("Adicione pelo menos uma regra de despesas que entram.");
            return;
        }

        if (amount <= 0) {
            setError("Informe um teto maior que zero.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                name: name.trim(),
                include,
                exclude,
                amount,
                alertPercent,
            });
            closeModal();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar o orçamento.");
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure
            height="auto"
            width="760px"
            aside={
                include.length > 0 ? (
                    // ponytail: só cabe fora do modal a partir de 2xl (760 + 2×356px); abaixo disso a prévia fica dentro.
                    <div className="hidden rounded-xl border border-white/[0.09] bg-[#131313] shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)] 2xl:block">
                        <BudgetRulesPreviewPanel preview={preview} monthLabel={monthLabel} budgetNameById={budgetNameById} />
                    </div>
                ) : null
            }
        >
            <ModalPanel className="max-h-[90vh] text-left">
                <ModalHeader title={initialBudget ? "Editando orçamento" : "Novo orçamento"} disabled={submitting} />

                <ModalBody className="flex flex-col gap-3">
                    <section className="grid gap-4 rounded-xl border border-white/[0.1] bg-black/35 p-4 md:grid-cols-[1.1fr_1fr]">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-sm text-white/60">Teto mensal</span>
                            <input
                                className="w-full bg-transparent text-4xl font-semibold tracking-tight tabular-nums text-white outline-none placeholder:text-white/30"
                                inputMode="numeric"
                                value={amountInput}
                                onChange={(event) => setAmountInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                            />
                            {suggestion !== null ? (
                                <button
                                    type="button"
                                    onClick={() => setAmountInput(formatAmountInput(suggestion))}
                                    className="-ml-1.5 inline-flex items-center gap-1.5 self-start rounded-lg px-1.5 py-1 text-xs text-sky-200/90 transition-colors hover:bg-sky-500/10"
                                >
                                    <Sparkles size={12} />
                                    Usar a média dos últimos 3 meses: {formatReportCurrency(suggestion)}
                                </button>
                            ) : (
                                <span className="text-xs text-white/40">Adicione regras para ver uma sugestão de valor.</span>
                            )}
                        </label>

                        <label className="flex flex-col justify-between gap-2">
                            <span className="flex items-baseline justify-between gap-2 text-sm text-white/60">
                                Avisar ao atingir
                                <span className="text-base font-medium tabular-nums text-amber-200">{alertPercent}%</span>
                            </span>
                            <input
                                type="range"
                                min={50}
                                max={100}
                                step={5}
                                value={alertPercent}
                                onChange={(event) => setAlertPercent(Number(event.target.value))}
                                className="w-full accent-amber-400"
                            />
                            <span className="flex justify-between text-[11px] tabular-nums text-white/35">
                                <span>50%</span>
                                <span>100%</span>
                            </span>
                        </label>
                    </section>

                    <div className="flex flex-col gap-1">
                        <IconTextField ariaLabel="Nome do orçamento" value={name} onChange={setName} placeholder={namePlaceholder} maxLength={60} />
                        <span className="pl-1 text-[11px] text-white/40">Opcional. Sem nome, usamos a primeira regra.</span>
                    </div>

                    <BudgetRuleField
                        include={include}
                        exclude={exclude}
                        options={ruleOptions}
                        labelOf={labelOf}
                        onAdd={(tone, rule) => (tone === "include" ? setInclude : setExclude)((current) => [...current, rule])}
                        onRemove={(tone, rule) => (tone === "include" ? setInclude : setExclude)((current) => withoutRule(current, rule))}
                    />

                    {include.length > 0 ? (
                        <div className="2xl:hidden">
                            <BudgetRulesPreviewPanel preview={preview} monthLabel={monthLabel} budgetNameById={budgetNameById} />
                        </div>
                    ) : null}
                </ModalBody>

                {error ? <ModalError>{error}</ModalError> : null}

                <ModalFooter>
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton onClick={() => void handleSubmit()} disabled={submitting}>
                        {submitting ? "Salvando..." : initialBudget ? "Salvar alterações" : "Criar orçamento"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}
