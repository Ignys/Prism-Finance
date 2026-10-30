import { Ban, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PlanningBudgetRule } from "../../../context/FinanceContext";
import { normalizeComparisonText } from "../../../context/finance/helpers";
import { getBudgetRuleKey } from "../../../context/finance/planningBudgets";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { AnchoredOverlay } from "../../transactions/AnchoredOverlay";
import { BUDGET_RULE_KIND_BY_ID, BUDGET_RULE_KINDS, createBudgetRuleResolver, type BudgetRuleLabelResolver, type BudgetRuleOptions, type BudgetRuleValueOption } from "./budgetRuleOptions";

export type BudgetRuleTone = "include" | "exclude";

interface BudgetRuleFieldProps {
    include: PlanningBudgetRule[];
    exclude: PlanningBudgetRule[];
    options: BudgetRuleOptions;
    labelOf: BudgetRuleLabelResolver;
    onAdd: (tone: BudgetRuleTone, rule: PlanningBudgetRule) => void;
    onRemove: (tone: BudgetRuleTone, rule: PlanningBudgetRule) => void;
}

type RuleVisual = Pick<BudgetRuleValueOption, "iconName" | "color">;

interface RuleResult extends RuleVisual {
    id: string;
    rule: PlanningBudgetRule;
    label: string;
    context: string | null;
    isSubcategory: boolean;
    groupLabel: string;
}

const CHIP_CLASS: Record<BudgetRuleTone, string> = {
    include: "border-emerald-400/30 bg-emerald-500/10 text-emerald-50 hover:border-emerald-300/60",
    exclude: "border-red-400/30 bg-red-500/10 text-red-100 hover:border-red-300/60",
};

function RuleIcon({ visual, size, className }: { visual: RuleVisual; size: number; className: string }) {
    const Icon = getCategoryIconComponent(visual.iconName, "expense");

    return (
        <span className={`inline-flex shrink-0 items-center justify-center border border-white/[0.1] bg-white/[0.05] ${className}`} style={visual.color ? { color: visual.color } : undefined}>
            <Icon size={size} />
        </span>
    );
}

function buildResults(options: BudgetRuleOptions, usedRuleKeys: Set<string>, query: string): RuleResult[] {
    const normalizedQuery = normalizeComparisonText(query.trim());
    const results: RuleResult[] = [];

    for (const { kind, groupLabel } of BUDGET_RULE_KINDS) {
        if (kind === "text") {
            continue;
        }

        for (const option of options[kind]) {
            // O nome do grupo entra na busca: digitar "cartão" lista os cartões.
            if (usedRuleKeys.has(option.id) || (normalizedQuery && !normalizeComparisonText(`${option.searchText} ${groupLabel}`).includes(normalizedQuery))) {
                continue;
            }
            results.push({ ...option, groupLabel });
        }
    }

    const text = query.trim();
    const textRule: PlanningBudgetRule = { kind: "text", text };
    if (text && !usedRuleKeys.has(getBudgetRuleKey(textRule))) {
        results.push({ id: getBudgetRuleKey(textRule), rule: textRule, label: `Descrição contém “${text}”`, context: null, isSubcategory: false, groupLabel: BUDGET_RULE_KIND_BY_ID.text.groupLabel, iconName: "type", color: null });
    }

    return results;
}

/** Exemplos com nomes reais do usuário, ex.: "Mercado, Nubank ou um texto como “uber”". */
function buildPlaceholder(options: BudgetRuleOptions): string {
    const examples = [options.category.find((option) => !option.isSubcategory), options.creditCard[0] ?? options.wallet[0]].filter(Boolean).map((option) => option?.label);
    return examples.length > 0 ? `Ex.: ${examples.join(", ")} ou um texto como “uber”` : "Ex.: um texto da descrição, como “uber”";
}

