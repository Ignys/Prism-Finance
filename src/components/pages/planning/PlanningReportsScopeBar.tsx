import { CreditCard as CreditCardIcon, WalletMinimal } from "lucide-react";
import type { ReactNode } from "react";
import type { CreditCard, Wallet } from "../../../context/FinanceContext";
import { MultiSelectCombobox } from "../../transactions/MultiSelectCombobox";
import { CreditCardOptionContent, type CreditCardOption } from "./CreditCardOptionContent";
import { PLANNING_CONTROL_TRIGGER_CLASS } from "./PlanningControlGroup";
import { WalletOptionContent, type WalletOption } from "./PlanningTimelineToolbar";
import type { ReportScope } from "./planningReportsUtils";

interface PlanningReportsScopeBarProps {
    wallets: Wallet[];
    creditCards: CreditCard[];
    scope: ReportScope;
    onScopeChange: (scope: ReportScope) => void;
    /** Normalmente o seletor de período. */
    trailing: ReactNode;
}

const TRIGGER_CLASS = `${PLANNING_CONTROL_TRIGGER_CLASS} w-full sm:w-[210px]`;

function summarize(selected: { label: string }[], total: number, none: string, all: string, plural: string) {
    const text = selected.length === 0 ? none : selected.length === total ? all : selected.length === 1 ? selected[0].label : `${selected.length} ${plural}`;
    return <span className={`truncate text-sm ${selected.length === 0 ? "text-white/40" : "text-white/85"}`}>{text}</span>;
}

/** Barra de filtros do relatório: carteiras, cartões e período. */
export function PlanningReportsScopeBar({ wallets, creditCards, scope, onScopeChange, trailing }: PlanningReportsScopeBarProps) {
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
        <header className="flex flex-wrap items-center gap-2">
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <MultiSelectCombobox
                    label="Carteiras"
                    hideLabel
                    triggerClassName={TRIGGER_CLASS}
                    leadingIcon={<WalletMinimal size={15} className="shrink-0 text-amber-400/80" />}
                    values={scope.walletIds}
                    placeholder="Nenhuma carteira"
                    emptyMessage="Nenhuma carteira encontrada."
                    options={walletOptions}
                    onChange={(walletIds) => onScopeChange({ ...scope, walletIds })}
                    renderSelectedSummary={(selected) => summarize(selected, wallets.length, "Nenhuma carteira", "Todas as carteiras", "carteiras")}
                    renderOptionContent={(option) => <WalletOptionContent option={option} />}
                />
                {creditCards.length > 0 ? (
                    <MultiSelectCombobox
                        label="Cartões"
                        hideLabel
                        triggerClassName={TRIGGER_CLASS}
                        leadingIcon={<CreditCardIcon size={15} className="shrink-0 text-violet-300/80" />}
                        values={scope.creditCardIds}
                        placeholder="Nenhum cartão"
                        emptyMessage="Nenhum cartão encontrado."
                        options={creditCardOptions}
                        onChange={(creditCardIds) => onScopeChange({ ...scope, creditCardIds })}
                        renderSelectedSummary={(selected) => summarize(selected, creditCards.length, "Nenhum cartão", "Todos os cartões", "cartões")}
                        renderOptionContent={(option) => <CreditCardOptionContent option={option} />}
                    />
                ) : null}
                {trailing}
            </div>
        </header>
    );
}
