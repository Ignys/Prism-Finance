import { motion } from "framer-motion";
import { ArrowLeftRight, ChartNoAxesCombined, FileText, Gift, Home, WalletCards, type LucideIcon } from "lucide-react";
import { useState } from "react"
import { AppPage, usePage } from "../../context/PageContext";

export function NavSection() {

    const iconSize = 20

    const NAV_ITEMS: { label: string; page: AppPage; icon: React.ReactNode }[] = [
        { label: "Início", page: "home", icon: <Home size={iconSize} /> },
        { label: "Transações", page: "transactions", icon: <ArrowLeftRight size={iconSize} /> },
        { label: "Fatura", page: "statement", icon: <FileText size={iconSize} /> },
        { label: "Análises", page: "planning", icon: <ChartNoAxesCombined size={iconSize} /> },
        { label: "Lista de Desejos", page: "wishlist", icon: <Gift size={iconSize} /> },
        { label: "Cadastros", page: "registry", icon: <WalletCards size={iconSize} /> },
    ];

    const [hoveredNav, setHoveredNav] = useState<string | null>(null);
    const { goToPage, currentPage } = usePage();

    const normalizedPage: AppPage =
            currentPage === "wallets" || currentPage === "creditCards" || currentPage === "beneficiaries" || currentPage === "categories" || currentPage === "tags"
                ? "registry"
                : currentPage === "spending" || currentPage === "income"
                  ? "transactions"
                  : currentPage;
        const indicatorTarget = hoveredNav ?? NAV_ITEMS.find((item) => item.page === normalizedPage)?.label ?? null;
        

    return (
        <nav className="relative flex flex-col items-center gap-1 p-[3px]" onMouseLeave={() => setHoveredNav(null)}>
            {NAV_ITEMS.map(({ label, page, icon }) => {
                const isActive = normalizedPage === page;
                const isLit = hoveredNav ? hoveredNav === label : isActive;

                return (
                    <button
                        key={page + label}
                        type="button"
                        onClick={() => goToPage(page)}
                        onMouseEnter={() => setHoveredNav(label)}
                        className={[
                            "relative w-full z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-[7px]",
                            "text-[12.5px] font-medium tracking-[0.02em] transition-colors duration-[180ms]",
                            isLit ? "text-neutral-300" : "text-neutral-600",
                            isActive && "bg-white/[0.15] text-white",
                        ].join(" ")}
                    >
                        {indicatorTarget === label && (
                            <motion.span layoutId="nav-indicator" className="w-full absolute inset-0 rounded-lg bg-white/[0.05]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            {icon}
                            <span className="overflow-hidden whitespace-nowrap text-xs uppercase">{label}</span>
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}