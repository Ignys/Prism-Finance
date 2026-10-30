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
import { CircleDollarSign } from "lucide-react";
import { TransactionFieldIcon } from "../transactions/TransactionFieldIcon";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";
import { ModalBody, ModalCancelButton, ModalError, ModalFooter, ModalHeader, ModalPanel, ModalPrimaryButton } from "./ModalChrome";
import { ModalStructure } from "./ModalStructure";

interface PayCreditCardInvoiceModalProps {
    invoice: CreditCardInvoice;
    creditCard: CreditCard;
    defaultSettleWithoutWallet?: boolean;
}

const NO_WALLET_OPTION_ID = "__no-wallet__";

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet | null;
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
    if (!option.wallet) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md border border-dashed border-white/[0.2]" />
                <p className="truncate text-white/70">{option.label}</p>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <WalletAvatar wallet={option.wallet} className="h-7 w-7 rounded-md border border-white/[0.12]" iconSize={14} iconStrokeWidth={1.7} />
            <div className="min-w-0">
                <p className="truncate">{option.wallet.name}</p>
            </div>
        </div>
    );
}

export function PayCreditCardInvoiceModal({ invoice, creditCard, defaultSettleWithoutWallet = false }: PayCreditCardInvoiceModalProps) {
    const wallets = useFinanceWallets();
    const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const { payCreditCardInvoice } = useFinanceActions();
    const { closeModal } = useModal();
    const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    const [walletId, setWalletId] = useState(defaultSettleWithoutWallet ? NO_WALLET_OPTION_ID : creditCard.bankWalletId ?? activeWallets[0]?.id ?? "");
    const [amountInput, setAmountInput] = useState(formatAmountInputFromValue(openAmount));
    const [paymentDate, setPaymentDate] = useState(getLocalTodayDate());
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const settleWithoutWallet = walletId === NO_WALLET_OPTION_ID;
    const amount = useMemo(() => parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput)), [amountInput]);
    const selectedWallet = useMemo(() => wallets.find((wallet) => wallet.id === walletId) ?? null, [walletId, wallets]);
    const walletOptions = useMemo<WalletOption[]>(
        () => [
            { id: NO_WALLET_OPTION_ID, label: "Nenhuma carteira", searchText: "nenhuma carteira sem carteira", wallet: null },
            ...activeWallets.map((wallet) => ({
                id: wallet.id,
                label: wallet.name,
                searchText: `${wallet.name} ${wallet.balance}`,
                wallet,
            })),
        ],
        [activeWallets],
    );

    useEffect(() => {
        const fallbackWalletId = activeWallets.find((wallet) => wallet.id === creditCard.bankWalletId)?.id ?? activeWallets[0]?.id ?? "";
        if (walletId !== NO_WALLET_OPTION_ID && !activeWallets.some((wallet) => wallet.id === walletId)) {
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

        if (walletId !== NO_WALLET_OPTION_ID && !selectedWallet) {
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
                walletId: walletId === NO_WALLET_OPTION_ID ? null : (selectedWallet?.id ?? null),
                amount,
                paymentDate,
                settleWithoutWallet,
            });
            closeModal();
        } catch (submitError) {
            console.error("Failed to pay credit card invoice:", submitError);
            setError("Nao foi possivel processar o pagamento.");
            setSubmitting(false);
        }
    };

    const remainingAmount = Math.max(0, openAmount - (Number.isFinite(amount) ? amount : 0));
    const invoiceMonth = format(parseAppDate(invoice.closingDate) ?? new Date(), "MMMM", { locale: ptBR });
    const invoiceMonthLabel = invoiceMonth.charAt(0).toUpperCase() + invoiceMonth.slice(1);

    return (
        <ModalStructure width="520px" height="auto">
            <ModalPanel>
                <ModalHeader title="Pagar fatura" disabled={submitting} />

                <ModalBody>
                    <div className="relative mt-2 overflow-hidden bg-[#1b1b1b] text-white [mask-image:radial-gradient(circle_at_8px_0,transparent_5px,#000_5.5px)] [mask-position:-8px_0] [mask-size:16px_100%] [mask-repeat:repeat-x]">
                        <div className="px-5 pb-4 pt-6">
                            <div className="flex flex-col items-center gap-1.5 text-center">
                                <WalletAvatar wallet={creditCard} className="h-10 w-10 rounded-xl border border-white/[0.12]" iconSize={18} iconStrokeWidth={1.7} />
                                <p className="text-base font-medium">{creditCard.name}</p>
                                <p className="text-xs text-white/50">Fatura de {invoiceMonthLabel.toLowerCase()}</p>
                            </div>

                            <dl className="mt-5 flex flex-col gap-1.5 text-sm">
                                <ReceiptLine label="Fechamento" value={formatFriendlyDate(invoice.closingDate)} />
                                <ReceiptLine label="Vencimento" value={formatFriendlyDate(invoice.dueDate)} />
                                <ReceiptLine label="Total da fatura" value={formatMoney(invoice.totalAmount)} mono />
                                {invoice.paidAmount > 0 ? <ReceiptLine label="Já pago" value={`− ${formatMoney(invoice.paidAmount)}`} mono valueClassName="text-emerald-200/90" /> : null}
                            </dl>

                            <div className="mt-4 border-t border-dashed border-white/[0.18] pt-3">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-sm text-white/60">Saldo em aberto</span>
                                    <span className="font-mono text-2xl font-semibold tabular-nums text-red-200">{formatMoney(openAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <div aria-hidden="true" className="relative h-4">
                            <span className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-[#131313]" />
                            <span className="absolute -right-2 top-0 h-4 w-4 rounded-full bg-[#131313]" />
                            <span className="absolute inset-x-4 top-1/2 border-t border-dashed border-white/[0.18]" />
                        </div>

                        <div className="flex flex-col gap-2 px-3 pb-5 pt-2">
                            <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-[50px] items-center gap-2`}>
                                <TransactionFieldIcon icon={CircleDollarSign} />
                                <input
                                    aria-label="Valor do pagamento"
                                    value={amountInput}
                                    onChange={(event) => setAmountInput(formatCurrencyFromDigits(extractCurrencyDigits(event.target.value)))}
                                    disabled={submitting}
                                    className={`${FIELD_EMBEDDED_INPUT_CLASS} tabular-nums`}
                                    placeholder="R$ 0,00"
                                    inputMode="numeric"
                                />
                            </label>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <SingleSelectCombobox
                                    hideLabel
                                    label="Pagamento"
                                    value={walletId}
                                    placeholder="Selecione uma carteira"
                                    emptyMessage="Nenhuma carteira encontrada."
                                    options={walletOptions}
                                    onChange={setWalletId}
                                    renderOptionContent={(option) => <WalletOptionContent option={option} />}
                                    disabled={submitting}
                                />

                                <DateField hideLabel label="Data do pagamento" value={paymentDate} onChange={setPaymentDate} disabled={submitting} />
                            </div>

                            {settleWithoutWallet ? <p className="pl-1 text-xs text-white/45">Sem carteira: o pagamento quita a fatura, mas não movimenta saldo nem entra nos relatórios de caixa.</p> : null}

                            <div className="mt-2 flex items-baseline justify-between gap-3 px-2 text-sm">
                                <span className="text-white/50">Restante após o pagamento</span>
                                <span className={`font-mono tabular-nums ${remainingAmount > 0 ? "text-white/80" : "text-emerald-200"}`}>
                                    {remainingAmount > 0 ? formatMoney(remainingAmount) : "Fatura quitada"}
                                </span>
                            </div>
                        </div>
                    </div>
                </ModalBody>

                {error ? <ModalError>{error}</ModalError> : null}

                <ModalFooter>
                    <ModalCancelButton disabled={submitting} />
                    <ModalPrimaryButton onClick={() => void handleSubmit()} disabled={submitting}>
                        {submitting ? "Pagando..." : "Pagar fatura"}
                    </ModalPrimaryButton>
                </ModalFooter>
            </ModalPanel>
        </ModalStructure>
    );
}

function ReceiptLine({ label, value, mono = false, valueClassName = "text-white/85" }: { label: string; value: string; mono?: boolean; valueClassName?: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <dt className="shrink-0 text-white/50">{label}</dt>
            <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-white/[0.16]" />
            <dd className={`shrink-0 text-right ${mono ? "font-mono tabular-nums" : ""} ${valueClassName}`}>{value}</dd>
        </div>
    );
}
