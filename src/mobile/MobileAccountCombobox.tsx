import { useMemo } from "react";
import { WalletAvatar } from "../components/common/WalletAvatar";
import { MultiSelectCombobox } from "../components/transactions/MultiSelectCombobox";
import type { ComboboxOptionBase } from "../components/transactions/SingleSelectCombobox";
import type { CreditCard, Wallet } from "../context/FinanceContext";

type Account = Pick<Wallet | CreditCard, "id" | "name" | "icon" | "color">;

interface AccountOption extends ComboboxOptionBase {
    account: Account;
}

interface MobileAccountComboboxProps {
    label: string;
    placeholder: string;
    emptyMessage: string;
    accounts: Account[];
    values: string[];
    onChange: (values: string[]) => void;
}

function AccountContent({ account, suffix = "" }: { account: Account; suffix?: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={account} className="h-7 w-7 shrink-0 rounded-lg border border-white/[0.12]" iconSize={14} />
            <span className="truncate text-sm text-white">
                {account.name}
                {suffix}
            </span>
        </span>
    );
}

// Same multi-select as the desktop wallet/card pickers; an empty selection means "all".
export function MobileAccountCombobox({ label, placeholder, emptyMessage, accounts, values, onChange }: MobileAccountComboboxProps) {
    const options = useMemo<AccountOption[]>(() => accounts.map((account) => ({ id: account.id, label: account.name, searchText: account.name, account })), [accounts]);

    return (
        <MultiSelectCombobox
            hideLabel
            label={label}
            values={values}
            placeholder={placeholder}
            emptyMessage={emptyMessage}
            options={options}
            onChange={onChange}
            renderOptionContent={(option) => <AccountContent account={option.account} />}
            renderSelectedSummary={([first, ...rest]) => (first ? <AccountContent account={first.account} suffix={rest.length > 0 ? ` +${rest.length}` : ""} /> : null)}
            triggerClassName="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white"
        />
    );
}
