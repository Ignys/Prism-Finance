import type { CreditCard, ReportPeriod, Wallet } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import type { ComboboxOptionBase } from "../../transactions/SingleSelectCombobox";
import { PlanningControlGroup, PLANNING_CONTROL_TRIGGER_CLASS } from "./PlanningControlGroup";
import { PlanningReportPeriodSelector } from "./PlanningReportPeriodSelector";

export interface PlanningReportsToolbarProps {
    creditCards: CreditCard[];
    period: ReportPeriod;
    selectedCreditCardIds: string[];
    selectedWalletIds: string[];
    wallets: Wallet[];
    onPeriodChange: (period: ReportPeriod) => void;
    onSelectedCreditCardIdsChange: (creditCardIds: string[]) => void;
    onSelectedWalletIdsChange: (walletIds: string[]) => void;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

interface CreditCardOption extends ComboboxOptionBase {
    creditCard: CreditCard;
}

export function PlanningReportsToolbar({
    creditCards,
    period,
    selectedCreditCardIds,
    selectedWalletIds,
    wallets,
    onPeriodChange,
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
                <PlanningReportPeriodSelector period={period} onPeriodChange={onPeriodChange} />
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

function renderSelectionCount(count: number, singular: string, plural: string) {
    return (
        <span className="rounded bg-white/[0.12] px-2 py-0.5 text-sm text-white/85">
            {count} {count > 1 ? plural : singular}
        </span>
    );
}
