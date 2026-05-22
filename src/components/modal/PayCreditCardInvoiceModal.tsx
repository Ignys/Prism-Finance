import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { type CreditCard, type CreditCardInvoice, type Wallet, useFinanceActions, useFinanceWallets } from "../../context/FinanceContext";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";
import { getLocalTodayDate, parseAppDate } from "../../lib/localDate";
import { useModal } from "../../context/ModalContext";
import { WalletAvatar } from "../common/WalletAvatar";
import { DateField } from "../transactions/DateField";
import { SingleSelectCombobox, type ComboboxOptionBase } from "../transactions/SingleSelectCombobox";
import { ModalStructure } from "./ModalStructure";

interface PayCreditCardInvoiceModalProps {
    invoice: CreditCardInvoice;
    creditCard: CreditCard;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function formatMoney(value: number): string {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatFriendlyDate(dateValue: string): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return dateValue;
    }

    return format(parsedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function WalletOptionContent({ option }: { option: WalletOption }) {
    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <div className="min-w-0">
                <p className="truncate">{option.wallet.name}</p>
            </div>
        </div>
    );
}

export function PayCreditCardInvoiceModal({ invoice, creditCard }: PayCreditCardInvoiceModalProps) {
    const wallets = useFinanceWallets();
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const { payCreditCardInvoice } = useFinanceActions();
    const { closeModal } = useModal();
    const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    const [walletId, setWalletId] = useState(creditCard.bankWalletId ?? activeWallets[0]?.id ?? "");
    const [amountInput, setAmountInput] = useState(formatAmountInputFromValue(openAmount));
    const [paymentDate, setPaymentDate] = useState(getLocalTodayDate());
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const amount = useMemo(() => parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput)), [amountInput]);
    const selectedWallet = useMemo(() => wallets.find((wallet) => wallet.id === walletId) ?? null, [walletId, wallets]);
    const walletOptions = useMemo<WalletOption[]>(
        () =>
            activeWallets.map((wallet) => ({
                id: wallet.id,
                label: wallet.name,
                searchText: `${wallet.name} ${wallet.balance}`,
                wallet,
            })),
        [activeWallets],
    );

    useEffect(() => {
        const fallbackWalletId = activeWallets.find((wallet) => wallet.id === creditCard.bankWalletId)?.id ?? activeWallets[0]?.id ?? "";
        if (!activeWallets.some((wallet) => wallet.id === walletId)) {
            setWalletId(fallbackWalletId);
        }
    }, [activeWallets, creditCard.bankWalletId, walletId]);

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Informe um valor valido.");
            return;
        }

        if (amount > openAmount) {
            setError("O valor nao pode ser maior que o saldo da fatura.");
            return;
        }

        if (!selectedWallet) {
            setError("Selecione uma carteira para pagamento.");
            return;
        }

        if (!parseAppDate(paymentDate)) {
            setError("Informe uma data de pagamento valida.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await payCreditCardInvoice({
                invoiceId: invoice.id,
                walletId: selectedWallet.id,
                amount,
                paymentDate,
            });
            closeModal();
        } catch (submitError) {
            console.error("Failed to pay credit card invoice:", submitError);
            setError("Nao foi possivel processar o pagamento.");
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure width="560px" height="auto">
            <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
                <h2 className="text-xl font-medium uppercase">Pagar fatura</h2>
                <p className="mt-1 text-sm text-white/60">
                    {creditCard.name} - Fatura de {format(parseAppDate(invoice.closingDate) ?? new Date(), "MMMM", { locale: ptBR }).charAt(0).toUpperCase() + format(parseAppDate(invoice.closingDate) ?? new Date(), "MMMM", { locale: ptBR }).slice(1)}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">    
                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3 text-left">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Fechamento</p>
                        <p className="mt-1 text-sm font-semibold">{formatFriendlyDate(invoice.closingDate)}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3 text-left">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Vencimento</p>
                        <p className="mt-1 text-sm font-semibold">{formatFriendlyDate(invoice.dueDate)}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.1] bg-black/35 p-3 text-left">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Saldo aberto</p>
                        <p className="mt-1 text-lg font-semibold">{formatMoney(openAmount)}</p>
                    </div>
                </div>

                <div>
                    <label className="mt-4 flex flex-col gap-1.5 text-left">
                        <span className="text-[11px] uppercase tracking-[0.12em] text-white/50">Valor do pagamento</span>
                        <input
                            value={amountInput}
                            onChange={(event) => setAmountInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                            className="rounded-xl border border-white/[0.1] bg-black/35 p-2.5 text-white outline-none placeholder:text-white/35"
                            placeholder="R$ 0,00"
                            inputMode="numeric"
                        />
                    </label>
                </div>

                <div className="mt-4 flex grid grid-cols-2 grid-rows-1 gap-3">
                    <SingleSelectCombobox
                        label="Pagamento"
                        value={walletId}
                        placeholder="Selecione uma carteira"
                        emptyMessage="Nenhuma carteira encontrada."
                        options={walletOptions}
                        onChange={setWalletId}
                        renderOptionContent={(option) => <WalletOptionContent option={option} />}
                    />

                    <DateField label="Data do pagamento" value={paymentDate} onChange={setPaymentDate} />
                </div>

                {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "Processando..." : "Confirmar"}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
