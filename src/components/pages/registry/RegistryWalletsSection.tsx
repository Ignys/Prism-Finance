import { useMemo, useState } from "react";
import {
    DEFAULT_WALLET_ID,
    useFinanceFavoriteWallet,
    useFinanceLedgerEntries,
    useFinanceStoredTransactions,
    useFinanceTransactionGroups,
    useFinanceWallets,
} from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { BalanceModal } from "../../modal/BalanceModal";
import { RegistryAssetCard } from "./RegistryAssetCard";
import { RegistryAssetContextMenu } from "./RegistryAssetContextMenu";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";
import { hasWalletActivity } from "./registryAssetActivity";
import { buildRegistryAssetActions } from "./registryAssetTypes";
import { formatRegistryCurrency } from "./registryFormatters";
import { useRegistryAssetActionHandler } from "./useRegistryAssetActionHandler";
import { useRegistryAssetMenu } from "./useRegistryAssetMenu";

export function RegistryWalletsSection() {
    const wallets = useFinanceWallets();
    const transactionGroups = useFinanceTransactionGroups();
    const transactions = useFinanceStoredTransactions();
    const ledgerEntries = useFinanceLedgerEntries();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const { openModal } = useModal();
    const [showArchivedWallets, setShowArchivedWallets] = useState(false);
    const { menuState, openMenu, closeMenu } = useRegistryAssetMenu();
    const handleAssetAction = useRegistryAssetActionHandler("wallet");

    const visibleWallets = useMemo(() => wallets.filter((wallet) => showArchivedWallets || wallet.isActive), [showArchivedWallets, wallets]);
    const activityByWalletId = useMemo(
        () => new Map(wallets.map((wallet) => [wallet.id, hasWalletActivity(wallet.id, transactionGroups, transactions, ledgerEntries)])),
        [ledgerEntries, transactionGroups, transactions, wallets],
    );
    const selectedWallet = menuState ? wallets.find((wallet) => wallet.id === menuState.assetId) ?? null : null;
    const selectedActions = selectedWallet
        ? buildRegistryAssetActions({
              kind: "wallet",
              isActive: selectedWallet.isActive,
              isFavorite: selectedWallet.id === favoriteWalletId,
              hasActivity: activityByWalletId.get(selectedWallet.id) ?? false,
              canManageLifecycle: selectedWallet.id !== DEFAULT_WALLET_ID,
          })
        : [];
    const activeCount = wallets.filter((wallet) => wallet.isActive).length;
    const visibleCount = showArchivedWallets ? wallets.length : activeCount;

    return (
        <section className="flex h-full min-h-0 flex-col rounded-xl">
            <RegistrySectionHeader
                title="Suas carteiras"
                visibleCount={visibleCount}
                isShowingInactive={showArchivedWallets}
                showLabel="Mostrar arquivadas"
                hideLabel="Ocultar arquivadas"
                createLabel="Nova carteira"
                onToggleInactive={() => setShowArchivedWallets((current) => !current)}
                onCreate={() => openModal(<BalanceModal mode="create" />)}
            />

            <div className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
                {visibleWallets.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-white/45">Nenhuma carteira para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleWallets.map((wallet, index) => (
                            <RegistryAssetCard
                                key={wallet.id}
                                asset={wallet}
                                assetTypeLabel="Carteira"
                                archivedLabel="Arquivada"
                                index={index}
                                isActive={wallet.isActive}
                                isFavorite={wallet.id === favoriteWalletId}
                                metrics={[
                                    { label: "Saldo atual", value: formatRegistryCurrency(wallet.balance), emphasis: true },
                                    { label: "Saldo inicial", value: formatRegistryCurrency(wallet.initialBalance) },
                                ]}
                                onOpenContextMenu={(x, y) => openMenu(wallet.id, x, y)}
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
                    if (selectedWallet) {
                        handleAssetAction(selectedWallet, action);
                    }
                    closeMenu();
                }}
            />
        </section>
    );
}
