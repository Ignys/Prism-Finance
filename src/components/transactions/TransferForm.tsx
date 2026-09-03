import { useMemo, useState } from "react";
import { ArrowRight, CircleSlash, ReceiptText, X } from "lucide-react";
import { type Tag, type Transaction, type Wallet, useFinanceSession } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AnimatedTransactionFormPanel } from "./AnimatedTransactionFormPanel";
import { DateField } from "./DateField";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { SingleSelectCombobox, type ComboboxOptionBase } from "./SingleSelectCombobox";
import { TransactionDetailsField } from "./TransactionDetailsField";
import { StatusField, TagOptionContent, WalletOptionContent } from "./TransactionFormParts";
import type { TransactionFormTab } from "./TransactionFormTabs";
import { FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./transactionForm.constants";
import { useTransactionDetails } from "./useTransactionDetails";
import { type TransferFormPrefill, useTransferForm } from "./useTransferForm";

interface TransferFormProps {
    prefill?: TransferFormPrefill;
    transaction?: Transaction | null;
    activeTab?: TransactionFormTab;
}

interface WalletOption extends ComboboxOptionBase { wallet: Wallet }
interface TagOption extends ComboboxOptionBase { tag: Tag }

type DestinationWalletOption =
    | (ComboboxOptionBase & { kind: "none" })
    | (ComboboxOptionBase & { kind: "wallet"; wallet: Wallet });

function NoWalletOptionContent() {
    return <div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] text-white/65"><CircleSlash size={14} /></span><span className="truncate">Nenhuma carteira</span></div>;
}

function DestinationWalletOptionContent({ option }: { option: DestinationWalletOption }) {
    return option.kind === "none" ? <NoWalletOptionContent /> : <WalletOptionContent option={option} />;
}

