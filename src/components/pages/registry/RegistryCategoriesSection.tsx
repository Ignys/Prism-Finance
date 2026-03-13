import { Reorder } from "framer-motion";
import { Eye, EyeOff, FolderKanban, GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Category, useFinanceActions, useFinanceCategories } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { AddCategory } from "../../modal/AddCategory";

interface CategoryColumnProps {
    title: string;
    items: Category[];
    childrenByParent: Map<string, Category[]>;
    onEdit: (categoryId: string) => void;
    onReorder: (categoryIds: string[]) => void;
}

interface CategoryItemProps {
    category: Category;
    children: Category[];
    onEdit: (categoryId: string) => void;
    onReorder: (categoryIds: string[]) => void;
}

export function RegistryCategoriesSection() {
    const categories = useFinanceCategories();
    const { reorderCategories } = useFinanceActions();
    const { openModal } = useModal();
    const [showInactive, setShowInactive] = useState(false);

    const groupedCategories = useMemo(() => {
        const visibleCategories = categories.filter((item) => showInactive || item.isActive);
        const roots = visibleCategories.filter((item) => item.parentId === null);
        const childrenByParent = new Map<string, Category[]>();

        visibleCategories
            .filter((item) => item.parentId !== null)
            .forEach((item) => {
                const parentId = item.parentId as string;
                const existing = childrenByParent.get(parentId);
                if (existing) {
                    existing.push(item);
                } else {
                    childrenByParent.set(parentId, [item]);
                }
            });

        return {
            expense: roots.filter((item) => item.type === "expense"),
            income: roots.filter((item) => item.type === "income"),
            activeCount: categories.filter((item) => item.isActive).length,
            totalCount: categories.length,
            childrenByParent,
        };
    }, [categories, showInactive]);

    const handleEdit = (id: string) => openModal(<AddCategory mode="edit" categoryId={id} />);
    const handleReorder = (categoryIds: string[]) => {
        void reorderCategories(categoryIds);
    };

    const visibleCount = showInactive ? groupedCategories.totalCount : groupedCategories.activeCount;

    return (
        <section className="row-span-2 rounded-xl border border-white/[0.08] bg-[#111111] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FolderKanban size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Categorias ({visibleCount})</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowInactive((current) => !current)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.08em] text-white/70 transition-colors hover:border-white/[0.24] hover:text-white"
                    >
                        {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
                    </button>
                    <button
                        type="button"
                        onClick={() => openModal(<AddCategory mode="create" />)}
                        className="cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-sm uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]"
                    >
                        Criar categoria
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                <CategoryColumn title="Despesas" items={groupedCategories.expense} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} onReorder={handleReorder} />
                <CategoryColumn title="Receitas" items={groupedCategories.income} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} onReorder={handleReorder} />
            </div>
        </section>
    );
}

function CategoryColumn({ title, items, childrenByParent, onEdit, onReorder }: CategoryColumnProps) {
    const [orderedRoots, setOrderedRoots] = useState(items);

    useEffect(() => {
        setOrderedRoots(items);
    }, [items]);

    const commitOrder = () => {
        onReorder(orderedRoots.map((item) => item.id));
    };

    return (
        <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">{title}</p>

            {orderedRoots.length < 1 ? (
                <p className="text-sm text-white/45">Nenhuma categoria deste tipo.</p>
            ) : (
                <Reorder.Group axis="y" values={orderedRoots} onReorder={setOrderedRoots} className="space-y-2">
                    {orderedRoots.map((category) => (
                        <Reorder.Item key={category.id} value={category} onDragEnd={commitOrder} className="list-none">
                            <CategoryItem category={category} children={childrenByParent.get(category.id) ?? []} onEdit={onEdit} onReorder={onReorder} />
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}
        </div>
    );
}

function CategoryItem({ category, children, onEdit, onReorder }: CategoryItemProps) {
    const Icon = getCategoryIconComponent(category.icon, category.type);
    const [orderedChildren, setOrderedChildren] = useState(children);

    useEffect(() => {
        setOrderedChildren(children);
    }, [children]);

    const commitChildrenOrder = () => {
        onReorder(orderedChildren.map((item) => item.id));
    };

    return (
        <div className={`rounded-lg border p-2.5 ${category.isActive ? "border-white/10 bg-black/20" : "border-white/10 bg-white/[0.02] opacity-70"}`}>
            <div className="flex items-center gap-2">
                <span className="inline-flex cursor-grab text-white/35 active:cursor-grabbing">
                    <GripVertical size={15} />
                </span>
                <button
                    type="button"
                    onClick={() => onEdit(category.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.05]"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <div
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10"
                            style={{ color: category.color ?? "#D1D5DB", backgroundColor: `${category.color ?? "#6B7280"}22` }}
                        >
                            <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-medium text-white">{category.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {!category.isActive && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">Inativo</span>}
                        {category.isSystem && <span className="text-[11px] font-medium tracking-wider text-neutral-500">PADRAO</span>}
                    </div>
                </button>
            </div>

            {orderedChildren.length > 0 && (
                <div className="mt-2 border-l border-white/10 pl-2">
                    <Reorder.Group axis="y" values={orderedChildren} onReorder={setOrderedChildren} className="space-y-1">
                        {orderedChildren.map((child) => {
                            const ChildIcon = getCategoryIconComponent(child.icon, child.type);
                            return (
                                <Reorder.Item key={child.id} value={child} onDragEnd={commitChildrenOrder} className="list-none">
                                    <div className="flex items-center gap-2 rounded-md px-1 py-1">
                                        <span className="inline-flex cursor-grab text-white/35 active:cursor-grabbing">
                                            <GripVertical size={14} />
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onEdit(child.id)}
                                            className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <ChildIcon size={14} className="text-white/70" />
                                                <span className="truncate">{child.name}</span>
                                            </span>
                                            {!child.isActive && (
                                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/55">
                                                    Inativo
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </Reorder.Item>
                            );
                        })}
                    </Reorder.Group>
                </div>
            )}
        </div>
    );
}
