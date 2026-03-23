import { ChevronLeft, ChevronRight, GalleryVerticalEnd } from "lucide-react";
import type { CreditCard } from "../../../context/FinanceContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { shiftMonth } from "./statementPageShared";
import { usePage } from "../../../context/PageContext";

interface StatementMonthSelectorProps {
    selectedMonth: string;
    onMonthChange: (value: string) => void;
}

function StatementMonthSelector({ selectedMonth, onMonthChange }: StatementMonthSelectorProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-neutral-900 px-1 py-1">
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Mes anterior"
                title="Mes anterior"
            >
                <ChevronLeft size={16} />
            </button>
            <label htmlFor="statement-month-selector" className="sr-only">
                Mes e ano de vencimento da fatura
            </label>
            <input
                id="statement-month-selector"
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                    if (event.target.value) {
                        onMonthChange(event.target.value);
                    }
                }}
                className="rounded-full border border-white/[0.08] bg-black/25 px-3 py-1.5 text-sm text-white outline-none transition-colors focus:border-white/[0.24] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
            />
            <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                aria-label="Proximo mes"
                title="Proximo mes"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}

interface StatementFiltersPanelProps {
    selectedMonth: string;
    selectedCardId: string;
    selectedCardName: string;
    creditCards: CreditCard[];
    openInMonth: number;
    onMonthChange: (value: string) => void;
    onCardChange: (value: string) => void;
}

export function StatementFiltersPanel({ selectedMonth, selectedCardId, selectedCardName: _selectedCardName, creditCards, openInMonth: _openInMonth, onMonthChange, onCardChange }: StatementFiltersPanelProps) {
    const { goToPage } = usePage()
    
    return (
        <section className="pt-1">
            <div className="relative flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                        <h1 className="text-2xl font-semibold text-white">Faturas</h1>
                    </div>
                    <StatementMonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onCardChange("all")}
                        aria-pressed={selectedCardId === "all"}
                        className={`group inline-flex items-center gap-2 rounded-xl border pl-2 pr-3 py-2 text-left transition-all duration-200 ${
                            selectedCardId === "all"
                                ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50 "
                                : "border-white/[0.09] bg-white/[0.02] text-white/80 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white"
                        }`}
                    >
                        <span className={`inline-flex items-center justify-center overflow-hidden h-8 w-8 rounded-lg border transition-colors ${selectedCardId === "all" ? "border-neutral-300/45" : "border-white/[0.14] group-hover:border-white/[0.24]"}`}>
                            <GalleryVerticalEnd size={18} />
                        </span>

                        <span className="text-sm">Todos</span>
                    </button>

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
                                    className={`h-8 w-8 rounded-lg border transition-colors ${isActive ? "border-neutral-300/45" : "border-white/[0.14] group-hover:border-white/[0.24]"}`}
                                    iconSize={18}
                                />
                                <span className="text-sm">{creditCard.name}</span>
                            </button>
                        );
                    })}
                </div>

                {creditCards.length < 1 && (
                    <div onClick={() => goToPage("balance")} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white/55">Crie um cartão agora!</div>
                )}
            </div>
        </section>
    );
}
