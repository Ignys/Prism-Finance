import type { ReactNode } from "react";
import type { CreditCard, Wallet } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";
import { PLANNING_CONTROL_TRIGGER_CLASS, PlanningControlGroup } from "./PlanningControlGroup";
import type { ReportRange } from "./PlanningReportsTab";

export interface PlanningReportsToolbarProps {
    creditCards: CreditCard[];
    range: ReportRange;
    selectedCreditCardIds: string[];
    selectedWalletIds: string[];
    wallets: Wallet[];
    onRangeChange: (range: ReportRange) => void;
    onSelectedCreditCardIdsChange: (creditCardIds: string[]) => void;
    onSelectedWalletIdsChange: (walletIds: string[]) => void;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

interface CreditCardOption extends ComboboxOptionBase {
    creditCard: CreditCard;
}

interface ReportRangeOption extends ComboboxOptionBase {
    value: ReportRange;
}

const REPORT_RANGE_OPTIONS: ReportRangeOption[] = ([6, 9] as const).map((value) => ({
    id: String(value),
    label: `${value} meses`,
    searchText: `${value} meses`,
    value,
}));

export function PlanningReportsToolbar({
    creditCards,
    range,
    selectedCreditCardIds,
    selectedWalletIds,
    wallets,
    onRangeChange,
    onSelectedCreditCardIdsChange,
    onSelectedWalletIdsChange,
}: PlanningReportsToolbarProps) {
    const walletOptions: WalletOption[] = wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
        searchText: `${wallet.name} ${wallet.type} ${wallet.isActive ? "ativa" : "arquivada"}`,
        wallet,
    }));
    const creditCardOptions: CreditCardOption[] = creditCards.map((creditCard) => ({
        id: creditCard.id,
        label: creditCard.name,
        searchText: `${creditCard.name} cartao cartão ${creditCard.isActive ? "ativo" : "arquivado"}`,
        creditCard,
    }));

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <PlanningControlGroup>
                <MultiSelectCombobox
                    label="Carteiras"
                    labelClassName="sr-only"
                    triggerClassName={`${PLANNING_CONTROL_TRIGGER_CLASS} w-[200px]`}
                    allowEmptySelection={false}
                    values={selectedWalletIds}
                    placeholder="Selecione as carteiras"
                    emptyMessage="Nenhuma carteira encontrada."
                    options={walletOptions}
                    onChange={onSelectedWalletIdsChange}
                    renderSelectedSummary={(selectedOptions) => renderSelectionCount(selectedOptions.length, "carteira", "carteiras")}
                    renderOptionContent={(option) => <WalletOptionContent option={option} />}
                />
            </PlanningControlGroup>

            <PlanningControlGroup>
                <MultiSelectCombobox
                    label="Cartões"
                    labelClassName="sr-only"
                    triggerClassName={`${PLANNING_CONTROL_TRIGGER_CLASS} w-[200px]`}
                    allowEmptySelection={false}
                    values={selectedCreditCardIds}
                    placeholder="Selecione os cartões"
                    emptyMessage="Nenhum cartão encontrado."
                    options={creditCardOptions}
                    onChange={onSelectedCreditCardIdsChange}
                    renderSelectedSummary={(selectedOptions) => renderSelectionCount(selectedOptions.length, "cartão", "cartões")}
                    renderOptionContent={(option) => <CreditCardOptionContent option={option} />}
                />
            </PlanningControlGroup>

            <PlanningControlGroup>
                <SingleSelectCombobox
                    label="Período"
                    labelClassName="sr-only"
                    triggerClassName={PLANNING_CONTROL_TRIGGER_CLASS}
                    value={String(range)}
                    placeholder="Selecione"
                    emptyMessage="Nenhuma opção encontrada."
                    options={REPORT_RANGE_OPTIONS}
                    disableSearch
                    compactTrigger
                    onChange={(value) => {
                        const nextRange = Number(value);
                        if (nextRange === 6 || nextRange === 9) {
                            onRangeChange(nextRange);
                        }
                    }}
                    renderOptionContent={(option) => <SelectOptionContent>{option.label}</SelectOptionContent>}
                    renderSelectedContent={(option) => <SelectOptionContent>{option.label}</SelectOptionContent>}
                />
            </PlanningControlGroup>
        </div>
    );
}

function WalletOptionContent({ option }: { option: WalletOption }) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/10" iconSize={15} iconStrokeWidth={1.7} />
            <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{option.wallet.name}</p>
                {!option.wallet.isActive ? <p className="text-xs text-white/38">Arquivada</p> : null}
            </div>
        </div>
    );
}

function CreditCardOptionContent({ option }: { option: CreditCardOption }) {
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

function SelectOptionContent({ children }: { children: ReactNode }) {
    return <span className="truncate text-sm text-white/85">{children}</span>;
}

function renderSelectionCount(count: number, singular: string, plural: string) {
    return (
        <span className="rounded bg-white/[0.12] px-2 py-0.5 text-sm text-white/85">
            {count} {count > 1 ? plural : singular}
        </span>
    );
}
