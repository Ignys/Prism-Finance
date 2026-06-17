import { useMemo, useState } from "react";
import { ArrowRight, CircleSlash, X } from "lucide-react";
import type { Transaction, Wallet } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { DateField } from "./DateField";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { StatusField, WalletOptionContent } from "./TransactionFormParts";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { type TransferFormPrefill, useTransferForm } from "./useTransferForm";

interface TransferFormProps {
    prefill?: TransferFormPrefill;
    transaction?: Transaction | null;
}

interface WalletOption extends ComboboxOptionBase {
    wallet: Wallet;
}

type DestinationWalletOption =
    | (ComboboxOptionBase & {
          kind: "none";
      })
    | (ComboboxOptionBase & {
          kind: "wallet";
          wallet: Wallet;
      });

function NoWalletOptionContent() {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/65">
                <CircleSlash size={14} />
            </span>
            <span className="truncate">Nenhuma carteira</span>
        </div>
    );
}

function DestinationWalletOptionContent({ option }: { option: DestinationWalletOption }) {
    if (option.kind === "none") {
        return <NoWalletOptionContent />;
    }

    return <WalletOptionContent option={option} />;
}

export function TransferForm({ prefill, transaction }: TransferFormProps) {
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);
    const form = useTransferForm({ prefill, transaction });

    const sourceWalletOptions = useMemo<WalletOption[]>(
        () =>
            form.sourceWallets.map((wallet) => ({
                id: wallet.id,
                label: wallet.name,
                searchText: wallet.name,
                wallet,
            })),
        [form.sourceWallets],
    );

    const destinationWalletOptions = useMemo<DestinationWalletOption[]>(
        () => [
            {
                id: "none",
                label: "Nenhuma carteira",
                searchText: "nenhuma carteira fora externo sem destino",
                kind: "none",
            },
            ...form.sourceWallets
                .filter((wallet) => wallet.id !== form.sourceWalletId)
                .map((wallet) => ({
                    id: wallet.id,
                    label: wallet.name,
                    searchText: wallet.name,
                    wallet,
                    kind: "wallet" as const,
                })),
        ],
        [form.sourceWalletId, form.sourceWallets],
    );

    const runSubmit = async () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        try {
            const success = await form.submit();
            if (success) {
                closeModal();
                return;
            }
        } catch (error) {
            console.error("Failed to submit transfer form:", error);
        }

        setSubmitting(false);
    };

    return (
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <div>
                <header className="flex items-center justify-between gap-3">
                    <h1 className="ml-1 text-sm uppercase opacity-50">{form.isEditing ? "Editando transferencia" : "Nova transferencia"}</h1>
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label="Fechar modal"
                        title="Fechar"
                    >
                        <X size={15} />
                    </button>
                </header>

                <section className="mt-2 flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                        <input
                            className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24] disabled:cursor-not-allowed disabled:opacity-65"
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            value={form.amountInput}
                            onChange={(event) => form.setAmountInput(event.target.value)}
                            disabled={submitting}
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <StatusField status={form.status} onChange={form.setStatus} disabled={submitting} />
                        <DateField value={form.date} onChange={form.setDate} onOffset={form.setDateOffset} disabled={submitting} />
                    </div>

                    <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-[1fr_auto_1fr]">
                        <SingleSelectCombobox
                            label="Sai de"
                            value={form.sourceWalletId}
                            placeholder="Selecione a origem"
                            emptyMessage="Nenhuma carteira encontrada."
                            options={sourceWalletOptions}
                            onChange={form.setSourceWalletId}
                            renderOptionContent={(option) => <WalletOptionContent option={option} />}
                            labelClassName={FIELD_LABEL_CLASS}
                            disabled={submitting}
                        />
                        <div className="hidden h-[50px] items-center justify-center text-white/45 md:flex">
                            <ArrowRight size={18} />
                        </div>
                        <SingleSelectCombobox
                            label="Entra em"
                            value={form.destinationWalletId ?? "none"}
                            placeholder="Selecione o destino"
                            emptyMessage="Nenhuma carteira encontrada."
                            options={destinationWalletOptions}
                            onChange={(value) => form.setDestinationWalletId(value === "none" ? null : value)}
                            renderOptionContent={(option) => <DestinationWalletOptionContent option={option} />}
                            labelClassName={FIELD_LABEL_CLASS}
                            disabled={submitting}
                        />
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className={FIELD_LABEL_CLASS}>Descricao</span>
                        <input
                            className={FIELD_INPUT_CLASS}
                            placeholder="Descricao da transferencia"
                            value={form.description}
                            onChange={(event) => form.setDescription(event.target.value)}
                            disabled={submitting}
                        />
                    </label>

                    {form.errorMessage && <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{form.errorMessage}</p>}
                </section>
            </div>

            <footer className="mt-4 flex items-center justify-end gap-1">
                <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => void runSubmit()}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? "Carregando..." : "Concluir"}
                </button>
            </footer>
        </div>
    );
}
