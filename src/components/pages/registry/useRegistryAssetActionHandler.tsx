import type { CreditCard, Wallet } from "../../../context/FinanceContext";
import { useFinanceActions } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { BalanceModal } from "../../modal/BalanceModal";
import { ConfirmActionModal } from "../../modal/ConfirmActionModal";
import { CreditCardModal } from "../../modal/CreditCardModal";
import type { RegistryAssetAction, RegistryAssetKind } from "./registryAssetTypes";

export function useRegistryAssetActionHandler(kind: "wallet"):
    (asset: Wallet, action: RegistryAssetAction) => void;
export function useRegistryAssetActionHandler(kind: "creditCard"):
    (asset: CreditCard, action: RegistryAssetAction) => void;
export function useRegistryAssetActionHandler(kind: RegistryAssetKind) {
    const {
        permanentlyDeleteCreditCard,
        permanentlyDeleteWallet,
        setCreditCardActive,
        setFavoriteCreditCard,
        setFavoriteWallet,
        setWalletActive,
    } = useFinanceActions();
    const { openModal } = useModal();

    return (asset: Wallet | CreditCard, action: RegistryAssetAction) => {
        const isWallet = kind === "wallet";
        const assetLabel = isWallet ? "carteira" : "cartão";

        if (action.id === "edit") {
            openModal(isWallet ? <BalanceModal mode="edit" walletId={asset.id} /> : <CreditCardModal mode="edit" creditCardId={asset.id} />);
            return;
        }

        if (action.id === "favorite") {
            void (isWallet ? setFavoriteWallet(asset.id) : setFavoriteCreditCard(asset.id));
            return;
        }

        if (action.id === "archive") {
            void (isWallet ? setWalletActive(asset.id, false) : setCreditCardActive(asset.id, false));
            return;
        }

        if (action.id === "restore") {
            void (isWallet ? setWalletActive(asset.id, true) : setCreditCardActive(asset.id, true));
            return;
        }

        if (action.id === "remove") {
            openModal(
                <ConfirmActionModal
                    title={`Excluir ${assetLabel} em definitivo?`}
                    description={`O cadastro "${asset.name}" será removido permanentemente.`}
                    consequences={["Esta ação não pode ser desfeita."]}
                    confirmLabel="Excluir em definitivo"
                    onConfirm={async () => {
                        if (asset.isActive) {
                            await (isWallet ? setWalletActive(asset.id, false) : setCreditCardActive(asset.id, false));
                        }
                        await (isWallet ? permanentlyDeleteWallet(asset.id) : permanentlyDeleteCreditCard(asset.id));
                    }}
                />,
            );
        }
    };
}