export function BudgetRuleField({ include, exclude, options, labelOf, onAdd, onRemove }: BudgetRuleFieldProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const fieldRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const { visualOf } = useMemo(() => createBudgetRuleResolver(options), [options]);
    const usedRuleKeys = useMemo(() => new Set([...include, ...exclude].map(getBudgetRuleKey)), [exclude, include]);
    const results = useMemo(() => buildResults(options, usedRuleKeys, query), [options, query, usedRuleKeys]);
    const placeholder = useMemo(() => buildPlaceholder(options), [options]);
    const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
    const hasRules = include.length + exclude.length > 0;

    useEffect(() => {
        if (isOpen) {
            document.getElementById(`${listId}-${safeIndex}`)?.scrollIntoView({ block: "nearest" });
        }
    }, [isOpen, listId, safeIndex]);

    const choose = (result: RuleResult, tone: BudgetRuleTone) => {
        onAdd(tone, result.rule);
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.focus();
    };

    const flip = (tone: BudgetRuleTone, rule: PlanningBudgetRule) => {
        onRemove(tone, rule);
        onAdd(tone === "include" ? "exclude" : "include", rule);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp": {
                event.preventDefault();
                setIsOpen(true);
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((safeIndex + step + results.length) % Math.max(results.length, 1));
                break;
            }
            case "Enter":
                event.preventDefault();
                if (isOpen && results[safeIndex]) {
                    choose(results[safeIndex], event.shiftKey ? "exclude" : "include");
                }
                break;
            case "Escape":
                setIsOpen(false);
                break;
            case "Backspace":
                if (!query) {
                    const [tone, rules] = exclude.length > 0 ? (["exclude", exclude] as const) : (["include", include] as const);
                    if (rules.length > 0) {
                        onRemove(tone, rules[rules.length - 1]);
                    }
                }
                break;
        }
    };

    const renderChip = (tone: BudgetRuleTone, rule: PlanningBudgetRule) => {
        const label = labelOf(rule);
        const target = tone === "include" ? "deixar de fora" : "fazer entrar";

        return (
            <span key={`${tone}:${getBudgetRuleKey(rule)}`} className={`inline-flex max-w-full items-center rounded-full border text-xs transition-colors ${CHIP_CLASS[tone]}`}>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        flip(tone, rule);
                    }}
                    title={`Clique para ${target}`}
                    aria-label={`${label}: clique para ${target}`}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1"
                >
                    <RuleIcon visual={visualOf(rule)} size={11} className="h-5 w-5 rounded-full" />
                    <span className={`truncate ${tone === "exclude" ? "line-through decoration-red-300/50" : ""}`}>{label}</span>
                </button>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove(tone, rule);
                    }}
                    className="mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-white/10 hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remover ${label}`}
                >
                    <X size={11} />
                </button>
            </span>
        );
    };

    return (
        <section className="flex flex-col gap-1.5">
            <label htmlFor={`${listId}-input`} className="pl-1 text-sm text-white/70">
                Quais despesas entram
            </label>

            <div
                ref={fieldRef}
                onClick={() => inputRef.current?.focus()}
                className="flex min-h-12 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.1] bg-black/35 px-2 py-1.5 transition-colors focus-within:border-white/[0.25]"
            >
                {include.map((rule) => renderChip("include", rule))}
                {exclude.length > 0 ? <span className="px-1 text-xs text-white/45">exceto</span> : null}
                {exclude.map((rule) => renderChip("exclude", rule))}

                <input
                    id={`${listId}-input`}
                    ref={inputRef}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    aria-activedescendant={isOpen && results.length > 0 ? `${listId}-${safeIndex}` : undefined}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setIsOpen(false)}
                    onKeyDown={handleKeyDown}
                    placeholder={hasRules ? "Adicionar outra…" : placeholder}
                    className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-white outline-none placeholder:text-white/30"
                />
            </div>

            <p className="pl-1 text-[11px] text-white/40">
                {hasRules ? "Basta atender a uma regra verde. As riscadas ficam de fora sempre. Toque numa regra para trocar." : "Escolha o que conta neste orçamento. Uma categoria leva junto as subcategorias."}
            </p>

            <AnchoredOverlay
                anchorRef={fieldRef}
                overlayRef={overlayRef}
                isOpen={isOpen}
                preferredMaxHeight={340}
                className="rounded-xl border border-white/[0.1] bg-[#101010] p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.95)]"
            >
                <ul id={listId} role="listbox" aria-label="Regras disponíveis" className="elegant-scrollbar max-h-72 overflow-y-auto pr-1">
                    {results.map((result, index) => {
                        const startsGroup = index === 0 || results[index - 1].groupLabel !== result.groupLabel;
                        const isActive = index === safeIndex;

                        return (
                            <li key={result.id} role="presentation">
                                {startsGroup ? <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium text-white/40">{result.groupLabel}</p> : null}
                                <div
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={isActive}
                                    // Mantém o foco no campo para encadear várias escolhas.
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseMove={() => setActiveIndex(index)}
                                    onClick={() => choose(result, "include")}
                                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${isActive ? "bg-white/[0.08] text-white" : "text-white/75"} ${result.isSubcategory ? "pl-7" : ""}`}
                                >
                                    <RuleIcon visual={result} size={13} className="h-6 w-6 rounded-md" />
                                    <span className="min-w-0 truncate">{result.label}</span>
                                    {result.context ? <span className="truncate text-xs text-white/35">{result.isSubcategory ? `em ${result.context}` : result.context}</span> : null}
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            choose(result, "exclude");
                                        }}
                                        className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-red-200/70 transition-colors hover:bg-red-500/15 hover:text-red-100 ${isActive ? "" : "opacity-40 sm:opacity-0"}`}
                                        aria-label={`Deixar ${result.label} de fora`}
                                    >
                                        <Ban size={12} />
                                        <span className={isActive ? "" : "hidden"}>Deixar de fora</span>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                {results.length === 0 ? (
                    <p className="px-2.5 py-2 text-sm text-white/45">{query.trim() ? "Isso já está nas regras." : "Tudo já está nas regras. Digite um texto para filtrar pela descrição."}</p>
                ) : (
                    <p className="border-t border-white/[0.06] px-2.5 pb-1 pt-2 text-[11px] text-white/35">Enter adiciona · Shift+Enter deixa de fora</p>
                )}
            </AnchoredOverlay>
        </section>
    );
}
