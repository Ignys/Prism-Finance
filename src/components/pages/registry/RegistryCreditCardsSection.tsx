import { motion } from "framer-motion";
import { CreditCard, Pencil, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinanceActions, useFinanceCreditCards, useFinanceFavoriteCreditCard } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { WalletAvatar } from "../../common/WalletAvatar";
import { CreditCardModal } from "../../modal/CreditCardModal";
import { RegistrySectionActions } from "./RegistrySectionActions";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function RegistryCreditCardsSection() {
    const creditCards = useFinanceCreditCards();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { setFavoriteCreditCard } = useFinanceActions();
    const { openModal } = useModal();
    const [showArchivedCreditCards, setShowArchivedCreditCards] = useState(false);

    const visibleCreditCards = useMemo(
        () => creditCards.filter((card) => showArchivedCreditCards || card.isActive),
        [creditCards, showArchivedCreditCards],
    );
    const activeCount = creditCards.filter((card) => card.isActive).length;
    const visibleCount = showArchivedCreditCards ? creditCards.length : activeCount;

    return (
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Cartões de crédito ({visibleCount})</p>
                </div>
                <RegistrySectionActions
                    isShowingInactive={showArchivedCreditCards}
                    showLabel="Mostrar arquivados"
                    hideLabel="Ocultar arquivados"
                    createLabel="Novo cartão"
                    onToggleInactive={() => setShowArchivedCreditCards((current) => !current)}
                    onCreate={() => openModal(<CreditCardModal mode="create" />)}
                />
            </div>

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {visibleCreditCards.length < 1 ? (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3 text-sm text-white/45">Nenhum cartão para os filtros atuais.</div>
                ) : (
                    <div className="space-y-2">
                        {visibleCreditCards.map((creditCard, index) => {
                            const isFavorite = creditCard.id === favoriteCreditCardId;

                            return (
                                <motion.article
                                    key={creditCard.id}
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, delay: index * 0.03, ease: "easeOut" }}
                                    className={`flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between ${
                                        creditCard.isActive ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.01] opacity-70"
                                    }`}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <WalletAvatar wallet={creditCard} className="h-14 w-14 rounded-xl border border-white/10" iconSize={30} iconStrokeWidth={1.7} />

                                        <div className="min-w-0 text-left">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-[15px] font-medium text-white">{creditCard.name}</p>
                                                {!creditCard.isActive && (
                                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">
                                                        Arquivado
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <p className="rounded-full border border-white/10 bg-neutral-200/5 px-2.5 py-0.5 text-xs text-white/45">
                                                    Limite: {currencyFormatter.format(creditCard.limit)}
                                                </p>
                                                <p className="rounded-full border border-white/10 bg-neutral-200/5 px-2.5 py-0.5 text-xs text-white/45">
                                                    Fechamento: {creditCard.closingDay}
                                                </p>
                                                <p className="rounded-full border border-white/10 bg-neutral-200/5 px-2.5 py-0.5 text-xs text-white/45">
                                                    Vencimento: {creditCard.dueDay}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openModal(<CreditCardModal mode="edit" creditCardId={creditCard.id} />)}
                                            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-white/70 transition-all hover:border-white/[0.2] hover:text-white"
                                        >
                                            <Pencil size={14} />
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (creditCard.isActive) {
                                                    void setFavoriteCreditCard(creditCard.id);
                                                }
                                            }}
                                            disabled={!creditCard.isActive}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition-all ${
                                                isFavorite
                                                    ? "border-amber-200/35 bg-amber-300/10 text-amber-200"
                                                    : creditCard.isActive
                                                      ? "border-white/[0.12] bg-white/[0.03] text-white/70 hover:border-white/[0.2] hover:text-white"
                                                      : "border-white/[0.1] bg-white/[0.02] text-white/40"
                                            }`}
                                        >
                                            <Star size={14} className={isFavorite ? "fill-amber-200 text-amber-200" : ""} />
                                            {isFavorite ? "Favorito" : "Marcar favorito"}
                                        </button>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
