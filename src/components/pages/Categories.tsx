import { useMemo } from "react";
import { useFinanceCategories } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AuthShell } from "../layout/AuthShell";
import { AddCategory } from "../modal/AddCategory";

export function CategoriesPage() {
    const categories = useFinanceCategories();
    const { openModal } = useModal();

    const grouped = useMemo(() => {
        const roots = categories.filter((item) => item.parentId === null);
        const childrenByParent = new Map<string, typeof categories>();

        categories
            .filter((item) => item.parentId !== null)
            .forEach((item) => {
                const parentId = item.parentId as string;
                const list = childrenByParent.get(parentId);
                if (list) {
                    list.push(item);
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

    const renderCategoryBlock = (title: string, items: typeof categories) => (
        <div className="bg-neutral-900 rounded-lg p-4">
            <p className="text-left text-sm uppercase tracking-wide text-white/50 mb-3">{title}</p>
            <div className="space-y-2">
                {items.map((category) => (
                    <div key={category.id} className="bg-[#1e1e1e] rounded-lg p-3 text-left">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">{category.name}</span>
                            <span className={`text-xs ${category.isSystem ? "text-blue-300" : "text-white/50"}`}>{category.isSystem ? "Sistema" : "Usuario"}</span>
                        </div>
                        {(grouped.childrenByParent.get(category.id) ?? []).length > 0 && (
                            <div className="mt-2 pl-4 border-l border-white/10 space-y-1">
                                {(grouped.childrenByParent.get(category.id) ?? []).map((child) => (
                                    <div key={child.id} className="text-sm text-white/80">
                                        {child.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <AuthShell>
            <div className="flex justify-center mt-5">
                <section className="w-8/12 space-y-2">
                    <div className="bg-neutral-900 rounded-lg p-4 flex items-center justify-between">
                        <p className="text-white/60">Categorias cadastradas: {categories.length}</p>
                        <button onClick={() => openModal(<AddCategory />)} className="default-button py-2 px-4">
                            Criar categoria
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {renderCategoryBlock("Despesas", grouped.expense)}
                        {renderCategoryBlock("Receitas", grouped.income)}
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
