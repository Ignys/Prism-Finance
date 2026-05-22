import type { Beneficiary } from "../../context/FinanceContext";

type BeneficiaryAvatarProps = {
    beneficiary: Pick<Beneficiary, "name" | "avatarImage" | "avatarColor">;
    className?: string;
    textClassName?: string;
};

function resolveInitial(name: string): string {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return "?";
    }

    return trimmedName.charAt(0).toUpperCase();
}

export function BeneficiaryAvatar({ beneficiary, className = "h-7 w-7 rounded-full border border-white/[0.12]", textClassName = "text-xs font-semibold text-white" }: BeneficiaryAvatarProps) {
    return (
        <span
            className={`inline-flex items-center justify-center overflow-hidden bg-white/[0.03] ${className}`}
            style={{ backgroundColor: beneficiary.avatarImage ? undefined : beneficiary.avatarColor ?? "#4B5563" }}
        >
            {beneficiary.avatarImage ? <img src={beneficiary.avatarImage} alt={beneficiary.name} className="h-full w-full object-cover" /> : <span className={textClassName}>{resolveInitial(beneficiary.name)}</span>}
        </span>
    );
}
