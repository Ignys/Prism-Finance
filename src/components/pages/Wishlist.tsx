import { ExternalLink, Flag, Gift, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SharedWishlistSnapshot } from "../../context/FinanceContext";
import { useFinanceCategories, useFinanceFamily, useFinanceSession, useFinanceSharedWishlists, useFinanceWishItems } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { getWishItemPriorityMeta } from "../../lib/wishlistPriority";
import { resolveUserDisplayName } from "../../lib/userProfile";
import { AuthShell } from "../layout/AuthShell";
import { AddWishItem } from "../modal/AddWishItem";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

function resolveWishLink(link: string | null): string | null {
    if (!link?.trim()) {
        return null;
    }

    if (/^https?:\/\//i.test(link)) {
        return link;
    }

    return `https://${link}`;
}

function WishlistItemImage({ src, alt }: { src: string | null; alt: string }) {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [src]);

    if (!src || hasError) {
        return null;
    }

    return (
        <div className="mb-4 overflow-hidden rounded-2xl h-full w-30 border-white/[0.08] bg-black/20">
            <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} className="w-full h-full object-cover" />
        </div>
    );
}

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

type WishlistSortOption = "price" | "priority";

export function WishlistPage() {
    const { user } = useFinanceSession();
    const family = useFinanceFamily();
    const wishItems = useFinanceWishItems();
    const sharedWishlists = useFinanceSharedWishlists();
    const categories = useFinanceCategories();
    const { openModal } = useModal();
    const [activeOwnerUid, setActiveOwnerUid] = useState("");
    const [sortOption, setSortOption] = useState<WishlistSortOption>("price");
    const [searchTerm, setSearchTerm] = useState("");

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
    const isOwnWishlist = activeWishlist.owner.isCurrentUser;
    const hasFamilyTabs = wishlistTabs.length > 1;
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("pt-BR");
    const sortLabel = sortOption === "price" ? "Preço" : "Prioridade";

    const visibleItems = useMemo(() => {
        const filteredItems = activeWishlist.items.filter((item) => {
            if (!normalizedSearchTerm) {
                return true;
            }

            const searchableContent = [item.description, item.categoryLabel, item.link ?? ""].join(" ").toLocaleLowerCase("pt-BR");
            return searchableContent.includes(normalizedSearchTerm);
        });

        return [...filteredItems].sort((a, b) => {
            if (sortOption === "priority") {
                return b.priority - a.priority || b.value - a.value || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
            }

            return b.value - a.value || b.priority - a.priority || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
        });
    }, [activeWishlist.items, normalizedSearchTerm, sortOption]);

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-[90em] flex-col gap-4 px-4 pb-6 pt-2 lg:px-6">
                <header className="flex flex-wrap items-end justify-between gap-3 text-left">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Lista de desejos</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {isOwnWishlist ? (
                            <button
                                type="button"
                                onClick={() => openModal(<AddWishItem />)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-xs font-medium uppercase text-emerald-100 transition-colors hover:bg-emerald-500/16"
                            >
                                <Plus size={12} />
                                Adicionar novo item
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => setSortOption((current) => (current === "price" ? "priority" : "price"))}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase text-white/80 transition-colors hover:text-white"
                        >
                            Ordenar por: {sortLabel}
                        </button>
                    </div>
                </header>

                {hasFamilyTabs ? (
                    <div className="flex flex-wrap gap-2">
                        {wishlistTabs
                            .sort((a, b) => Number(b.owner.isCurrentUser) - Number(a.owner.isCurrentUser))
                            .map((snapshot) => {
                                const isActive = snapshot.owner.uid === activeWishlist.owner.uid;

                                return (
                                    <button
                                        key={snapshot.owner.uid}
                                        type="button"
                                        onClick={() => setActiveOwnerUid(snapshot.owner.uid)}
                                        className={`rounded-2xl border px-4 py-2 text-sm transition-colors ${
                                            isActive ? "border-emerald-300/30 bg-emerald-500/14 text-emerald-50" : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white"
                                        }`}
                                    >
                                        {snapshot.owner.isCurrentUser ? "Sua lista de desejos" : snapshot.owner.name}
                                    </button>
                                );
                            })}
                    </div>
                ) : null}

                <section className="">
                    <div className="mb-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Pesquisar"
                            className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.22]"
                        />
                    </div>
                    {activeWishlist.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-white/70">
                                <Gift size={22} />
                            </span>
                            <div>
                                <p className="text-base font-medium text-white">{isOwnWishlist ? "Nenhum desejo salvo ainda" : `${activeWishlist.owner.name} não criou uma lista de desejos.`}</p>
                            </div>
                        </div>
                    ) : visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-14 text-center">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-white/70">
                                <Gift size={22} />
                            </span>
                            <div>
                                <p className="text-base font-medium text-white">Nenhum item encontrado para essa busca.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {visibleItems.map((wishItem) => {
                                const resolvedLink = resolveWishLink(wishItem.link);
                                const CategoryIcon = getCategoryIconComponent(wishItem.categoryIcon, "expense");
                                const priorityMeta = getWishItemPriorityMeta(wishItem.priority);
                                const categoryAccentColor = wishItem.categoryColor ?? "#94A3B8";

                                return (
                                    <article
                                        key={wishItem.id}
                                        role={isOwnWishlist ? "button" : undefined}
                                        tabIndex={isOwnWishlist ? 0 : -1}
                                        onClick={isOwnWishlist ? () => openModal(<AddWishItem mode="edit" wishItemId={wishItem.id} />) : undefined}
                                        onKeyDown={
                                            isOwnWishlist
                                                ? (event) => {
                                                      if (event.key === "Enter" || event.key === " ") {
                                                          event.preventDefault();
                                                          openModal(<AddWishItem mode="edit" wishItemId={wishItem.id} />);
                                                      }
                                                  }
                                                : undefined
                                        }
                                        className={`flex gap-4 justify-between rounded-2xl bg-white/[0.03] p-4 text-left h-35 ${
                                            isOwnWishlist ? "cursor-pointer transition-colors hover:border-neutral-300/20 hover:bg-white/[0.05]" : ""
                                        }`}
                                    >
                                        <WishlistItemImage src={wishItem.imageUrl} alt={wishItem.description} />
                                        <div className="grow flex flex-col justify-between">
                                            <div>
                                                <div className="mb-1 flex items-start gap-3">
                                                <h2 className="text-xl font-base text-white">{wishItem.description}</h2>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-light text-white/70">{currencyFormatter.format(wishItem.value)}</p>

                                                <div
                                                    className="inline-flex items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs font-medium"
                                                    style={{
                                                        color: priorityMeta.color,
                                                        borderColor: `${priorityMeta.color}40`,
                                                        backgroundColor: `${priorityMeta.color}14`,
                                                    }}
                                                >
                                                    {Array.from({ length: wishItem.priority }, (_, index) => (
                                                        <Flag key={`${wishItem.id}-priority-flag-${index}`} size={14} />
                                                    ))}
                                                </div>
                                            </div>

                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                                                <span className="inline-flex items-center gap-2 rounded-full border-white/[0.1] text-xs font-medium text-white/75 transition-colors">
                                                    <span
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                                                        style={{
                                                            color: categoryAccentColor,
                                                            borderColor: `${categoryAccentColor}35`,
                                                            backgroundColor: `${categoryAccentColor}18`,
                                                        }}
                                                    >
                                                        <CategoryIcon size={14} />
                                                    </span>
                                                    {wishItem.categoryLabel}
                                                </span>

                                                {resolvedLink ? (
                                                    <a
                                                        href={resolvedLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-white/[0.18] hover:text-white"
                                                    >
                                                        <ExternalLink size={13} />
                                                        Abrir link
                                                    </a>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </AuthShell>
    );
}
