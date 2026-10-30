import type { CreditCard } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import type { ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";

export interface CreditCardOption extends ComboboxOptionBase {
    creditCard: CreditCard;
}

export function CreditCardOptionContent({ option }: { option: CreditCardOption }) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={option.creditCard} className="h-7 w-7 rounded-md border border-white/10" iconSize={15} iconStrokeWidth={1.7} />
            <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{option.creditCard.name}</p>
                {!option.creditCard.isActive ? <p className="text-xs text-white/38">Arquivado</p> : null}
            </div>
        </div>
    );
}
