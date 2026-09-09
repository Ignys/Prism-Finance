import { ArrowRight, Layers3, ReceiptText } from "lucide-react";
import type { Beneficiary, Category, CreditCard, TransactionSeriesScope } from "../../context/FinanceContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { BeneficiaryAvatar } from "../common/BeneficiaryAvatar";
import { WalletAvatar } from "../common/WalletAvatar";
import type { ComboboxOptionBase } from "./SingleSelectCombobox";

export interface CreditCardOption extends ComboboxOptionBase {
    creditCard: CreditCard;
}

export interface CategoryOption extends ComboboxOptionBase {
    category: Category;
    level: 0 | 1;
    rootCategoryId: string;
    categoryId: string;
}

export interface BeneficiaryOption extends ComboboxOptionBase {
    beneficiary: Beneficiary;
}

export interface TagOption extends ComboboxOptionBase {
    color: string | null;
}

export interface EditScopeOption extends ComboboxOptionBase {
    scope: TransactionSeriesScope;
    icon: typeof ReceiptText;
}

export const EDIT_SCOPE_OPTIONS: EditScopeOption[] = [
    { id: "single", label: "Apenas essa transação", searchText: "so esta ocorrencia single", scope: "single", icon: ReceiptText },
    { id: "this_and_next", label: "Essa e as próximas transações", searchText: "esta e proximas this and next", scope: "this_and_next", icon: ArrowRight },
    { id: "all", label: "Todas as transações", searchText: "toda a serie all", scope: "all", icon: Layers3 },
];

export function CreditCardOptionContent({ option }: { option: CreditCardOption }) {
    return <div className="flex items-center gap-2"><WalletAvatar wallet={option.creditCard} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} /><span className="truncate">{option.label}</span></div>;
}

export function CategoryOptionContent({ option }: { option: CategoryOption }) {
    const Icon = getCategoryIconComponent(option.category.icon, option.category.type);
    return (
        <div className={`flex items-center gap-2 ${option.level === 1 ? "pl-3" : ""}`}>
            {option.level === 1 && <span className="h-px w-2 rounded-full bg-white/25" />}
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12]" style={{ color: option.category.color ?? "#CBD5E1", backgroundColor: `${option.category.color ?? "#64748B"}22` }}><Icon size={14} /></span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function BeneficiaryOptionContent({ option }: { option: BeneficiaryOption }) {
    return <div className="flex items-center gap-2"><BeneficiaryAvatar beneficiary={option.beneficiary} /><span className="truncate">{option.label}</span></div>;
}

export function TagOptionContent({ option }: { option: TagOption }) {
    return <div className="flex items-center gap-2"><span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color ?? "#64748B" }} /><span className="truncate">{option.label}</span></div>;
}

export function EditScopeOptionContent({ option }: { option: EditScopeOption }) {
    const Icon = option.icon;
    return <div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/80"><Icon size={14} /></span><span className="truncate">{option.label}</span></div>;
}

export function EditScopeSelectedContent({ option }: { option: EditScopeOption }) {
    return <span className="truncate">{option.label}</span>;
}
