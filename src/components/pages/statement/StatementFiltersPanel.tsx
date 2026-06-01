import type { CreditCard } from "../../../context/FinanceContext";
import { usePage } from "../../../context/PageContext";
import { StatementMonthSelector } from "../../common/StatementMonthSelector";
import { WalletAvatar } from "../../common/WalletAvatar";

interface StatementFiltersPanelProps {
    selectedMonth: string;
    selectedCardId: string;
    creditCards: CreditCard[];
    onMonthChange: (value: string) => void;
    onCardChange: (value: string) => void;
}

export function StatementFiltersPanel({
    selectedMonth,
    selectedCardId,
    creditCards,
    onMonthChange,
    onCardChange,
}: StatementFiltersPanelProps) {
    const { goToPage } = usePage();

    return (
        <section className="">
            <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {creditCards.map((creditCard) => {
                            const isActive = selectedCardId === creditCard.id;

                            return (
                                <button
                                    type="button"
                                    key={creditCard.id}
                                    onClick={() => onCardChange(creditCard.id)}
                                    aria-pressed={isActive}
                                    className={`group inline-flex items-center gap-2 rounded-xl border pl-2 pr-3 py-2 text-left transition-all duration-200 ${
                                        isActive
                                            ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50"
                                            : "border-white/[0.09] bg-white/[0.02] text-white/80 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white"
                                    }`}
                                >
                                    <WalletAvatar
                                        wallet={creditCard}
                                        className={`h-8 w-8 rounded-lg  transition-colors ${isActive ? "border-neutral-300/45" : "border-white/[0.14] group-hover:border-white/[0.24]"}`}
                                        iconSize={18}
                                    />
                                    <span className="text-sm">{creditCard.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    <StatementMonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} ariaLabel="Selecionar mês e ano de vencimento da fatura" />
                </div>

                {creditCards.length < 1 && (
                    <button
                        type="button"
                        onClick={() => goToPage("creditCards")}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-sm text-white/55 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
                    >
                        Crie um cartão agora!
                    </button>
                )}
            </div>
        </section>
    );
}
