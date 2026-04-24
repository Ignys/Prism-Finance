import { RefreshCcw } from "lucide-react";
import { useMemo } from "react";
import type { CreditCard, Wallet } from "../../../context/FinanceContext";
import { INPUT_CLASS, SELECT_CLASS } from "../transactions/transactionsPageShared";
import type { PlanningSimulationResult } from "./planningPageShared";
import { formatCurrency, formatDateLabel, formatMonthLabel } from "./planningPageShared";

interface PlanningSimulatorPanelProps {
    amountInput: string;
    paymentMethod: "wallet" | "credit_card";
    walletId: string;
    creditCardId: string;
    purchaseDate: string;
    installments: number;
    wallets: Wallet[];
    creditCards: CreditCard[];
    simulation: PlanningSimulationResult;
    onAmountInputChange: (value: string) => void;
    onPaymentMethodChange: (value: "wallet" | "credit_card") => void;
    onWalletIdChange: (value: string) => void;
    onCreditCardIdChange: (value: string) => void;
    onPurchaseDateChange: (value: string) => void;
    onInstallmentsChange: (value: number) => void;
    onResetSimulation: () => void;
}

export function PlanningSimulatorPanel({
    amountInput,
    paymentMethod,
    walletId,
    creditCardId,
    purchaseDate,
    installments,
    wallets,
    creditCards,
    simulation,
    onAmountInputChange,
    onPaymentMethodChange,
    onWalletIdChange,
    onCreditCardIdChange,
    onPurchaseDateChange,
    onInstallmentsChange,
    onResetSimulation,
}: PlanningSimulatorPanelProps) {
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const activeCreditCards = useMemo(() => creditCards.filter((card) => card.isActive), [creditCards]);
    const visibleInstallments = simulation.installments.slice(0, 8);
    const hasMoreInstallments = simulation.installments.length > visibleInstallments.length;

    return (
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-left shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
            <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-yellow-500/10 blur-3xl" />

            <div className="relative flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-lg font-medium text-white">Simulador de compras</p>
                    <p className="text-sm text-white/55">Projete como uma compra pode impactar seu saldo do mes.</p>
                </div>
                <button
                    type="button"
                    onClick={onResetSimulation}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.06em] text-white/75 transition-colors hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white"
                >
                    <RefreshCcw size={12} />
                    Limpar simulacao
                </button>
            </div>

            <div className="relative mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-white/45">Valor da compra</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amountInput}
                        onChange={(event) => onAmountInputChange(event.target.value)}
                        placeholder="0,00"
                        className={INPUT_CLASS}
                    />
                </label>

                <label className="space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-white/45">Forma de pagamento</span>
                    <select
                        value={paymentMethod}
                        onChange={(event) => onPaymentMethodChange(event.target.value as "wallet" | "credit_card")}
                        className={SELECT_CLASS}
                    >
                        <option value="wallet">Carteira</option>
                        <option value="credit_card">Cartao de credito</option>
                    </select>
                </label>

                <label className="space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-white/45">{paymentMethod === "wallet" ? "Carteira" : "Cartao"}</span>
                    {paymentMethod === "wallet" ? (
                        <select value={walletId} onChange={(event) => onWalletIdChange(event.target.value)} className={SELECT_CLASS}>
                            {activeWallets.length < 1 && <option value="">Sem carteiras ativas</option>}
                            {activeWallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                    {wallet.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <select value={creditCardId} onChange={(event) => onCreditCardIdChange(event.target.value)} className={SELECT_CLASS}>
                            {activeCreditCards.length < 1 && <option value="">Sem cartoes ativos</option>}
                            {activeCreditCards.map((card) => (
                                <option key={card.id} value={card.id}>
                                    {card.name}
                                </option>
                            ))}
                        </select>
                    )}
                </label>

                <label className="space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-white/45">Data da compra</span>
                    <input
                        type="date"
                        value={purchaseDate}
                        onChange={(event) => onPurchaseDateChange(event.target.value)}
                        className={`${INPUT_CLASS} [color-scheme:dark]`}
                    />
                </label>

                <label className="space-y-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-white/45">Parcelas</span>
                    <input
                        type="number"
                        min={1}
                        max={60}
                        value={installments}
                        onChange={(event) => onInstallmentsChange(Number(event.target.value))}
                        className={INPUT_CLASS}
                    />
                </label>
            </div>

            <div className="relative mt-4 grid gap-2 lg:grid-cols-3">
                <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Impacto no mes selecionado</p>
                    <p className={`mt-1 text-lg font-semibold ${simulation.isValid ? "text-orange-200" : "text-white/50"}`}>
                        {simulation.isValid ? `-${formatCurrency(Math.abs(simulation.impactInSelectedMonth))}` : formatCurrency(0)}
                    </p>
                </article>
                <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Saldo apos simulacao</p>
                    <p className={`mt-1 text-lg font-semibold ${simulation.projectedEndBalance < 0 ? "text-red-300" : "text-emerald-300"}`}>
                        {formatCurrency(simulation.projectedEndBalance)}
                    </p>
                </article>
                <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Delta vs base</p>
                    <p className={`mt-1 text-lg font-semibold ${simulation.deltaVsBase < 0 ? "text-red-300" : "text-emerald-300"}`}>
                        {simulation.deltaVsBase >= 0 ? "+" : ""}
                        {formatCurrency(simulation.deltaVsBase)}
                    </p>
                </article>
            </div>

            {simulation.reason && <p className="relative mt-3 text-sm text-amber-200/90">{simulation.reason}</p>}

            {visibleInstallments.length > 0 && (
                <div className="relative mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/45">Parcelamento previsto</p>
                    <div className="mt-2 space-y-1.5">
                        {visibleInstallments.map((installment) => (
                            <div key={installment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                                <div>
                                    <p className="text-sm text-white/85">{installment.label}</p>
                                    <p className="text-xs text-white/45">
                                        {formatDateLabel(installment.impactDate)} - {formatMonthLabel(installment.impactMonth)}
                                    </p>
                                </div>
                                <p className="text-sm font-medium text-orange-200">-{formatCurrency(installment.amount)}</p>
                            </div>
                        ))}
                    </div>
                    {hasMoreInstallments && <p className="mt-2 text-xs text-white/45">Exibindo 8 de {simulation.installments.length} parcelas.</p>}
                </div>
            )}
        </section>
    );
}
