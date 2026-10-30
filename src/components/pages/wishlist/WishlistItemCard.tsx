import { ExternalLink, Flag } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import type { SharedWishlistSnapshot } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { getWishItemPriorityMeta } from "../../../lib/wishlistPriority";

type WishlistCardItem = SharedWishlistSnapshot["items"][number];

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

interface WishlistItemCardProps {
    item: WishlistCardItem;
    isEditable: boolean;
    projectionMonth: { monthKey: string; label: string } | null | undefined;
    onEdit: () => void;
    onContextMenu: (event: MouseEvent) => void;
    onOpenProjectionMonth: (event: MouseEvent<HTMLButtonElement>, monthKey: string) => void;
}

export function WishlistItemCard({ item, isEditable, projectionMonth, onEdit, onContextMenu, onOpenProjectionMonth }: WishlistItemCardProps) {
    const [hasImageError, setHasImageError] = useState(false);
    const resolvedLink = resolveWishLink(item.link);
    const CategoryIcon = getCategoryIconComponent(item.categoryIcon, "expense");
    const priorityMeta = getWishItemPriorityMeta(item.priority);
    const accentColor = item.categoryColor ?? "#94A3B8";
    const showImage = Boolean(item.imageUrl) && !hasImageError;

    useEffect(() => {
        setHasImageError(false);
    }, [item.imageUrl]);

    return (
        <article
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : -1}
            onClick={isEditable ? onEdit : undefined}
            onContextMenu={onContextMenu}
            onKeyDown={
                isEditable
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onEdit();
                          }
                      }
                    : undefined
            }
            className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left ${
                isEditable ? "cursor-pointer transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]" : ""
            }`}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/20">
                {showImage ? (
                    <img src={item.imageUrl ?? undefined} alt={item.description} loading="lazy" onError={() => setHasImageError(true)} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: `radial-gradient(circle at 50% 40%, ${accentColor}26, transparent 70%)`, color: accentColor }}>
                        <CategoryIcon size={40} strokeWidth={1.5} />
                    </div>
                )}

                {projectionMonth ? (
                    <button
                        type="button"
                        onClick={(event) => onOpenProjectionMonth(event, projectionMonth.monthKey)}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="absolute left-3 top-3 inline-flex items-center rounded-full border border-fuchsia-300/30 bg-black/55 px-2.5 py-0.5 text-[11px] font-medium uppercase text-fuchsia-100 backdrop-blur-sm transition-colors hover:border-fuchsia-300/50"
                        title={`Abrir projeções de ${projectionMonth.label}`}
                    >
                        {projectionMonth.label}
                    </button>
                ) : null}

                {resolvedLink ? (
                    <a
                        href={resolvedLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Abrir link"
                        title="Abrir link"
                        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                    >
                        <ExternalLink size={14} />
                    </a>
                ) : null}
            </div>

            <div className="flex grow flex-col gap-3 p-4">
                <h2 className="line-clamp-2 min-w-0 break-words text-base font-normal text-white">{item.description}</h2>
                <p className="text-2xl font-light tabular-nums text-white">{currencyFormatter.format(item.value)}</p>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <span
                        className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                        style={{ color: accentColor, borderColor: `${accentColor}35`, backgroundColor: `${accentColor}14` }}
                    >
                        <CategoryIcon size={12} className="shrink-0" />
                        <span className="truncate">{item.categoryLabel}</span>
                    </span>

                    <span
                        className="inline-flex items-center gap-0.5 rounded-full border px-2 py-1"
                        style={{ color: priorityMeta.color, borderColor: `${priorityMeta.color}40`, backgroundColor: `${priorityMeta.color}14` }}
                        title={`Prioridade ${item.priority}`}
                    >
                        {Array.from({ length: item.priority }, (_, flagIndex) => (
                            <Flag key={flagIndex} size={12} />
                        ))}
                    </span>
                </div>
            </div>
        </article>
    );
}
