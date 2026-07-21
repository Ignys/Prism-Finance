import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getPathForPage, usePage } from "../../context/PageContext";
import { APP_NAVIGATION_ITEMS, normalizeNavigationPage } from "./appNavigation";

interface NavSectionProps {
    compactAtLaptop?: boolean;
    indicatorLayoutId?: string;
    onNavigate?: () => void;
}

export function NavSection({ compactAtLaptop = false, indicatorLayoutId = "nav-indicator", onNavigate }: NavSectionProps) {
    const [hoveredNav, setHoveredNav] = useState<string | null>(null);
    const { currentPage } = usePage();
    const normalizedPage = normalizeNavigationPage(currentPage);
    const activeItem = APP_NAVIGATION_ITEMS.find((item) => item.page === normalizedPage);
    const indicatorTarget = hoveredNav ?? activeItem?.label ?? null;

    return (
        <nav className="relative flex flex-col items-center gap-1 p-[3px]" aria-label="Navegação principal" onMouseLeave={() => setHoveredNav(null)}>
            {APP_NAVIGATION_ITEMS.map(({ label, page, icon }) => {
                const isActive = normalizedPage === page;
                const isLit = hoveredNav ? hoveredNav === label : isActive;

                return (
                    <Link
                        key={page}
                        to={getPathForPage(page)}
                        aria-label={label}
                        aria-current={isActive ? "page" : undefined}
                        title={compactAtLaptop ? label : undefined}
                        onClick={onNavigate}
                        onMouseEnter={() => setHoveredNav(label)}
                        className={[
                            "relative z-10 flex w-full items-center whitespace-nowrap rounded-lg px-2 py-[7px]",
                            "text-[12.5px] font-medium tracking-[0.02em] transition-colors duration-[180ms]",
                            compactAtLaptop ? "laptop:justify-center desktop:justify-start" : "",
                            isLit ? "text-neutral-300" : "text-neutral-600",
                            isActive ? "bg-white/[0.15] text-white" : "",
                        ].join(" ")}
                    >
                        {indicatorTarget === label ? (
                            <motion.span
                                layoutId={indicatorLayoutId}
                                className="absolute inset-0 w-full rounded-lg bg-white/[0.05]"
                                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                            />
                        ) : null}

                        <span
                            className={[
                                "relative z-10 flex min-w-0 items-center gap-2 transition-[gap] duration-300 ease-out",
                                compactAtLaptop ? "laptop:gap-0 desktop:gap-2" : "",
                            ].join(" ")}
                        >
                            <span className="flex shrink-0 items-center justify-center">{icon}</span>
                            <span
                                className={[
                                    "max-w-44 overflow-hidden whitespace-nowrap text-xs uppercase opacity-100 transition-[max-width,opacity] duration-300 ease-out",
                                    compactAtLaptop ? "laptop:max-w-0 laptop:opacity-0 desktop:max-w-44 desktop:opacity-100" : "",
                                ].join(" ")}
                            >
                                {label}
                            </span>
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
