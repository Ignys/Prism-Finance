import { MoveRight, TrendingDown, TrendingUp } from "lucide-react";
import type { Beneficiary, Category, Tag, TransactionStatus, TransactionType, Wallet } from "../../context/FinanceContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { WalletAvatar } from "../common/WalletAvatar";
import { FIELD_LABEL_CLASS } from "./transactionForm.constants";

export interface WalletOptionLike {
    label: string;
    wallet: Wallet;
}

export interface CategoryOptionLike {
    label: string;
    category: Category;
    level: 0 | 1;
}

export interface BeneficiaryOptionLike {
    label: string;
    beneficiary: Beneficiary;
}

export interface TagOptionLike {
    label: string;
    tag: Tag;
}

interface TransactionHeaderProps {
    type: TransactionType;
    isEditing: boolean;
}

interface StatusFieldProps {
    status: TransactionStatus;
    onChange: (value: TransactionStatus) => void;
    disabled?: boolean;
}

export function TransactionHeader({ type, isEditing }: TransactionHeaderProps) {
    if (type === "income") {
        return (
            <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
                <TrendingUp size={32} className="rounded-2xl p-1" strokeWidth={3} />
                {isEditing ? "Editar receita" : "Nova receita"}
            </h1>
        );
    }

    if (type === "spending") {
        return (
            <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
                <TrendingDown size={32} className="rounded-2xl p-1" strokeWidth={3} />
                {isEditing ? "Editar despesa" : "Nova despesa"}
            </h1>
        );
    }

    return (
        <h1 className="flex items-center gap-2 text-2xl font-medium uppercase">
            <MoveRight size={32} className="rounded-2xl p-1" strokeWidth={3} />
            {isEditing ? "Editar transferencia" : "Nova transferencia"}
        </h1>
    );
}

export function StatusField({ status, onChange, disabled = false }: StatusFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Status</span>
            <div className="flex gap-1 rounded-xl border border-white/[0.1] bg-black/35 p-1">
                <button
                    type="button"
                    onClick={() => onChange("paid")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${status === "paid" ? "bg-emerald-500/20 text-emerald-200" : "text-white/65 hover:bg-white/[0.06]"}`}
                >
                    Pago
                </button>
                <button
                    type="button"
                    onClick={() => onChange("pending")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${status === "pending" ? "bg-amber-500/20 text-amber-200" : "text-white/65 hover:bg-white/[0.06]"}`}
                >
                    Pendente
                </button>
            </div>
        </div>
    );
}

export function CategoryOptionContent({ option }: { option: CategoryOptionLike }) {
    const Icon = getCategoryIconComponent(option.category.icon, option.category.type);

    return (
        <div className={`flex items-center gap-2 ${option.level === 1 ? "pl-3" : ""}`}>
            {option.level === 1 && <span className="h-px w-2 rounded-full bg-white/25" />}
            <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12]"
                style={{ color: option.category.color ?? "#CBD5E1", backgroundColor: `${option.category.color ?? "#64748B"}22` }}
            >
                <Icon size={14} />
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function WalletOptionContent({ option }: { option: WalletOptionLike }) {
    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function BeneficiaryOptionContent({ option }: { option: BeneficiaryOptionLike }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.03]">
                {option.beneficiary.avatarImage ? (
                    <img src={option.beneficiary.avatarImage} alt={option.beneficiary.name} className="h-full w-full object-cover" />
                ) : (
                    <span className="h-full w-full" style={{ backgroundColor: option.beneficiary.avatarColor ?? "#4B5563" }} />
                )}
            </span>
            <span className="truncate">{option.label}</span>
        </div>
    );
}

export function TagOptionContent({ option }: { option: TagOptionLike }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.tag.color ?? "#64748B" }} />
            <span className="truncate">{option.label}</span>
        </div>
    );
}
