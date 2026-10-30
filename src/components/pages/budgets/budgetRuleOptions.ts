import type { LucideIcon } from "lucide-react";
import { CreditCard as CreditCardIcon, FolderTree, Repeat, Tag as TagIcon, Type, User, Wallet as WalletIcon } from "lucide-react";
import {
    SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID,
    type Beneficiary,
    type Category,
    type CreditCard,
    type PlanningBudget,
    type PlanningBudgetRule,
    type PlanningBudgetRuleKind,
    type Tag,
    type TransactionGroup,
    type Wallet,
} from "../../../context/FinanceContext";
import { getBudgetRuleKey } from "../../../context/finance/planningBudgets";
import type { ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";

export type BudgetRuleListKind = Exclude<PlanningBudgetRuleKind, "text">;

export interface BudgetRuleValueOption extends ComboboxOptionBase {
    rule: PlanningBudgetRule;
    /** Nome de ícone (lucide em kebab-case), como nas categorias. */
    iconName: string;
    color: string | null;
    /** Categoria-pai da subcategoria, ou categoria da série recorrente. */
    context: string | null;
    isSubcategory: boolean;
}

export type BudgetRuleOptions = Record<BudgetRuleListKind, BudgetRuleValueOption[]>;

interface BudgetRuleKindConfig {
    kind: PlanningBudgetRuleKind;
    label: string;
    icon: LucideIcon;
    /** Título do grupo nos resultados da busca. */
    groupLabel: string;
}

export const BUDGET_RULE_KINDS: BudgetRuleKindConfig[] = [
    { kind: "category", label: "Categoria", icon: FolderTree, groupLabel: "Categorias" },
    { kind: "wallet", label: "Carteira", icon: WalletIcon, groupLabel: "Pago direto da carteira" },
    { kind: "creditCard", label: "Cartão", icon: CreditCardIcon, groupLabel: "Pago no cartão" },
    { kind: "recurring", label: "Despesa recorrente", icon: Repeat, groupLabel: "Despesas recorrentes" },
    { kind: "tag", label: "Tag", icon: TagIcon, groupLabel: "Tags" },
    { kind: "beneficiary", label: "Beneficiário", icon: User, groupLabel: "Beneficiários" },
    { kind: "text", label: "Texto na descrição", icon: Type, groupLabel: "Descrição" },
];

export const BUDGET_RULE_KIND_BY_ID = Object.fromEntries(BUDGET_RULE_KINDS.map((config) => [config.kind, config])) as Record<PlanningBudgetRuleKind, BudgetRuleKindConfig>;

interface BudgetRuleOptionSources {
    categories: Category[];
    groups: TransactionGroup[];
    tags: Tag[];
    beneficiaries: Beneficiary[];
    wallets: Wallet[];
    creditCards: CreditCard[];
}

function toOption(rule: PlanningBudgetRule, label: string, extra: Partial<BudgetRuleValueOption> & Pick<BudgetRuleValueOption, "iconName">): BudgetRuleValueOption {
    return { id: getBudgetRuleKey(rule), label, searchText: `${label} ${extra.context ?? ""}`, rule, color: null, context: null, isSubcategory: false, ...extra };
}

/** Categorias-pai seguidas das suas subcategorias, na ordem de cadastro. */
function buildCategoryOptions(categories: Category[]): BudgetRuleValueOption[] {
    const budgetable = categories
        .filter((category) => category.type === "expense" && category.isActive && category.id !== SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const parents = budgetable.filter((category) => !category.parentId);

    return parents
        .flatMap((parent) => [parent, ...budgetable.filter((category) => category.parentId === parent.id)])
        .map((category) => {
            const parent = category.parentId ? parents.find((item) => item.id === category.parentId) : undefined;
            return toOption({ kind: "category", categoryId: category.id }, category.name, {
                iconName: category.icon,
                color: category.color ?? parent?.color ?? null,
                context: parent?.name ?? null,
                isSubcategory: Boolean(parent),
            });
        });
}

function buildRecurringOptions(groups: TransactionGroup[], categories: Category[]): BudgetRuleValueOption[] {
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return groups
        .filter((group) => group.transactionMode === "recurring" && group.type === "expense")
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((group) => {
            const category = group.categoryId ? categoryById.get(group.categoryId) : undefined;
            return toOption({ kind: "recurring", groupId: group.id }, group.title || "Série recorrente", {
                iconName: category?.icon ?? "repeat",
                color: category?.color ?? null,
                context: category?.name ?? null,
            });
        });
}

export function buildBudgetRuleOptions({ categories, groups, tags, beneficiaries, wallets, creditCards }: BudgetRuleOptionSources): BudgetRuleOptions {
    return {
        category: buildCategoryOptions(categories),
        recurring: buildRecurringOptions(groups, categories),
        tag: tags
            .filter((tag) => tag.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((tag) => toOption({ kind: "tag", tagId: tag.id }, tag.name, { iconName: "tag", color: tag.color })),
        beneficiary: beneficiaries
            .filter((beneficiary) => beneficiary.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((beneficiary) => toOption({ kind: "beneficiary", beneficiaryId: beneficiary.id }, beneficiary.name, { iconName: "user", color: beneficiary.avatarColor })),
        wallet: wallets
            .filter((wallet) => wallet.isActive)
            .map((wallet) => toOption({ kind: "wallet", walletId: wallet.id }, wallet.name, { iconName: "wallet", color: wallet.color })),
        creditCard: creditCards
            .filter((card) => card.isActive)
            .map((card) => toOption({ kind: "creditCard", creditCardId: card.id }, card.name, { iconName: "credit-card", color: card.color })),
    };
}

export type BudgetRuleLabelResolver = (rule: PlanningBudgetRule) => string;

export interface BudgetRuleResolver {
    labelOf: BudgetRuleLabelResolver;
    /** Ícone/cor da regra para exibir o orçamento; regra de texto e alvos removidos usam ícones neutros. */
    visualOf: (rule: PlanningBudgetRule | undefined) => Pick<BudgetRuleValueOption, "iconName" | "color">;
}

export function createBudgetRuleResolver(options: BudgetRuleOptions): BudgetRuleResolver {
    const optionById = new Map(Object.values(options).flatMap((list) => list.map((option) => [option.id, option] as const)));
    const optionOf = (rule: PlanningBudgetRule) => optionById.get(getBudgetRuleKey(rule));

    return {
        labelOf: (rule) => (rule.kind === "text" ? `“${rule.text}”` : (optionOf(rule)?.label ?? `${BUDGET_RULE_KIND_BY_ID[rule.kind].label} removida`)),
        visualOf: (rule) => {
            const option = rule ? optionOf(rule) : undefined;
            return { iconName: option?.iconName ?? (rule?.kind === "text" ? "type" : "piggy-bank"), color: option?.color ?? null };
        },
    };
}

/** Ex.: "Contas, “uber” · exceto Assinaturas". */
export function summarizeBudgetRules({ include, exclude }: Pick<PlanningBudget, "include" | "exclude">, labelOf: BudgetRuleLabelResolver): string {
    const included = include.map(labelOf).join(", ");
    return exclude.length > 0 ? `${included} · exceto ${exclude.map(labelOf).join(", ")}` : included;
}

export function getBudgetDisplayName(budget: Pick<PlanningBudget, "name" | "include">, labelOf: BudgetRuleLabelResolver): string {
    return budget.name || budget.include.map(labelOf).join(", ") || "Orçamento";
}
