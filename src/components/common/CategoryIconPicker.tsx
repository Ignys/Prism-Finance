import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORY_ICON_NAMES, getCategoryIconComponent, normalizeCategoryIconName } from "../../lib/categoryIcons";

const ICONS_PER_BATCH = 72;

interface CategoryIconPickerProps {
    value: string;
    categoryType: "expense" | "income";
    onChange: (iconName: string) => void;
}

export function CategoryIconPicker({ value, categoryType, onChange }: CategoryIconPickerProps) {
    const [query, setQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(ICONS_PER_BATCH);

    const normalizedQuery = query.trim().toLowerCase();
    const filteredIconNames = useMemo(() => {
        if (!normalizedQuery) {
            return CATEGORY_ICON_NAMES;
        }
        return CATEGORY_ICON_NAMES.filter((iconName) => iconName.includes(normalizedQuery));
    }, [normalizedQuery]);

    useEffect(() => {
        setVisibleCount(ICONS_PER_BATCH);
    }, [normalizedQuery]);

    const activeIcon = normalizeCategoryIconName(value, categoryType);
    const ActiveIcon = getCategoryIconComponent(activeIcon, categoryType);
    const visibleIcons = filteredIconNames.slice(0, visibleCount);
    const hasMoreIcons = visibleCount < filteredIconNames.length;

    return (
        <div className="rounded-lg border border-white/10 bg-black/35 p-3 ">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-left text-xs uppercase tracking-[0.12em] text-white/50">Icone da categoria</p>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1">
                    <ActiveIcon size={16} />
                    <span className="text-xs text-white/70">{activeIcon}</span>
                </div>
            </div>

            <label className="relative mb-3 block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar"
                    className="w-full rounded-lg border border-neutral-600 bg-neutral-700 py-2 pl-8 pr-3 text-sm text-white outline-none transition-colors focus:border-white/35"
                />
            </label>

            <div className="max-h-[110px] overflow-auto rounded-md border border-white/5 bg-black/20 p-2">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                    {visibleIcons.map((iconName) => {
                        const Icon = getCategoryIconComponent(iconName, categoryType);
                        const isSelected = iconName === activeIcon;

                        return (
                            <button
                                type="button"
                                key={iconName}
                                onClick={() => onChange(iconName)}
                                title={iconName}
                                className={`flex h-10 w-full items-center justify-center rounded-md border transition-colors ${
                                    isSelected ? "border-sky-300 bg-sky-500/20 text-sky-100" : "border-white/10 bg-neutral-800/70 text-white/70 hover:border-white/25 hover:text-white"
                                }`}
                            >
                                <Icon size={17} />
                            </button>
                        );
                    })}
                </div>
                {visibleIcons.length === 0 && <p className="py-8 text-center text-sm text-white/45">Nenhum icone encontrado.</p>}
            </div>

            {hasMoreIcons && (
                <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + ICONS_PER_BATCH)}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/70 transition-colors hover:bg-white/[0.08]"
                >
                    Mostrar mais
                </button>
            )}
        </div>
    );
}
