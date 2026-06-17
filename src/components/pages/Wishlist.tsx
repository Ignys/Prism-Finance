import { ExternalLink, Flag, Gift, Plus, Search, UserRound } from "lucide-react";
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
        <div className="mb-3 h-40 w-full overflow-hidden rounded-2xl border-white/[0.08] bg-black/20 sm:mb-0 sm:h-full sm:w-30 sm:shrink-0">
            <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} className="h-full w-full object-cover" />
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
            <div className="flex min-h-[calc(100vh-8rem)] w-full flex-col">
                <header className="flex flex-wrap items-end justify-between gap-2 text-left mb-3">
                    {hasFamilyTabs ? (
                        <div className="flex flex-wrap gap-2">
                            {wishlistTabs
                                .sort((a, b) => Number(b.owner.isCurrentUser) - Number(a.owner.isCurrentUser))
                                .map((snapshot) => {
                                    const isActive = snapshot.owner.uid === activeWishlist.owner.uid;
                                    const iconContainerClass = isActive
                                        ? "border-neutral-300/45 bg-neutral-500/18 text-neutral-100"
                                        : "border-neutral-400/20 bg-neutral-500/10 text-neutral-300/85 group-hover:border-neutral-300/35 group-hover:bg-neutral-500/16 group-hover:text-neutral-200";

                                    return (
                                        <button
                                            key={snapshot.owner.uid}
                                            type="button"
                                            onClick={() => setActiveOwnerUid(snapshot.owner.uid)}
                                            className={`group inline-flex items-center gap-2 rounded-xl text-sm border pl-2 pr-3 py-2 text-left transition-all duration-200 ${
                                                isActive ? "border-neutral-300/30 bg-neutral-500/14 text-neutral-50" : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white"
                                            }`}
                                        >
                                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${iconContainerClass}`}>
                                                <UserRound size={18} strokeWidth={2.2} />
                                            </span>

                                            {snapshot.owner.isCurrentUser ? "Lista de Desejos" : snapshot.owner.name}
                                        </button>
                                        //                                         <button
                                        //     type="button"
                                        //     key={tab.key}
                                        //     onClick={() => onTabChange(tab.key)}
                                        //     aria-pressed={isActive}
                                        //     className={`group inline-flex items-center gap-2 rounded-xl border pl-2 pr-3 py-2 text-left transition-all duration-200 ${
                                        //         isActive
                                        //             ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50"
                                        //             : "border-white/[0.09] bg-white/[0.02] text-white/80 hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white"
                                        //     }`}
                                        // >
                                        //     <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${iconContainerClass}`}>
                                        //         <Icon size={18} strokeWidth={2.2} />
                                        //     </span>
                                        //     <span className="text-sm">{tab.label}</span>
                                        // </button>
                                    );
                                })}
                        </div>
                    ) : null}

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        {isOwnWishlist ? (
                            <button
                                type="button"
                                onClick={() => openModal(<AddWishItem />)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-xs font-medium uppercase text-emerald-100 transition-colors hover:bg-emerald-500/16 sm:flex-none"
                            >
                                <Plus size={12} />
                                Adicionar novo item
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => setSortOption((current) => (current === "price" ? "priority" : "price"))}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase text-white/80 transition-colors hover:text-white sm:flex-none"
                        >
                            Ordenar por: {sortLabel}
                        </button>
                    </div>
                </header>

                <section className="">
                    <div className="relative w-full mb-3">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Buscar"
                            className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
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
                                        className={`flex h-auto min-w-0 flex-col justify-between gap-4 rounded-2xl bg-white/[0.03] p-4 text-left sm:min-h-35 sm:flex-row ${
                                            isOwnWishlist ? "cursor-pointer transition-colors hover:border-neutral-300/20 hover:bg-white/[0.05]" : ""
                                        }`}
                                    >
                                        <WishlistItemImage src={wishItem.imageUrl} alt={wishItem.description} />
                                        <div className="flex min-w-0 grow flex-col justify-between">
                                            <div>
                                                <div className="mb-1 flex items-start gap-3">
                                                    <h2 className="break-words text-lg font-normal text-white sm:text-xl">{wishItem.description}</h2>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-2">
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
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
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
