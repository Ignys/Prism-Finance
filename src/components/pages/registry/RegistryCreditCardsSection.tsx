import { useMemo, useState } from "react";
import {
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceFavoriteCreditCard,
    useFinanceStoredTransactions,
    useFinanceTransactionGroups,
} from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { CreditCardModal } from "../../modal/CreditCardModal";
import { RegistryAssetCard } from "./RegistryAssetCard";
import { RegistryAssetContextMenu } from "./RegistryAssetContextMenu";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";
import { hasCreditCardActivity } from "./registryAssetActivity";
import { buildRegistryAssetActions } from "./registryAssetTypes";
import { formatRegistryCurrency } from "./registryFormatters";
import { useRegistryAssetActionHandler } from "./useRegistryAssetActionHandler";
import { useRegistryAssetMenu } from "./useRegistryAssetMenu";

export function RegistryCreditCardsSection() {
    const creditCards = useFinanceCreditCards();
    const invoices = useFinanceCreditCardInvoices();
    const transactionGroups = useFinanceTransactionGroups();
    const transactions = useFinanceStoredTransactions();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { openModal } = useModal();
    const [showArchivedCreditCards, setShowArchivedCreditCards] = useState(false);
    const { menuState, openMenu, closeMenu } = useRegistryAssetMenu();
    const handleAssetAction = useRegistryAssetActionHandler("creditCard");

    const visibleCreditCards = useMemo(() => creditCards.filter((card) => showArchivedCreditCards || card.isActive), [creditCards, showArchivedCreditCards]);
    const activityByCreditCardId = useMemo(
        () => new Map(creditCards.map((card) => [card.id, hasCreditCardActivity(card.id, transactionGroups, transactions, invoices)])),
        [creditCards, invoices, transactionGroups, transactions],
    );
    const selectedCreditCard = menuState ? creditCards.find((card) => card.id === menuState.assetId) ?? null : null;
    const selectedActions = selectedCreditCard
        ? buildRegistryAssetActions({
              kind: "creditCard",
              isActive: selectedCreditCard.isActive,
              isFavorite: selectedCreditCard.id === favoriteCreditCardId,
              hasActivity: activityByCreditCardId.get(selectedCreditCard.id) ?? false,
          })
        : [];
    const activeCount = creditCards.filter((card) => card.isActive).length;
    const visibleCount = showArchivedCreditCards ? creditCards.length : activeCount;

    return (
        <section className="flex h-full min-h-0 flex-col">
            <RegistrySectionHeader
                title="Seus cartões de crédito"
                visibleCount={visibleCount}
                isShowingInactive={showArchivedCreditCards}
                showLabel="Mostrar arquivados"
                hideLabel="Ocultar arquivados"
                createLabel="Novo cartão"
                onToggleInactive={() => setShowArchivedCreditCards((current) => !current)}
                onCreate={() => openModal(<CreditCardModal mode="create" />)}
            />

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {visibleCreditCards.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-white/45">Nenhum cartão para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleCreditCards.map((creditCard, index) => (
                            <RegistryAssetCard
                                key={creditCard.id}
                                asset={creditCard}
                                assetTypeLabel="Cartão de crédito"
                                archivedLabel="Arquivado"
                                index={index}
                                isActive={creditCard.isActive}
                                isFavorite={creditCard.id === favoriteCreditCardId}
                                metrics={[
                                    { label: "Limite", value: formatRegistryCurrency(creditCard.limit), emphasis: true, wide: true },
                                    { label: "Fechamento", value: `Dia ${creditCard.closingDay}` },
                                    { label: "Vencimento", value: `Dia ${creditCard.dueDay}` },
                                ]}
                                onOpenContextMenu={(x, y) => openMenu(creditCard.id, x, y)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <RegistryAssetContextMenu
                state={menuState}
                actions={selectedActions}
                onClose={closeMenu}
                onSelect={(action) => {
                    if (selectedCreditCard) {
                        handleAssetAction(selectedCreditCard, action);
                    }
                    closeMenu();
                }}
            />
        </section>
    );
}
