export type RegistryAssetKind = "wallet" | "creditCard";

export type RegistryAssetActionId = "edit" | "favorite" | "archive" | "restore" | "remove";

export interface RegistryAssetAction {
    id: RegistryAssetActionId;
    label: string;
    disabled?: boolean;
    tone?: "danger";
}

export interface RegistryAssetMenuState {
    assetId: string;
    x: number;
    y: number;
}

interface BuildRegistryAssetActionsParams {
    kind: RegistryAssetKind;
    isActive: boolean;
    isFavorite: boolean;
    hasActivity: boolean;
    canManageLifecycle?: boolean;
}

export function buildRegistryAssetActions({
    kind,
    isActive,
    isFavorite,
    hasActivity,
    canManageLifecycle = true,
}: BuildRegistryAssetActionsParams): RegistryAssetAction[] {
    const assetLabel = kind === "wallet" ? "carteira" : "cartão";
    const actions: RegistryAssetAction[] = [{ id: "edit", label: `Editar ${assetLabel}` }];

    if (isActive) {
        actions.push({
            id: "favorite",
            label: isFavorite ? (kind === "wallet" ? "Carteira favorita" : "Cartão favorito") : `Marcar ${assetLabel} como favorito`,
            disabled: isFavorite,
        });
    }

    if (!canManageLifecycle) {
        return actions;
    }

    if (!isActive) {
        actions.push({ id: "restore", label: `Restaurar ${assetLabel}` });
        actions.push({ id: "remove", label: `Excluir ${assetLabel} em definitivo`, tone: "danger" });
        return actions;
    }

    actions.push(
        hasActivity
            ? { id: "archive", label: `Arquivar ${assetLabel}` }
            : { id: "remove", label: `Excluir ${assetLabel} em definitivo`, tone: "danger" },
    );

    return actions;
}
