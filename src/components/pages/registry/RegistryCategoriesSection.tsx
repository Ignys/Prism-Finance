import { Reorder } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Category, useFinanceActions, useFinanceCategories } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { AddCategory } from "../../modal/AddCategory";
import { RegistryListItemEntrance } from "./RegistryListItemEntrance";
import { RegistrySectionHeader } from "./RegistrySectionHeader";

interface CategoryColumnProps {
    title: string;
    accentClassName: string;
    index: number;
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
        <section className="row-span-2 flex h-full min-h-0 flex-col">
            <RegistrySectionHeader
                title="Suas categorias"
                visibleCount={visibleCount}
                isShowingInactive={showInactive}
                showLabel="Mostrar inativos"
                hideLabel="Ocultar inativos"
                createLabel="Nova categoria"
                onToggleInactive={() => setShowInactive((current) => !current)}
                onCreate={() => openModal(<AddCategory mode="create" />)}
            />

            <div className="grid min-h-0 flex-1 gap-x-8 gap-y-6 lg:grid-cols-2">
                <CategoryColumn index={0} title="Despesas" accentClassName="bg-rose-300" items={groupedCategories.expense} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} onReorder={handleReorder} />
                <CategoryColumn index={1} title="Receitas" accentClassName="bg-emerald-300" items={groupedCategories.income} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} onReorder={handleReorder} />
            </div>
        </section>
    );
}

function CategoryColumn({ title, accentClassName, index, items, childrenByParent, onEdit, onReorder }: CategoryColumnProps) {
    const [orderedRoots, setOrderedRoots] = useState(items);

    useEffect(() => {
        setOrderedRoots(items);
    }, [items]);

    const commitOrder = () => {
        onReorder(orderedRoots.map((item) => item.id));
    };

    return (
        <RegistryListItemEntrance index={index} className="h-full min-h-0">
            <div className="elegant-scrollbar h-full min-h-0 overflow-y-auto overflow-x-hidden pr-2">
                <div className="mb-1 flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accentClassName}`} />
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    <span className="text-sm tabular-nums text-white/40">{orderedRoots.length}</span>
                </div>

                {orderedRoots.length < 1 ? (
                    <p className="py-4 text-sm text-white/45">Nenhuma categoria deste tipo.</p>
                ) : (
                    <Reorder.Group axis="y" values={orderedRoots} onReorder={setOrderedRoots} className="divide-y divide-white/[0.06]">
                        {orderedRoots.map((category, itemIndex) => (
                            <Reorder.Item key={category.id} value={category} onDragEnd={commitOrder} className="list-none">
                                <RegistryListItemEntrance index={itemIndex}>
                                    <CategoryItem category={category} children={childrenByParent.get(category.id) ?? []} onEdit={onEdit} onReorder={onReorder} />
                                </RegistryListItemEntrance>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </RegistryListItemEntrance>
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

    const color = category.color ?? "#6B7280";

    return (
        <div className={`py-2 ${category.isActive ? "" : "opacity-60"}`}>
            <div className="group flex items-center gap-1">
                <span className="inline-flex cursor-grab text-white/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing" aria-hidden="true">
                <GripVertical size={15} />
            </span>
                <button
                    type="button"
                    onClick={() => onEdit(category.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-white/35"
                >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: `${color}22` }}>
                        <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-white">{category.name}</span>
                    {!category.isActive && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativo</span>}
                    {orderedChildren.length > 0 ? <span className="shrink-0 text-xs tabular-nums text-white/35">{orderedChildren.length === 1 ? "1 subcategoria" : `${orderedChildren.length} subcategorias`}</span> : null}
                </button>
            </div>

            {orderedChildren.length > 0 && (
                <div className="relative ml-[2.4rem] mt-1 pl-4">
                    <span aria-hidden="true" className="absolute bottom-4 left-0 top-0 w-px opacity-50 bg-neutral-600" />
                    <Reorder.Group axis="y" values={orderedChildren} onReorder={setOrderedChildren}>
                        {orderedChildren.map((child) => {
                            const ChildIcon = getCategoryIconComponent(child.icon, child.type);
                            return (
                                <Reorder.Item key={child.id} value={child} onDragEnd={commitChildrenOrder} className="relative list-none">
                                    <span aria-hidden="true" className="absolute -left-4 top-1/2 h-px w-3 opacity-50 bg-neutral-600"  />
                                    <button
                                        type="button"
                                        onClick={() => onEdit(child.id)}
                                        className={`flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-white/75 outline-none transition-colors hover:bg-white/[0.03] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35 ${child.isActive ? "" : "opacity-60"}`}
                                    >
                                        <ChildIcon size={14} className="shrink-0" style={{ color: child.color ?? color }} />
                                        <span className="min-w-0 flex-1 truncate">{child.name}</span>
                                        {!child.isActive && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Inativo</span>}
                                    </button>
                                </Reorder.Item>
                            );
                        })}
                    </Reorder.Group>
                </div>
            )}
        </div>
    );
}
