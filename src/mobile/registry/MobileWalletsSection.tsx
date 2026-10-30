import { useMemo, useState } from "react";
import { BalanceModal } from "../../components/modal/BalanceModal";
import { hasWalletActivity } from "../../components/pages/registry/registryAssetActivity";
import { buildRegistryAssetActions } from "../../components/pages/registry/registryAssetTypes";
import { formatRegistryCurrency } from "../../components/pages/registry/registryFormatters";
import { useRegistryAssetActionHandler } from "../../components/pages/registry/useRegistryAssetActionHandler";
import { DEFAULT_WALLET_ID, useFinanceFavoriteWallet, useFinanceLedgerEntries, useFinanceStoredTransactions, useFinanceTransactionGroups, useFinanceWallets } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { MobileActionSheet } from "../MobileActionSheet";
import { MobileAssetList, MobileAssetTotal } from "./MobileAssetList";
import { MobileListToolbar } from "../MobileListToolbar";

export function MobileWalletsSection() {
    const wallets = useFinanceWallets();
    const transactionGroups = useFinanceTransactionGroups();
    const transactions = useFinanceStoredTransactions();
    const ledgerEntries = useFinanceLedgerEntries();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const { openModal } = useModal();
    const handleAction = useRegistryAssetActionHandler("wallet");
    const [showArchived, setShowArchived] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const visible = useMemo(
        () => wallets.filter((wallet) => showArchived || wallet.isActive).sort((a, b) => Number(b.id === favoriteWalletId) - Number(a.id === favoriteWalletId)),
        [favoriteWalletId, showArchived, wallets],
    );
    const active = wallets.filter((wallet) => wallet.isActive);
    const selected = wallets.find((wallet) => wallet.id === selectedId) ?? null;
    const actions = selected
        ? buildRegistryAssetActions({
              kind: "wallet",
              isActive: selected.isActive,
              isFavorite: selected.id === favoriteWalletId,
              hasActivity: hasWalletActivity(selected.id, transactionGroups, transactions, ledgerEntries),
              canManageLifecycle: selected.id !== DEFAULT_WALLET_ID,
          })
        : [];

    return (
        <div className="space-y-5">
            <MobileAssetTotal label="Total nas carteiras ativas" items={active.map((wallet) => ({ id: wallet.id, color: wallet.color, value: wallet.balance }))} />
            <MobileListToolbar
                countLabel={active.length === 1 ? "1 carteira ativa" : `${active.length} carteiras ativas`}
                toggleLabel={showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
                createLabel="Nova carteira"
                onToggle={() => setShowArchived((current) => !current)}
                onCreate={() => openModal(<BalanceModal mode="create" />)}
            />
            <MobileAssetList
                emptyMessage="Nenhuma carteira por aqui. Toque em Nova carteira para criar uma."
                onSelect={setSelectedId}
                items={visible.map((wallet) => ({
                    asset: wallet,
                    isFavorite: wallet.id === favoriteWalletId,
                    subtitle: `${wallet.isActive ? "Saldo inicial" : "Arquivada, saldo inicial"} ${formatRegistryCurrency(wallet.initialBalance)}`,
                    value: wallet.balance,
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
