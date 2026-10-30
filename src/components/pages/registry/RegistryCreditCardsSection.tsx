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
import { RegistryAssetRow } from "./RegistryAssetRow";
import { RegistryAssetSummary } from "./RegistryAssetSummary";
import { RegistryCreditCardCycle } from "./RegistryCreditCardCycle";
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

    const visibleCreditCards = useMemo(
        () =>
            creditCards
                .filter((card) => showArchivedCreditCards || card.isActive)
                .sort((a, b) => Number(b.id === favoriteCreditCardId) - Number(a.id === favoriteCreditCardId)),
        [creditCards, favoriteCreditCardId, showArchivedCreditCards],
    );
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

            <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <div className="elegant-scrollbar order-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2 lg:order-1">
                {visibleCreditCards.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="py-4 text-sm text-white/45">Nenhum cartão para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {visibleCreditCards.map((creditCard, index) => (
                            <RegistryAssetRow
                                key={creditCard.id}
                                asset={creditCard}
                                index={index}
                                isFavorite={creditCard.id === favoriteCreditCardId}
                                favoriteLabel="Favorito"
                                subtitle={<RegistryCreditCardCycle closingDay={creditCard.closingDay} dueDay={creditCard.dueDay} color={creditCard.color} isActive={creditCard.isActive} />}
                                valueLabel="Limite"
                                value={formatRegistryCurrency(creditCard.limit)}
                                ariaLabel={`${creditCard.name}, limite ${formatRegistryCurrency(creditCard.limit)}`}
                                onOpenContextMenu={(x, y) => openMenu(creditCard.id, x, y)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <RegistryAssetSummary
                label="Limite total dos cartões ativos"
                countLabel={activeCount === 1 ? "1 cartão" : `${activeCount} cartões`}
                distributionLabel="Distribuição do limite entre cartões"
                items={creditCards.filter((card) => card.isActive).map((card) => ({ id: card.id, name: card.name, color: card.color, value: card.limit }))}
            />
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
