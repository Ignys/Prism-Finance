import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { normalizeComparisonText } from "../../../context/finance/helpers";
import { usePage } from "../../../context/PageContext";
import { rankCommandItems } from "./rankCommandItems";
import { useCommandItems, type CommandItem } from "./useCommandItems";

const MAX_RESULTS = 40;
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const AMOUNT_TONE = { income: "text-emerald-300", spending: "text-white/80", neutral: "text-white/50" } as const;

// Cada tipo de resultado é uma faixa do espectro: a cor diz o que o item é.
const GROUP_HUE: Record<string, string> = {
    Páginas: "#e4e4e7",
    Transações: "#7dd3fc",
    Faturas: "#a78bfa",
    Cartões: "#e879f9",
    Carteiras: "#6ee7b7",
    Orçamentos: "#fcd34d",
    Projeções: "#67e8f9",
    "Lista de desejos": "#fda4af",
    Categorias: "#bef264",
    Beneficiários: "#fdba74",
    Tags: "#a5b4fc",
};
const SPECTRUM = "linear-gradient(90deg, #a78bfa, #7dd3fc, #6ee7b7, #fcd34d, #fdba74, #fda4af)";

export function CommandPalette() {
    const { goToPage } = usePage();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement | null>(null);
    const items = useCommandItems(isOpen);

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setIsOpen((current) => !current);
                setQuery("");
                setActiveIndex(0);
            }
        }

        document.addEventListener("keydown", handleShortcut);
        return () => document.removeEventListener("keydown", handleShortcut);
    }, []);

    // Sem busca: só as páginas. Com busca, grupos aparecem na ordem do seu melhor resultado.
    const results = useMemo(() => {
        if (!query.trim()) {
            return items.filter((item) => item.group === "Páginas");
        }
        const ranked = rankCommandItems(items, query, MAX_RESULTS);
        const groupOrder = [...new Set(ranked.map((item) => item.group))];
        return ranked.sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group));
    }, [items, query]);

    const groupCounts = useMemo(() => {
        const counts = new Map<string, number>();
        results.forEach((item) => counts.set(item.group, (counts.get(item.group) ?? 0) + 1));
        return counts;
    }, [results]);

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    if (!isOpen) {
        return null;
    }

    function open(item: CommandItem | undefined) {
        if (!item) {
            return;
        }
        if (item.target.path) {
            navigate(item.target.path);
        } else {
            goToPage(item.target.page, item.target.intent);
        }
        setIsOpen(false);
    }

    function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter") {
            open(results[activeIndex]);
        } else if (event.key === "Escape") {
            setIsOpen(false);
        }
    }

    const activeHue = GROUP_HUE[results[activeIndex]?.group ?? ""] ?? GROUP_HUE.Páginas;

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[9vh] backdrop-blur-[2px]" onMouseDown={() => setIsOpen(false)}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Busca global"
                onMouseDown={(event) => event.stopPropagation()}
                className="command-palette-in relative flex max-h-[min(580px,78vh)] w-full max-w-[660px] flex-col overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#141417] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]"
            >
                <div aria-hidden className="absolute inset-x-0 top-0 h-px opacity-70" style={{ background: SPECTRUM }} />

                <label className="flex h-16 shrink-0 items-center gap-3 px-5">
                    <Search size={18} className="shrink-0 transition-colors" style={{ color: query.trim() ? activeHue : "rgba(255,255,255,0.4)" }} />
                    <input
                        autoFocus
                        type="search"
                        role="combobox"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="O que você procura?"
                        aria-expanded="true"
                        aria-controls="command-palette-results"
                        aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
                        className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-white/30 [&::-webkit-search-cancel-button]:hidden"
                    />
                </label>

                <div ref={listRef} id="command-palette-results" role="listbox" className="elegant-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06] px-2 pb-2">
                    {results.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <p className="text-sm text-white/70">Nada encontrado para “{query.trim()}”.</p>
                            <p className="mt-1 text-xs text-white/35">Tente o nome de uma carteira, cartão, categoria ou parte da descrição.</p>
                        </div>
                    ) : (
                        results.map((item, index) => {
                            const hue = GROUP_HUE[item.group] ?? GROUP_HUE.Páginas;
                            const isActive = index === activeIndex;
                            const startsGroup = index === 0 || item.group !== results[index - 1].group;
                            return (
                                <div key={item.id}>
                                    {startsGroup ? (
                                        <p className="flex items-center gap-2 px-3 pb-1.5 pt-3.5 text-xs text-white/45">
                                            <span className="size-1.5 rounded-full" style={{ background: hue }} />
                                            {item.group}
                                            <span className="text-white/25">{groupCounts.get(item.group)}</span>
                                        </p>
                                    ) : null}
                                    <button
                                        id={`command-${item.id}`}
                                        type="button"
                                        role="option"
                                        data-index={index}
                                        aria-selected={isActive}
                                        onMouseMove={() => setActiveIndex(index)}
                                        onClick={() => open(item)}
                                        style={{ "--hue": hue } as CSSProperties}
                                        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${isActive ? "bg-white/[0.06]" : ""}`}
                                    >
                                        {isActive ? <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[var(--hue)]" /> : null}
                                        {item.media ? (
                                            <span className="flex size-8 shrink-0">{item.media}</span>
                                        ) : (
                                            <span
                                                className="flex size-8 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4"
                                                style={{
                                                    color: item.color ?? hue,
                                                    background: `color-mix(in srgb, ${item.color ?? hue} ${isActive ? 18 : 11}%, transparent)`,
                                                    boxShadow: item.color ? `inset 0 0 0 1px color-mix(in srgb, ${item.color} 22%, transparent)` : undefined,
                                                }}
                                            >
                                                {item.icon}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-white/90">
                                                <HighlightedLabel label={item.label} query={query} />
                                            </span>
                                            <span className="block truncate text-xs text-white/40">{item.hint}</span>
                                        </span>
                                        {item.amount ? (
                                            <span className={`shrink-0 text-[13px] ${AMOUNT_TONE[item.amount.tone]}`} style={{ fontFamily: "'Azeret Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
                                                {item.amount.tone === "income" ? "+" : item.amount.tone === "spending" ? "−" : ""}
                                                {currencyFormatter.format(item.amount.value)}
                                            </span>
                                        ) : null}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="hidden shrink-0 items-center gap-4 border-t border-white/[0.06] px-5 py-2.5 text-xs text-white/35 sm:flex">
                    <KeyHint keys={["↑", "↓"]} label="navegar" />
                    <KeyHint keys={["Enter"]} label="abrir" />
                    <KeyHint keys={["Esc"]} label="fechar" />
                    <span className="ml-auto">{query.trim() ? `${results.length} resultado${results.length === 1 ? "" : "s"}` : "Ctrl K abre de qualquer tela"}</span>
                </div>
            </div>
        </div>
    );
}

/** Destaca o trecho buscado; sem destaque quando acentos mudam o tamanho do texto normalizado. */
function HighlightedLabel({ label, query }: { label: string; query: string }) {
    const needle = normalizeComparisonText(query.trim());
    const haystack = normalizeComparisonText(label);
    const start = needle ? haystack.indexOf(needle) : -1;
    if (start < 0 || haystack.length !== label.length) {
        return <>{label}</>;
    }
    return (
        <>
            {label.slice(0, start)}
            <span className="text-white underline decoration-[var(--hue)] decoration-2 underline-offset-[3px]">{label.slice(start, start + needle.length)}</span>
            {label.slice(start + needle.length)}
        </>
    );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
    return (
        <span className="flex items-center gap-1.5">
            {keys.map((key) => (
                <kbd key={key} className="min-w-5 rounded-md border border-white/[0.1] bg-white/[0.03] px-1.5 py-0.5 text-center font-sans text-[11px] text-white/50">
                    {key}
                </kbd>
            ))}
            {label}
        </span>
    );
}
