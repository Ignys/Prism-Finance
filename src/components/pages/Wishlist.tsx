import { Gift, Plus, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useModal } from "../../context/ModalContext";
import { AddWishItem } from "../modal/AddWishItem";
import { WishlistItemCard } from "./wishlist/WishlistItemCard";
import { WishlistContextMenu, type WishlistContextMenuState } from "./wishlist/WishlistContextMenu";
import { buildWishlistContextActions, type WishlistContextAction } from "./wishlist/wishlistContextActions";
import { useWishlistContextActionHandler } from "./wishlist/useWishlistContextActionHandler";
import { useWishlistTabs } from "./wishlist/useWishlistTabs";

type WishlistSortOption = "price" | "priority";

const SORT_OPTIONS: { value: WishlistSortOption; label: string }[] = [
    { value: "price", label: "Preço" },
    { value: "priority", label: "Prioridade" },
];

export function WishlistPage() {
    const { wishlistTabs, activeWishlist, setActiveOwnerUid, wishItemById, projectionMonthByWishItemId } = useWishlistTabs();
    const { openModal } = useModal();
    const navigate = useNavigate();
    const handleWishlistContextAction = useWishlistContextActionHandler();
    const [sortOption, setSortOption] = useState<WishlistSortOption>("price");
    const [searchTerm, setSearchTerm] = useState("");
    const [contextMenuState, setContextMenuState] = useState<WishlistContextMenuState | null>(null);
    const isOwnWishlist = activeWishlist.owner.isCurrentUser;
    const hasFamilyTabs = wishlistTabs.length > 1;
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("pt-BR");

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

    const contextMenuActions = useMemo(() => {
        if (!contextMenuState) {
            return [];
        }

        const wishItem = wishItemById.get(contextMenuState.wishItemId);
        return wishItem ? buildWishlistContextActions(wishItem) : [];
    }, [contextMenuState, wishItemById]);

    useEffect(() => {
        setContextMenuState(null);
    }, [activeWishlist.owner.uid]);

    const handleWishItemContextMenu = (event: MouseEvent, wishItemId: string) => {
        if (!isOwnWishlist || !wishItemById.has(wishItemId)) {
            return;
        }

        event.preventDefault();
        setContextMenuState({
            wishItemId,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const handleContextActionSelect = (action: WishlistContextAction) => {
        if (!contextMenuState) {
            return;
        }

        const wishItem = wishItemById.get(contextMenuState.wishItemId);
        setContextMenuState(null);

        if (wishItem) {
            handleWishlistContextAction(wishItem, action);
        }
    };

    const openProjectedWishlistMonth = (event: MouseEvent<HTMLButtonElement>, monthKey: string) => {
        event.stopPropagation();
        navigate(`/planning?month=${encodeURIComponent(monthKey)}&panel=projections`);
    };

    return (
        <>
            <div className="flex min-h-[calc(100vh-8rem)] w-full flex-col">
                {hasFamilyTabs ? (
                    <header className="flex flex-wrap items-end justify-between gap-2 text-left mb-3">
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
                                    );
                                })}
                        </div>
                    </header>
                ) : null}

                <section>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <div className="relative min-w-0 grow basis-56">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar"
                                className="w-full rounded-xl border border-white/[0.08] bg-black/25 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.24] focus:bg-black/40"
                            />
                        </div>

                        <div role="radiogroup" aria-label="Ordenar por" className="inline-flex rounded-xl border border-white/[0.08] bg-black/25 p-0.5 text-xs font-medium">
                            {SORT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={sortOption === option.value}
                                    onClick={() => setSortOption(option.value)}
                                    className={`rounded-lg px-3 py-1.5 transition-colors ${sortOption === option.value ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {isOwnWishlist ? (
                            <button
                                type="button"
                                onClick={() => openModal(<AddWishItem />)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/16"
                            >
                                <Plus size={14} />
                                Adicionar
                            </button>
                        ) : null}
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
                        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {visibleItems.map((wishItem) => (
                                <WishlistItemCard
                                    key={wishItem.id}
                                    item={wishItem}
                                    isEditable={isOwnWishlist}
                                    projectionMonth={isOwnWishlist ? projectionMonthByWishItemId.get(wishItem.id) : null}
                                    onEdit={() => openModal(<AddWishItem mode="edit" wishItemId={wishItem.id} />)}
                                    onContextMenu={(event) => handleWishItemContextMenu(event, wishItem.id)}
                                    onOpenProjectionMonth={openProjectedWishlistMonth}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
            <WishlistContextMenu state={contextMenuState} actions={contextMenuActions} onSelect={handleContextActionSelect} onClose={() => setContextMenuState(null)} />
        </>
    );
}
