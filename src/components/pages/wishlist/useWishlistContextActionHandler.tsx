import type { WishItem } from "../../../context/FinanceContext";
import { useFinanceActions } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { AddTransactionModal } from "../../modal/AddTransaction";
import { AddWishItem } from "../../modal/AddWishItem";
import { ConfirmActionModal } from "../../modal/ConfirmActionModal";
import type { WishlistContextAction } from "./wishlistContextActions";

function resolveWishLink(link: string | null): string | null {
    if (!link?.trim()) {
        return null;
    }

    if (/^https?:\/\//i.test(link)) {
        return link;
    }

    return `https://${link}`;
}

function openExternalLink(link: string) {
    const openedWindow = window.open(link, "_blank", "noopener,noreferrer");
    if (openedWindow) {
        openedWindow.opener = null;
    }
}

export function useWishlistContextActionHandler() {
    const { removeWishItem } = useFinanceActions();
    const { openModal } = useModal();

    return (wishItem: WishItem, action: WishlistContextAction) => {
        if (action.id === "create_expense") {
            openModal(
                <AddTransactionModal
                    type="spending"
                    prefill={{
                        initialAmount: wishItem.value,
                        initialCategoryId: wishItem.categoryId,
                        initialDescription: wishItem.description,
                    }}
                />,
            );
            return;
        }

        if (action.id === "edit") {
            openModal(<AddWishItem mode="edit" wishItemId={wishItem.id} />);
            return;
        }

        if (action.id === "open_link") {
            const resolvedLink = resolveWishLink(wishItem.link);
            if (resolvedLink) {
                openExternalLink(resolvedLink);
            }
            return;
        }

        if (action.id === "remove") {
            openModal(
                <ConfirmActionModal
                    title="Remover item?"
                    description={`Essa acao remove "${wishItem.description}" da sua lista de desejos.`}
                    confirmLabel="Remover item"
                    tone="danger"
                    onConfirm={() => removeWishItem(wishItem.id)}
                />,
            );
        }
    };
}
