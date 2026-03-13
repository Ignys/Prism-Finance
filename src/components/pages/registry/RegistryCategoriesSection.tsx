import { useMemo } from "react";
import { FolderKanban } from "lucide-react";
import { type Category, useFinanceCategories } from "../../../context/FinanceContext";
import { useModal } from "../../../context/ModalContext";
import { getCategoryIconComponent, normalizeCategoryIconName } from "../../../lib/categoryIcons";
import { AddCategory } from "../../modal/AddCategory";

export function RegistryCategoriesSection() {
    const categories = useFinanceCategories();
    const { openModal } = useModal();

    const groupedCategories = useMemo(() => {
        const roots = categories.filter((item) => item.parentId === null);
        const childrenByParent = new Map<string, Category[]>();

        categories
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
            childrenByParent,
        };
    }, [categories]);

    const handleEdit = (id: string) => openModal(<AddCategory mode="edit" categoryId={id} />);

    return (
        <section className=" rounded-xl border border-white/[0.08] bg-[#111111] p-4 row-span-2">
            

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FolderKanban size={18} className="text-white/80" />
                    <p className="text-sm uppercase tracking-[0.12em] text-white/60">Categorias ({categories.length})</p>
                </div>
                <button onClick={() => openModal(<AddCategory mode="create" />)} className="cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-sm uppercase tracking-wide text-neutral-300 transition-colors hover:bg-white/[0.06]">
                    Criar categoria
                </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                <CategoryColumn title="Despesas" items={groupedCategories.expense} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} />
                <CategoryColumn title="Receitas" items={groupedCategories.income} childrenByParent={groupedCategories.childrenByParent} onEdit={handleEdit} />
            </div>
        </section>
    );
}

function CategoryColumn({ title, items, childrenByParent, onEdit }: { title: string; items: Category[]; childrenByParent: Map<string, Category[]>; onEdit: (categoryId: string) => void }) {
    return (
        <div className="rounded-lg border border-white/6 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">{title}</p>
            <div className="space-y-2">
                {items.map((category) => (
                    <CategoryItem key={category.id} category={category} children={childrenByParent.get(category.id) ?? []} onEdit={onEdit} />
                ))}
                {items.length === 0 && <p className="text-sm text-white/45">Nenhuma categoria deste tipo.</p>}
            </div>
        </div>
    );
}

function CategoryItem({ category, children, onEdit }: { category: Category; children: Category[]; onEdit: (categoryId: string) => void }) {
    const Icon = getCategoryIconComponent(category.icon, category.type);

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
            <button type="button" onClick={() => onEdit(category.id)} className="flex w-full items-center justify-between text-left">
                <div className="flex items-center gap-2">
                    <div
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10"
                        style={{ color: category.color ?? "#D1D5DB", backgroundColor: `${category.color ?? "#6B7280"}22` }}
                    >
                        <Icon size={16} />
                    </div>
                    <div>
                        <p className="font-medium text-white">{category.name}</p>
                    </div>
                </div>
                {category.isSystem && <span className="text-[11px] font-medium tracking-wider text-neutral-500">PADRÃO</span>}
            </button>

            {children.length > 0 && (
                <div className="mt-2 space-y-1 border-l border-white/10 pl-3">
                    {children.map((child) => {
                        const ChildIcon = getCategoryIconComponent(child.icon, child.type);
                        return (
                            <button
                                type="button"
                                key={child.id}
                                onClick={() => onEdit(child.id)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.05]"
                            >
                                <ChildIcon size={14} className="text-white/70" />
                                <span>{child.name}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
