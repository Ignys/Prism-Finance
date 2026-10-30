import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORY_ICON_NAMES, getCategoryIconComponent, hasCategoryIconName, normalizeCategoryIconName } from "../../lib/categoryIcons";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "../transactions/transactionForm.constants";

const ICONS_PER_BATCH = 96;
const DEFAULT_COLOR = "#64748B";

// Ícones comuns em finanças pessoais, com palavras em português para a busca.
const SUGGESTED_ICONS: Record<string, string> = {
    "shopping-cart": "mercado supermercado compras",
    "utensils": "restaurante comida alimentação almoço jantar",
    "coffee": "café padaria lanche",
    "pizza": "pizza delivery lanche",
    "car": "carro veículo transporte",
    "fuel": "combustível gasolina posto",
    "bus": "ônibus transporte público",
    "plane": "viagem avião passagem",
    "house": "casa moradia aluguel",
    "zap": "luz energia eletricidade conta",
    "droplet": "água conta saneamento",
    "wifi": "internet wifi conta",
    "smartphone": "celular telefone plano",
    "heart-pulse": "saúde médico plano de saúde",
    "pill": "farmácia remédio",
    "dumbbell": "academia esporte",
    "graduation-cap": "educação escola faculdade curso",
    "book-open": "livros leitura estudo",
    "baby": "filhos bebê criança",
    "paw-print": "pet animal veterinário",
    "shirt": "roupas vestuário",
    "scissors": "beleza salão cabelo",
    "gift": "presente doação",
    "gamepad-2": "jogos games lazer",
    "clapperboard": "cinema streaming filme",
    "music": "música show streaming",
    "tv": "tv assinatura streaming",
    "wrench": "manutenção reparo conserto",
    "receipt": "contas boleto imposto",
    "landmark": "banco taxa imposto governo",
    "credit-card": "cartão crédito fatura",
    "wallet": "carteira dinheiro",
    "piggy-bank": "poupança economia reserva",
    "trending-up": "investimento rendimento ações",
    "briefcase": "salário trabalho emprego",
    "hand-coins": "renda extra freelance pagamento",
    "banknote": "dinheiro dinheiro vivo",
    "percent": "juros desconto cashback",
    "shield": "seguro proteção",
    "heart": "doação caridade",
};

const SUGGESTED_ICON_NAMES = Object.keys(SUGGESTED_ICONS).filter(hasCategoryIconName);

function normalizeSearch(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

interface CategoryIconPickerProps {
    value: string;
    categoryType: "expense" | "income";
    onChange: (iconName: string) => void;
    /** Cor da categoria, usada para pintar o ícone escolhido. */
    color?: string;
}

export function CategoryIconPicker({ value, categoryType, onChange, color = DEFAULT_COLOR }: CategoryIconPickerProps) {
    const [query, setQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(ICONS_PER_BATCH);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const normalizedQuery = normalizeSearch(query);
    const searchResults = useMemo(() => {
        if (!normalizedQuery) {
            return null;
        }
        const suggested = SUGGESTED_ICON_NAMES.filter((name) => normalizeSearch(`${name} ${SUGGESTED_ICONS[name]}`).includes(normalizedQuery));
        const rest = CATEGORY_ICON_NAMES.filter((name) => name.includes(normalizedQuery) && !suggested.includes(name));
        return [...suggested, ...rest];
    }, [normalizedQuery]);

    useEffect(() => {
        setVisibleCount(ICONS_PER_BATCH);
        scrollRef.current?.scrollTo({ top: 0 });
    }, [normalizedQuery]);

    const activeIcon = normalizeCategoryIconName(value, categoryType);
    const allIcons = searchResults ?? CATEGORY_ICON_NAMES;
    const visibleIcons = allIcons.slice(0, visibleCount);

    const handleScroll = () => {
        const element = scrollRef.current;
        if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - 80 && visibleCount < allIcons.length) {
            setVisibleCount((current) => current + ICONS_PER_BATCH);
        }
    };

    const renderIcon = (iconName: string) => {
        const Icon = getCategoryIconComponent(iconName, categoryType);
        const isSelected = iconName === activeIcon;

        return (
            <button
                type="button"
                key={iconName}
                onClick={() => onChange(iconName)}
                title={iconName}
                aria-label={iconName}
                aria-pressed={isSelected}
                className={`flex aspect-square w-full items-center justify-center rounded-lg border transition-colors ${
                    isSelected ? "" : "border-transparent text-white/60 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
                }`}
                style={isSelected ? { color, borderColor: `${color}88`, backgroundColor: `${color}26` } : undefined}
            >
                <Icon size={17} />
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.1] bg-black/35 p-2">
            <label className={`${FIELD_ICON_CONTROL_CLASS} flex items-center gap-2 bg-black/30 py-2`}>
                <Search size={14} className="shrink-0 text-white/40" />
                <input
                    aria-label="Buscar ícone"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar ícone (ex.: mercado, carro, salário)"
                    className={FIELD_EMBEDDED_INPUT_CLASS}
                />
                {query ? (
                    <button type="button" onClick={() => setQuery("")} className="shrink-0 text-white/45 transition-colors hover:text-white" aria-label="Limpar busca">
                        <X size={14} />
                    </button>
                ) : null}
            </label>

            <div ref={scrollRef} onScroll={handleScroll} className="elegant-scrollbar h-[208px] overflow-y-auto pr-1">
                {searchResults === null ? (
                    <>
                        <p className="px-1 pb-1.5 text-xs text-white/45">Sugestões</p>
                        <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">{SUGGESTED_ICON_NAMES.map(renderIcon)}</div>
                        <p className="px-1 pb-1.5 pt-3 text-xs text-white/45">Todos os ícones</p>
                    </>
                ) : null}
                <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">{visibleIcons.map(renderIcon)}</div>
                {searchResults?.length === 0 ? <p className="py-10 text-center text-sm text-white/45">Nenhum ícone para “{query.trim()}”. Tente em inglês.</p> : null}
            </div>
        </div>
    );
}
