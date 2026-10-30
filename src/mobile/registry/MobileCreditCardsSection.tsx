import { useMemo, useState } from "react";
import { CreditCardModal } from "../../components/modal/CreditCardModal";
import { RegistryCreditCardCycle } from "../../components/pages/registry/RegistryCreditCardCycle";
import { hasCreditCardActivity } from "../../components/pages/registry/registryAssetActivity";
import { buildRegistryAssetActions } from "../../components/pages/registry/registryAssetTypes";
import { useRegistryAssetActionHandler } from "../../components/pages/registry/useRegistryAssetActionHandler";
import { useFinanceCreditCardInvoices, useFinanceCreditCards, useFinanceFavoriteCreditCard, useFinanceStoredTransactions, useFinanceTransactionGroups } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { MobileActionSheet } from "../MobileActionSheet";
import { MobileAssetList, MobileAssetTotal } from "./MobileAssetList";
import { MobileListToolbar } from "../MobileListToolbar";

export function MobileCreditCardsSection() {
    const creditCards = useFinanceCreditCards();
    const invoices = useFinanceCreditCardInvoices();
    const transactionGroups = useFinanceTransactionGroups();
    const transactions = useFinanceStoredTransactions();
    const favoriteCardId = useFinanceFavoriteCreditCard();
    const { openModal } = useModal();
    const handleAction = useRegistryAssetActionHandler("creditCard");
    const [showArchived, setShowArchived] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const visible = useMemo(
        () => creditCards.filter((card) => showArchived || card.isActive).sort((a, b) => Number(b.id === favoriteCardId) - Number(a.id === favoriteCardId)),
        [creditCards, favoriteCardId, showArchived],
    );
    const active = creditCards.filter((card) => card.isActive);
    const selected = creditCards.find((card) => card.id === selectedId) ?? null;
    const actions = selected
        ? buildRegistryAssetActions({
              kind: "creditCard",
              isActive: selected.isActive,
              isFavorite: selected.id === favoriteCardId,
              hasActivity: hasCreditCardActivity(selected.id, transactionGroups, transactions, invoices),
          })
        : [];

    return (
        <div className="space-y-5">
            <MobileAssetTotal label="Limite total dos cartões ativos" items={active.map((card) => ({ id: card.id, color: card.color, value: card.limit }))} />
            <MobileListToolbar
                countLabel={active.length === 1 ? "1 cartão ativo" : `${active.length} cartões ativos`}
                toggleLabel={showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
                createLabel="Novo cartão"
                onToggle={() => setShowArchived((current) => !current)}
                onCreate={() => openModal(<CreditCardModal mode="create" />)}
            />
            <MobileAssetList
                emptyMessage="Nenhum cartão por aqui. Toque em Novo cartão para cadastrar um."
                onSelect={setSelectedId}
                items={visible.map((card) => ({
                    asset: card,
                    isFavorite: card.id === favoriteCardId,
                    subtitle: <RegistryCreditCardCycle closingDay={card.closingDay} dueDay={card.dueDay} color={card.color} isActive={card.isActive} />,
                    value: card.limit,
                }))}
            />
            <MobileActionSheet
                title={selected?.name ?? ""}
                actions={actions}
                onClose={() => setSelectedId(null)}
                onSelect={(action) => {
                    setSelectedId(null);
                    if (selected) handleAction(selected, action);
                }}
            />
        </div>
    );
}
