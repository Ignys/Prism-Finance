import { ChevronDown, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { AddCategory } from "../../components/modal/AddCategory";
import { type Category, useFinanceCategories } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { getCategoryIconComponent } from "../../lib/categoryIcons";
import { MobileListToolbar } from "../MobileListToolbar";

const TYPES = [
    { key: "expense" as const, label: "Despesas", active: "border-red-300/45 bg-red-500/18 text-red-100" },
    { key: "income" as const, label: "Receitas", active: "border-emerald-300/45 bg-emerald-500/18 text-emerald-100" },
];

function InactiveBadge() {
    return <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativa</span>;
}

export function MobileCategoriesSection() {
    const categories = useFinanceCategories();
    const { openModal } = useModal();
    const [type, setType] = useState<Category["type"]>("expense");
    const [showInactive, setShowInactive] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { roots, childrenByParent } = useMemo(() => {
        const visible = categories.filter((item) => showInactive || item.isActive);
        const children = new Map<string, Category[]>();
        for (const item of visible) {
            if (!item.parentId) continue;
            children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
        }
        return { roots: visible.filter((item) => item.parentId === null && item.type === type), childrenByParent: children };
    }, [categories, showInactive, type]);

    const activeCount = categories.filter((item) => item.isActive).length;
    const edit = (id: string) => openModal(<AddCategory mode="edit" categoryId={id} />);

    return (
        <div className="space-y-5">
            <MobileListToolbar
                countLabel={activeCount === 1 ? "1 categoria ativa" : `${activeCount} categorias ativas`}
                toggleLabel={showInactive ? "Ocultar inativas" : "Mostrar inativas"}
                createLabel="Nova categoria"
                onToggle={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddCategory mode="create" />)}
            />

            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1" role="tablist">
                {TYPES.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={type === item.key}
                        onClick={() => setType(item.key)}
                        className={`rounded-xl border py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${type === item.key ? item.active : "border-transparent text-neutral-400"}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {roots.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">Nenhuma categoria deste tipo. Toque em Nova categoria para criar uma.</p>
            ) : (
                <ul className="divide-y divide-white/[0.06]">
                    {roots.map((category) => {
                        const Icon = getCategoryIconComponent(category.icon, category.type);
                        const color = category.color ?? "#6B7280";
                        const children = childrenByParent.get(category.id) ?? [];
                        const expanded = expandedId === category.id;

                        return (
                            <li key={category.id} className={category.isActive ? "" : "opacity-60"}>
                                <button
                                    type="button"
                                    aria-expanded={children.length > 0 ? expanded : undefined}
                                    onClick={() => (children.length > 0 ? setExpandedId(expanded ? null : category.id) : edit(category.id))}
                                    className="flex w-full items-center gap-3 px-1 py-3 text-left outline-none active:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-sky-400/60"
                                >
                                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: `${color}22` }}>
                                        <Icon size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-white">{category.name}</span>
                                        {children.length > 0 && <span className="block text-xs text-neutral-500">{children.length === 1 ? "1 subcategoria" : `${children.length} subcategorias`}</span>}
                                    </span>
                                    {!category.isActive && <InactiveBadge />}
                                    {children.length > 0 ? (
                                        <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
                                    ) : (
                                        <Pencil size={14} className="shrink-0 text-neutral-600" />
                                    )}
                                </button>

                                {expanded && (
                                    <div className="mb-2 ml-[1.6rem] border-l border-white/[0.08] pl-4">
                                        <button type="button" onClick={() => edit(category.id)} className="flex w-full items-center gap-2 py-2.5 text-left text-sm text-sky-200 outline-none active:text-white">
                                            <Pencil size={13} /> Editar {category.name}
                                        </button>
                                        {children.map((child) => {
                                            const ChildIcon = getCategoryIconComponent(child.icon, child.type);
                                            return (
                                                <button
                                                    key={child.id}
                                                    type="button"
                                                    onClick={() => edit(child.id)}
                                                    className={`flex w-full items-center gap-2.5 py-2.5 text-left text-sm text-neutral-200 outline-none active:text-white ${child.isActive ? "" : "opacity-60"}`}
                                                >
                                                    <ChildIcon size={15} className="shrink-0" style={{ color: child.color ?? color }} />
                                                    <span className="min-w-0 flex-1 truncate">{child.name}</span>
                                                    {!child.isActive && <InactiveBadge />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
