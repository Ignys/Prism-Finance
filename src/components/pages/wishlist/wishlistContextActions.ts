import type { WishItem } from "../../../context/FinanceContext";

export type WishlistContextActionId = "create_expense" | "edit" | "open_link" | "remove";

export interface WishlistContextAction {
    id: WishlistContextActionId;
    label: string;
    tone?: "default" | "danger";
    disabled?: boolean;
}

export function buildWishlistContextActions(wishItem: WishItem): WishlistContextAction[] {
    return [
        {
            id: "create_expense",
            label: "Criar despesa",
        },
        {
            id: "edit",
            label: "Editar item",
        },
        {
            id: "open_link",
            label: "Abrir link",
            disabled: !wishItem.link,
        },
        {
            id: "remove",
            label: "Remover item",
            tone: "danger",
        },
    ];
}
