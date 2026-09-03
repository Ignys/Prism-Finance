import type { Beneficiary, Category, Tag, TransactionStatus, TransactionType, Wallet } from "../../context/FinanceContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { BeneficiaryAvatar } from "../common/BeneficiaryAvatar";
import { WalletAvatar } from "../common/WalletAvatar";

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
    isSeriesTransaction?: boolean;
    isInvoicePaymentEdit?: boolean;
}

interface StatusFieldProps {
    status: TransactionStatus;
    onChange: (value: TransactionStatus) => void;
    disabled?: boolean;
}

export function TransactionHeader({ type, isEditing, isSeriesTransaction = false, isInvoicePaymentEdit = false }: TransactionHeaderProps) {

    const contextLabel = (() => {
        if (isInvoicePaymentEdit) {
            return "Editando pagamento de fatura";
        }

        if (isEditing) {
            if (isSeriesTransaction) {
                if (type === "income") {
                    return "Editando receita da série";
                }

                if (type === "spending") {
                    return "Editando despesa da série";
                }

                return "Editando transferência da série";
            }

            if (type === "income") {
                return "Editando receita";
            }

            if (type === "spending") {
                return "Editando despesa";
            }

            return "Editando transferência";
        }

        if (type === "income") {
            return "Nova receita";
        }

        if (type === "spending") {
            return "Nova despesa";
        }

        return "Nova transferência";
    })();

    return <h1 className="text-sm ml-1 uppercase opacity-50">{contextLabel}</h1>;
}

export function StatusField({ status, onChange, disabled = false }: StatusFieldProps) {
    return (
        <div aria-label="Status">
            <div className="flex gap-1 rounded-xl border border-white/[0.1] bg-black/35 p-1">
                <button
                    type="button"
                    onClick={() => onChange("paid")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        status === "paid" ? "bg-emerald-500/20 text-emerald-200" : "text-white/65 hover:bg-white/[0.06]"
                    }`}
                >
                    Pago
                </button>
                <button
                    type="button"
                    onClick={() => onChange("pending")}
                    disabled={disabled}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        status === "pending" ? "bg-amber-500/20 text-amber-200" : "text-white/65 hover:bg-white/[0.06]"
                    }`}
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
            <BeneficiaryAvatar beneficiary={option.beneficiary} />
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
