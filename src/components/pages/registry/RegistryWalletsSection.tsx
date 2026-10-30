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
import { RegistryAssetContextMenu } from "./RegistryAssetContextMenu";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";
import { hasWalletActivity } from "./registryAssetActivity";
import { buildRegistryAssetActions } from "./registryAssetTypes";
import { TrendingDown, TrendingUp } from "lucide-react";
import { RegistryAssetRow } from "./RegistryAssetRow";
import { RegistryAssetSummary } from "./RegistryAssetSummary";
import { formatRegistryCurrency } from "./registryFormatters";
import { useRegistryAssetActionHandler } from "./useRegistryAssetActionHandler";
import { useRegistryAssetMenu } from "./useRegistryAssetMenu";

function WalletDelta({ delta }: { delta: number }) {
    const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

    return (
        <p className={`flex items-center justify-end gap-1 text-xs tabular-nums ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-white/40"}`}>
            {delta !== 0 ? <DeltaIcon size={12} /> : null}
            {delta > 0 ? "+" : ""}
            {formatRegistryCurrency(delta)}
        </p>
    );
}

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

    const visibleWallets = useMemo(
        () =>
            wallets
                .filter((wallet) => showArchivedWallets || wallet.isActive)
                .sort((a, b) => Number(b.id === favoriteWalletId) - Number(a.id === favoriteWalletId)),
        [favoriteWalletId, showArchivedWallets, wallets],
    );
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

            <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <div className="elegant-scrollbar order-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2 lg:order-1">
                {visibleWallets.length < 1 ? (
                    <RegistryListItemEntrance index={0}>
                        <div className="py-4 text-sm text-white/45">Nenhuma carteira para os filtros atuais.</div>
                    </RegistryListItemEntrance>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {visibleWallets.map((wallet, index) => (
                            <RegistryAssetRow
                                key={wallet.id}
                                asset={wallet}
                                index={index}
                                isFavorite={wallet.id === favoriteWalletId}
                                favoriteLabel="Favorita"
                                subtitle={`${wallet.isActive ? "Saldo inicial" : "Arquivada · saldo inicial"} ${formatRegistryCurrency(wallet.initialBalance)}`}
                                value={formatRegistryCurrency(wallet.balance)}
                                isValueNegative={wallet.balance < 0}
                                detail={<WalletDelta delta={wallet.balance - wallet.initialBalance} />}
                                ariaLabel={`${wallet.name}, saldo ${formatRegistryCurrency(wallet.balance)}`}
                                onOpenContextMenu={(x, y) => openMenu(wallet.id, x, y)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <RegistryAssetSummary
                label="Total nas carteiras ativas"
                countLabel={activeCount === 1 ? "1 carteira" : `${activeCount} carteiras`}
                distributionLabel="Distribuição do saldo entre carteiras"
                items={wallets.filter((wallet) => wallet.isActive).map((wallet) => ({ id: wallet.id, name: wallet.name, color: wallet.color, value: wallet.balance }))}
            />
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
