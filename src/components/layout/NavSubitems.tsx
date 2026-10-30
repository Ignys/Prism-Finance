import { motion } from "framer-motion";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";

export interface NavSubitem {
    id: string;
    label: string;
    path: string;
    marker?: ReactNode;
}

interface NavSubitemsProps {
    items: NavSubitem[];
    activeId: string | null;
    compactAtLaptop?: boolean;
    indicatorLayoutId: string;
    onNavigate?: () => void;
}

export function NavSubitems({ items, activeId, compactAtLaptop = false, indicatorLayoutId, onNavigate }: NavSubitemsProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const indicatorId = hoveredId ?? activeId;

    if (items.length === 0) return null;

    // Em telas baixas a sidebar fica só com os itens principais.
    return (
        <div className="w-full [@media(max-height:820px)]:hidden">
            <ul
                onMouseLeave={() => setHoveredId(null)}
                className={["ml-2 w-[calc(100%-0.5rem)] border-l border-white/10 py-0.5", compactAtLaptop ? "laptop:hidden desktop:block" : ""].join(" ")}
            >
                {items.map(({ id, label, path, marker }) => {
                    const isActive = id === activeId;

                    return (
                        <li key={id} className="relative">
                            {indicatorId === id ? (
                                <motion.span
                                    aria-hidden
                                    layoutId={indicatorLayoutId}
                                    className={["absolute -left-px top-1.5 bottom-1.5 w-px", isActive ? "bg-white" : "bg-white/40"].join(" ")}
                                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                />
                            ) : null}
                            <Link
                                to={path}
                                onClick={onNavigate}
                                onMouseEnter={() => setHoveredId(id)}
                                onFocus={() => setHoveredId(id)}
                                onBlur={() => setHoveredId(null)}
                                aria-current={isActive ? "page" : undefined}
                                title={label}
                                className={[
                                    "flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[13px] transition-colors duration-150",
                                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                                    isActive ? "text-white" : indicatorId === id ? "text-neutral-300" : "text-neutral-500",
                                ].join(" ")}
                            >
                                {marker ? (
                                    <span
                                        aria-hidden
                                        className={[
                                            "flex size-4 shrink-0 items-center justify-center transition-opacity duration-150",
                                            isActive || indicatorId === id ? "opacity-100" : "opacity-60",
                                        ].join(" ")}
                                    >
                                        {marker}
                                    </span>
                                ) : null}
                                <span className="truncate">{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
