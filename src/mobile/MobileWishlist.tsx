import { ExternalLink, Gift, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddWishItem } from "../components/modal/AddWishItem";
import { buildWishlistContextActions } from "../components/pages/wishlist/wishlistContextActions";
import { useWishlistContextActionHandler } from "../components/pages/wishlist/useWishlistContextActionHandler";
import { useWishlistTabs } from "../components/pages/wishlist/useWishlistTabs";
import type { SharedWishlistSnapshot } from "../context/FinanceContext";
import { useModal } from "../context/ModalContext";
import { getCategoryIconComponent } from "../lib/categoryIcons";
import { getWishItemPriorityMeta } from "../lib/wishlistPriority";
import { MobileActionSheet } from "./MobileActionSheet";
import { LABEL_CLASS, Money } from "./MobileHeader";
import { MobileListToolbar } from "./MobileListToolbar";

type WishlistItem = SharedWishlistSnapshot["items"][number];
type SortOption = "price" | "priority";

function resolveLink(link: string | null) {
    if (!link?.trim()) return null;
    return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function WishThumb({ item }: { item: WishlistItem }) {
    const [broken, setBroken] = useState(false);
    const color = item.categoryColor ?? "#94A3B8";
    const Icon = getCategoryIconComponent(item.categoryIcon, "expense");

    if (item.imageUrl && !broken) {
        return <img src={item.imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />;
    }
    return (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl" style={{ color, backgroundColor: `${color}1a` }}>
            <Icon size={24} strokeWidth={1.6} />
        </span>
    );
}

export function MobileWishlist() {
    const { wishlistTabs, activeWishlist, setActiveOwnerUid, wishItemById, projectionMonthByWishItemId } = useWishlistTabs();
    const { openModal } = useModal();
    const navigate = useNavigate();
    const handleAction = useWishlistContextActionHandler();
    const [sort, setSort] = useState<SortOption>("price");
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const isOwn = activeWishlist.owner.isCurrentUser;

    const items = useMemo(() => {
        const search = query.trim().toLocaleLowerCase("pt-BR");
        return activeWishlist.items
            .filter((item) => !search || [item.description, item.categoryLabel, item.link ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(search))
            .sort((a, b) => (sort === "priority" ? b.priority - a.priority || b.value - a.value : b.value - a.value || b.priority - a.priority) || b.createdAt.localeCompare(a.createdAt));
    }, [activeWishlist.items, query, sort]);

    const total = activeWishlist.items.reduce((sum, item) => sum + item.value, 0);
    const selected = selectedId ? (wishItemById.get(selectedId) ?? null) : null;

    const handleTap = (item: WishlistItem) => {
        if (isOwn) {
            setSelectedId(item.id);
            return;
        }
        const link = resolveLink(item.link);
        if (link) window.open(link, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="space-y-5 pb-4">
            {wishlistTabs.length > 1 && (
                <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]" role="tablist" aria-label="Listas da família">
                    {[...wishlistTabs]
                        .sort((a, b) => Number(b.owner.isCurrentUser) - Number(a.owner.isCurrentUser))
                        .map((snapshot) => {
                            const active = snapshot.owner.uid === activeWishlist.owner.uid;
                            return (
                                <button
                                    key={snapshot.owner.uid}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveOwnerUid(snapshot.owner.uid)}
                                    className={`shrink-0 rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                                        active ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50" : "border-transparent bg-white/[0.03] text-neutral-400"
                                    }`}
                                >
                                    {snapshot.owner.isCurrentUser ? "Minha lista" : snapshot.owner.name}
                                </button>
                            );
                        })}
                </div>
            )}

            <section className="px-1">
                <p className={LABEL_CLASS}>{isOwn ? "Total dos seus desejos" : `Desejos de ${activeWishlist.owner.name}`}</p>
                <Money value={total} className="mt-1 block text-2xl leading-none tracking-[-0.03em] text-white" />
            </section>

            {isOwn && (
                <MobileListToolbar
                    countLabel={activeWishlist.items.length === 1 ? "1 desejo" : `${activeWishlist.items.length} desejos`}
                    toggleLabel={sort === "priority" ? "Ordenar por preço" : "Ordenar por prioridade"}
                    createLabel="Novo desejo"
                    onToggle={() => setSort((current) => (current === "price" ? "priority" : "price"))}
                    onCreate={() => openModal(<AddWishItem />)}
                />
            )}

            {activeWishlist.items.length > 3 && (
                <label className="relative block">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <span className="sr-only">Buscar desejos</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar por nome ou categoria"
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 pl-9 pr-3 text-base text-white outline-none placeholder:text-neutral-600 focus:border-white/25"
                    />
                </label>
            )}

            {items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Gift size={28} className="text-neutral-600" />
                    <p className="text-sm text-neutral-500">
                        {query ? "Nada encontrado para essa busca." : isOwn ? "Sua lista está vazia. Toque em Novo desejo para adicionar algo." : `${activeWishlist.owner.name} ainda não adicionou desejos.`}
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-white/[0.06]">
                    {items.map((item) => {
                        const priority = getWishItemPriorityMeta(item.priority);
                        const projection = isOwn ? projectionMonthByWishItemId.get(item.id) : null;
                        return (
                            <li key={item.id} className="flex items-center gap-3 py-3">
                                <button type="button" onClick={() => handleTap(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
                                    <WishThumb item={item} />
                                    <span className="min-w-0 flex-1">
                                        <span className="line-clamp-2 text-sm font-medium text-white">{item.description}</span>
                                        <span className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                                            <span className="truncate">{item.categoryLabel}</span>
                                            <span className="shrink-0 font-medium" style={{ color: priority.color }}>
                                                {priority.label}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                        <Money value={item.value} className="text-sm text-neutral-100" />
                                        {!isOwn && item.link && <ExternalLink size={13} className="text-neutral-500" />}
                                    </span>
                                </button>
                                {projection && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/planning?month=${encodeURIComponent(projection.monthKey)}&panel=projections`)}
                                        className="shrink-0 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium uppercase text-fuchsia-100 outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/60"
                                        aria-label={`Ver no planejamento de ${projection.label}`}
                                    >
                                        {projection.label}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <MobileActionSheet
                title={selected?.description ?? ""}
                actions={selected ? buildWishlistContextActions(selected) : []}
                onClose={() => setSelectedId(null)}
                onSelect={(action) => {
                    setSelectedId(null);
                    if (selected) handleAction(selected, action);
                }}
            />
        </div>
    );
}
