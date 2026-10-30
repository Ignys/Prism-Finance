import { useEffect, useMemo, useState } from "react";
import type { SharedWishlistSnapshot, WishItem } from "../../../context/FinanceContext";
import { useFinanceCategories, useFinanceFamily, useFinancePlanning, useFinanceSession, useFinanceSharedWishlists, useFinanceWishItems } from "../../../context/FinanceContext";
import { resolveUserDisplayName } from "../../../lib/userProfile";
import { getCurrentMonthKey } from "../planning/planningTimelineUtils";
import { buildWishlistProjectionMonthByItemId } from "./wishlistProjectionMonths";

function buildEmptyWishlist(ownerUid: string, ownerName: string, isCurrentUser: boolean): SharedWishlistSnapshot {
    return {
        owner: {
            uid: ownerUid,
            name: ownerName,
            isCurrentUser,
        },
        items: [],
        updatedAt: "",
    };
}

// One tab per active family member (or just the user's own list), shared by the desktop and mobile wishlist pages.
export function useWishlistTabs() {
    const { user } = useFinanceSession();
    const family = useFinanceFamily();
    const wishItems = useFinanceWishItems();
    const sharedWishlists = useFinanceSharedWishlists();
    const planning = useFinancePlanning();
    const categories = useFinanceCategories();
    const [activeOwnerUid, setActiveOwnerUid] = useState("");

    const categoryNameById = useMemo(() => {
        const next = new Map<string, string>();
        categories.forEach((category) => {
            next.set(category.id, category.name);
        });
        return next;
    }, [categories]);

    const categoryIconById = useMemo(() => {
        const next = new Map<string, string>();
        categories.forEach((category) => {
            next.set(category.id, category.icon);
        });
        return next;
    }, [categories]);

    const categoryColorById = useMemo(() => {
        const next = new Map<string, string | null>();
        categories.forEach((category) => {
            next.set(category.id, category.color);
        });
        return next;
    }, [categories]);

    const wishItemById = useMemo(() => {
        const next = new Map<string, WishItem>();
        wishItems.forEach((item) => {
            next.set(item.id, item);
        });
        return next;
    }, [wishItems]);

    const ownWishlistSnapshot = useMemo<SharedWishlistSnapshot>(() => {
        const ownerUid = user?.uid ?? "self";
        const ownerName = resolveUserDisplayName(user);
        const items = wishItems
            .filter((item) => item.isActive)
            .map((item) => ({
                id: item.id,
                description: item.description,
                value: item.value,
                priority: item.priority,
                link: item.link,
                imageUrl: item.imageUrl,
                createdAt: item.createdAt,
                isActive: item.isActive,
                categoryLabel: categoryNameById.get(item.categoryId) ?? "Categoria removida",
                categoryIcon: categoryIconById.get(item.categoryId) ?? "",
                categoryColor: categoryColorById.get(item.categoryId) ?? null,
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

        return {
            owner: {
                uid: ownerUid,
                name: ownerName,
                isCurrentUser: true,
            },
            items,
            updatedAt: items[0]?.createdAt ?? "",
        };
    }, [categoryColorById, categoryIconById, categoryNameById, user, wishItems]);

    const wishlistTabs = useMemo(() => {
        const currentUserUid = user?.uid ?? ownWishlistSnapshot.owner.uid;
        const sharedByOwnerUid = new Map(sharedWishlists.map((snapshot) => [snapshot.owner.uid, snapshot]));
        const activeMembers = family?.members.filter((member) => member.status === "active") ?? [];

        if (activeMembers.length === 0) {
            return [ownWishlistSnapshot];
        }

        return activeMembers.map((member) => {
            if (member.uid === currentUserUid) {
                return {
                    ...ownWishlistSnapshot,
                    owner: {
                        uid: currentUserUid,
                        name: member.displayName,
                        isCurrentUser: true,
                    },
                };
            }

            return sharedByOwnerUid.get(member.uid) ?? buildEmptyWishlist(member.uid, member.displayName, false);
        });
    }, [family?.members, ownWishlistSnapshot, sharedWishlists, user?.uid]);

    useEffect(() => {
        if (wishlistTabs.length === 0) {
            setActiveOwnerUid("");
            return;
        }

        const activeTabStillExists = wishlistTabs.some((snapshot) => snapshot.owner.uid === activeOwnerUid);
        if (!activeTabStillExists) {
            setActiveOwnerUid(wishlistTabs[0].owner.uid);
        }
    }, [activeOwnerUid, wishlistTabs]);

    const activeWishlist = useMemo(
        () => wishlistTabs.find((snapshot) => snapshot.owner.uid === activeOwnerUid) ?? wishlistTabs[0] ?? ownWishlistSnapshot,
        [activeOwnerUid, ownWishlistSnapshot, wishlistTabs],
    );

    const projectionMonthByWishItemId = useMemo(() => buildWishlistProjectionMonthByItemId(planning, getCurrentMonthKey()), [planning]);

    return { wishlistTabs, activeWishlist, setActiveOwnerUid, wishItemById, projectionMonthByWishItemId };
}