export function TransferForm({ prefill, transaction, activeTab = "simple" }: TransferFormProps) {
    const { closeModal } = useModal();
    const { user } = useFinanceSession();
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [transactionSaved, setTransactionSaved] = useState(false);
    const form = useTransferForm({ prefill, transaction });
    const details = useTransactionDetails({ transactionId: form.transactionId, userId: user?.uid, loadExisting: form.isEditing });

    const sourceWalletOptions = useMemo<WalletOption[]>(() => form.sourceWallets.map((wallet) => ({ id: wallet.id, label: wallet.name, searchText: wallet.name, wallet })), [form.sourceWallets]);
    const destinationWalletOptions = useMemo<DestinationWalletOption[]>(() => [
        { id: "none", label: "Nenhuma carteira", searchText: "nenhuma carteira fora externo sem destino", kind: "none" },
        ...form.sourceWallets.filter((wallet) => wallet.id !== form.sourceWalletId).map((wallet) => ({ id: wallet.id, label: wallet.name, searchText: wallet.name, wallet, kind: "wallet" as const })),
    ], [form.sourceWalletId, form.sourceWallets]);
    const tagOptions = useMemo<TagOption[]>(() => form.tags.filter((tag) => tag.isActive || form.selectedTagIds.includes(tag.id)).map((tag) => ({ id: tag.id, label: tag.name, searchText: tag.name, tag })), [form.selectedTagIds, form.tags]);

    const runSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        setSubmitError("");

        try {
            if (!transactionSaved) {
                const success = await form.submit();
                if (!success) {
                    setSubmitting(false);
                    return;
                }
            }

            try {
                await details.commit();
            } catch (detailsError) {
                console.error("Failed to save transfer details:", detailsError);
                setTransactionSaved(true);
                setSubmitError("A transferência foi salva, mas a anotação ou os anexos não. Tente novamente para concluir os detalhes.");
                setSubmitting(false);
                return;
            }

            closeModal();
        } catch (error) {
            console.error("Failed to submit transfer form:", error);
            setSubmitError("Não foi possível salvar a transferência agora.");
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)]">
            <header className="flex shrink-0 items-center justify-between gap-3">
                <h1 className="ml-1 text-sm uppercase opacity-50">{form.isEditing ? "Editando transferência" : "Nova transferência"}</h1>
                <button type="button" onClick={closeModal} disabled={submitting} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white disabled:opacity-55" aria-label="Fechar modal"><X size={15} /></button>
            </header>

            {submitError ? <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{submitError}</p> : null}

            <div className="mt-3 min-h-0 flex-1">
                <AnimatedTransactionFormPanel activeTab={activeTab}>
                    {activeTab === "simple" ? (
                        <section className="flex flex-col gap-3" role="tabpanel" aria-label="Dados simples">
                            <input className="rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-2xl text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.24] disabled:opacity-65" inputMode="numeric" placeholder="R$ 0,00" value={form.amountInput} onChange={(event) => form.setAmountInput(event.target.value)} disabled={submitting} />
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><StatusField status={form.status} onChange={form.setStatus} disabled={submitting} /><DateField value={form.date} onChange={form.setDate} onOffset={form.setDateOffset} disabled={submitting} /></div>
                            <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-[1fr_auto_1fr]">
                                <SingleSelectCombobox label="Sai de" value={form.sourceWalletId} placeholder="Selecione a origem" emptyMessage="Nenhuma carteira encontrada." options={sourceWalletOptions} onChange={form.setSourceWalletId} renderOptionContent={(option) => <WalletOptionContent option={option} />} labelClassName={FIELD_LABEL_CLASS} disabled={submitting} />
                                <div className="hidden h-[50px] items-center justify-center text-white/45 md:flex"><ArrowRight size={18} /></div>
                                <SingleSelectCombobox label="Entra em" value={form.destinationWalletId ?? "none"} placeholder="Selecione o destino" emptyMessage="Nenhuma carteira encontrada." options={destinationWalletOptions} onChange={(value) => form.setDestinationWalletId(value === "none" ? null : value)} renderOptionContent={(option) => <DestinationWalletOptionContent option={option} />} labelClassName={FIELD_LABEL_CLASS} disabled={submitting} />
                            </div>
                            <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL_CLASS}>Descrição</span><input className={FIELD_INPUT_CLASS} placeholder="Descrição da transferência" value={form.description} onChange={(event) => form.setDescription(event.target.value)} disabled={submitting} maxLength={160} /></label>
                        </section>
                    ) : (
                        <section className="flex flex-col gap-3" role="tabpanel" aria-label="Opções avançadas">
                            <div className="grid gap-3 md:grid-cols-2">
                                <MultiSelectCombobox label="Tags" values={form.selectedTagIds} placeholder="Nenhuma tag selecionada" emptyMessage="Nenhuma tag cadastrada." options={tagOptions} onChange={form.setSelectedTagIds} renderOptionContent={(option) => <TagOptionContent option={option} />} labelClassName={FIELD_LABEL_CLASS} />
                                <div className="flex flex-col gap-1.5"><span className={FIELD_LABEL_CLASS}>Tipo</span><div className={`${FIELD_INPUT_CLASS} flex min-h-[46px] items-center gap-2 text-white/75`}><ReceiptText size={14} /> Única</div></div>
                            </div>
                            <div className="h-px bg-white/[0.06]" />
                            <TransactionDetailsField details={details} disabled={submitting} />
                        </section>
                    )}
                </AnimatedTransactionFormPanel>
            </div>

            {form.errorMessage ? <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{form.errorMessage}</p> : null}

            <footer className="mt-4 flex shrink-0 items-center justify-end gap-1.5 border-t border-white/[0.06] pt-4">
                <button type="button" onClick={closeModal} disabled={submitting} className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:opacity-60">Cancelar</button>
                <button type="button" onClick={() => void runSubmit()} disabled={submitting} className="inline-flex min-w-28 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-400/[0.14] px-3 py-2 text-sm font-semibold text-emerald-50 transition-colors hover:border-emerald-300/55 hover:bg-emerald-400/[0.2] disabled:opacity-60">{submitting ? "Salvando..." : transactionSaved ? "Salvar detalhes" : "Salvar e fechar"}</button>
            </footer>
        </div>
    );
}
