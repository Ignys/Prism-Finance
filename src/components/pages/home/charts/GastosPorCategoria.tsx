import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinanceCategories, useFinanceTransactions } from "../../../../context/FinanceContext";
import { transactionSettlementDate } from "../../../../lib/transactionSettlementDate";
import { getCategoryIconComponent } from "../../../../lib/categoryIcons";

interface CategoryChartItem {
    key: string;
    label: string;
    value: number;
    color: string;
    icon: string;
    type: "income" | "expense";
}

interface CategoryGroup extends CategoryChartItem {
    children: CategoryChartItem[];
}

const FALLBACK_COLOR = "#6B7280";

function addTo(map: Map<string, CategoryChartItem>, item: CategoryChartItem) {
    const current = map.get(item.key);
    if (current) current.value += item.value;
    else map.set(item.key, { ...item });
}

// Subcategories that share the parent's color get stepped opacity so the split stays readable.
function childOpacity(child: CategoryChartItem, parent: CategoryChartItem, index: number) {
    return child.color.toLowerCase() === parent.color.toLowerCase() ? Math.max(1 - index * 0.18, 0.35) : 1;
}

export function GastosPorCategoria() {
    const transactions = useFinanceTransactions();
    const categories = useFinanceCategories();
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(currentDate);

    const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

    const groups = useMemo<CategoryGroup[]>(() => {
        const parents = new Map<string, CategoryChartItem>();
        const childrenByParent = new Map<string, Map<string, CategoryChartItem>>();

        transactions.forEach((transaction) => {
            if (transaction.type !== "spending" || transaction.paymentMethod === "credit_card" || transaction.status !== "paid") return;
            const transactionDate = transactionSettlementDate(transaction);
            if (!transactionDate || transactionDate.getMonth() !== currentMonth || transactionDate.getFullYear() !== currentYear) return;

            const resolved = transaction.category.id ? categoriesById.get(transaction.category.id) : null;
            const parentCategory = resolved?.parentId ? categoriesById.get(resolved.parentId) : null;
            const parent = parentCategory ?? resolved;
            const parentLabel = parent?.name ?? transaction.category.parentLabel ?? transaction.category.label;
            const parentKey = parent ? `id:${parent.id}` : `fallback:${parentLabel}`;
            const parentColor = parent?.color ?? transaction.category.color ?? FALLBACK_COLOR;
            const icon = parent?.icon ?? transaction.category.icon;
            const type = parent?.type ?? transaction.category.type;

            addTo(parents, { key: parentKey, label: parentLabel, value: transaction.value, color: parentColor, icon, type });

            const isSub = Boolean(parentCategory) || Boolean(!resolved && transaction.category.parentLabel);
            const child: CategoryChartItem = isSub
                ? {
                      key: resolved ? `id:${resolved.id}` : `fallback:${transaction.category.label}`,
                      label: resolved?.name ?? transaction.category.label,
                      value: transaction.value,
                      color: resolved?.color ?? transaction.category.color ?? parentColor,
                      icon: resolved?.icon ?? transaction.category.icon,
                      type,
                  }
                : { key: `${parentKey}:direct`, label: "Sem subcategoria", value: transaction.value, color: parentColor, icon, type };

            const children = childrenByParent.get(parentKey) ?? new Map<string, CategoryChartItem>();
            addTo(children, child);
            childrenByParent.set(parentKey, children);
        });

        return Array.from(parents.values())
            .map((parent) => ({
                ...parent,
                children: Array.from(childrenByParent.get(parent.key)?.values() ?? []).sort((a, b) => b.value - a.value),
            }))
            .sort((a, b) => b.value - a.value);
    }, [transactions, categoriesById, currentMonth, currentYear]);

    const totalGastos = groups.reduce((sum, group) => sum + group.value, 0);

    const formatCurrency = (value: number) =>
        value.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const share = (value: number) => (totalGastos > 0 ? (value / totalGastos) * 100 : 0);
    const hasSubcategories = (group: CategoryGroup) => group.children.length > 1 || group.children[0]?.label !== "Sem subcategoria";

    const toggle = (key: string) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    // A hovered parent lights all its segments; a hovered child lights only itself.
    const isDimmed = (groupKey: string, childKey?: string) => activeKey !== null && activeKey !== groupKey && activeKey !== childKey;

    return (
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#111111] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-medium text-white">Gastos por categoria</p>
                    <p className="text-sm capitalize text-neutral-500">{monthLabel}</p>
                </div>
                {groups.length > 0 && (
                    <div className="text-right">
                        <p className="text-2xl font-semibold leading-none tabular-nums text-white">R$ {formatCurrency(totalGastos)}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                            Em {groups.length} {groups.length === 1 ? "categoria" : "categorias"}
                        </p>
                    </div>
                )}
            </div>

            {groups.length === 0 ? (
                <p className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-6 text-center text-sm text-neutral-400">Nenhuma despesa paga neste mês</p>
            ) : (
                <>
                    <div className="mt-4 flex h-3 gap-[3px]" role="img" aria-label="Distribuição dos gastos por categoria">
                        {groups.flatMap((group) =>
                            expanded.has(group.key) && hasSubcategories(group)
                                ? group.children.map((child, index) => (
                                      <div
                                          key={`${group.key}/${child.key}`}
                                          className="min-w-[4px] rounded-[3px] transition-all duration-300 ease-out"
                                          style={{
                                              flexGrow: child.value,
                                              backgroundColor: child.color,
                                              opacity: isDimmed(group.key, child.key) ? 0.2 : childOpacity(child, group, index),
                                          }}
                                      />
                                  ))
                                : [
                                      <div
                                          key={group.key}
                                          className="min-w-[4px] rounded-full transition-all duration-300 ease-out"
                                          style={{ flexGrow: group.value, backgroundColor: group.color, opacity: isDimmed(group.key) ? 0.2 : 1 }}
                                      />,
                                  ],
                        )}
                    </div>

                    <ul className="mt-5 space-y-1" onMouseLeave={() => setActiveKey(null)}>
                        {groups.map((group) => {
                            const CategoryIcon = getCategoryIconComponent(group.icon, group.type);
                            const percent = share(group.value);
                            const expandable = hasSubcategories(group);
                            const isOpen = expandable && expanded.has(group.key);

                            return (
                                <li key={group.key} className={`rounded-xl transition-colors ${isOpen ? "bg-white/[0.03]" : ""}`}>
                                    <button
                                        type="button"
                                        aria-expanded={expandable ? isOpen : undefined}
                                        onClick={expandable ? () => toggle(group.key) : undefined}
                                        onMouseEnter={() => setActiveKey(group.key)}
                                        onFocus={() => setActiveKey(group.key)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${expandable ? "" : "cursor-default"} ${
                                            activeKey === group.key && !isOpen ? "bg-white/[0.04]" : ""
                                        }`}
                                    >
                                        <span
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                                            style={{ color: group.color, backgroundColor: `${group.color}1a`, border: `1px solid ${group.color}33` }}
                                        >
                                            <CategoryIcon size={17} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline justify-between gap-3">
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <span className="truncate text-sm text-neutral-100">{group.label}</span>
                                                    {expandable && (
                                                        <ChevronDown size={14} className={`shrink-0 text-neutral-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                                    )}
                                                </span>
                                                <span className="shrink-0 text-sm font-semibold tabular-nums text-white">R$ {formatCurrency(group.value)}</span>
                                            </span>
                                            <span className="mt-1.5 flex items-center gap-3">
                                                <span className="h-1 flex-1 rounded-full bg-white/[0.05]">
                                                    <span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: group.color }} />
                                                </span>
                                                <span className="w-11 shrink-0 text-right text-xs tabular-nums text-neutral-500">{percent.toFixed(1)}%</span>
                                            </span>
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <ul className="pb-2 pl-[30px] pr-2">
                                            {group.children.map((child, index) => {
                                                const childShare = group.value > 0 ? (child.value / group.value) * 100 : 0;
                                                return (
                                                    <li
                                                        key={child.key}
                                                        onMouseEnter={() => setActiveKey(child.key)}
                                                        onMouseLeave={() => setActiveKey(group.key)}
                                                        className="flex items-center gap-3 border-l border-white/[0.08] py-1.5 pl-5"
                                                    >
                                                        <span
                                                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                                                            style={{ backgroundColor: child.color, opacity: childOpacity(child, group, index) }}
                                                        />
                                                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">{child.label}</span>
                                                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">{childShare.toFixed(0)}%</span>
                                                        <span className="w-24 shrink-0 text-right text-sm tabular-nums text-neutral-200">R$ {formatCurrency(child.value)}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
