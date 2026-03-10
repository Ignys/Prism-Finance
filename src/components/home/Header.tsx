import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Home, Tags, UserRound, Wallet } from "lucide-react";
import { useFinanceSummary } from "../../context/FinanceContext";
import { useModal } from "../../context/ModalContext";
import { AppPage, usePage } from "../../context/PageContext";

const AddIncome = lazy(() => import("../modal/AddIncome").then((module) => ({ default: module.AddIncome })));
const AddSpending = lazy(() => import("../modal/AddSpending").then((module) => ({ default: module.AddSpending })));

const iconSize = 20;

const NAV_ITEMS: { label: string; page: AppPage; icon: React.ReactNode }[] = [
    { label: "Inicio", page: "home", icon: <Home size={iconSize} /> },
    { label: "Carteiras", page: "balance", icon: <Wallet size={iconSize} /> },
    { label: "Transações", page: "transactions", icon: <ArrowLeftRight size={iconSize} /> },
    { label: "Beneficiarios", page: "beneficiaries", icon: <UserRound size={iconSize} /> },
    { label: "Categorias", page: "categories", icon: <Tags size={iconSize} /> },
    { label: "Tags", page: "tags", icon: <Tags size={iconSize} /> },
];

const METRIC_ITEMS: {
    label: string;
    amountKey: "balance" | "receitas" | "despesas";
    modalType?: "income" | "spending";
    isBalance?: boolean;
}[] = [
    { label: "Saldo", amountKey: "balance", isBalance: true },
    { label: "Receitas", amountKey: "receitas", modalType: "income" },
    { label: "Despesas", amountKey: "despesas", modalType: "spending" },
];

function renderLazyModal(modalType: "income" | "spending") {
    return (
        <Suspense fallback={<div className="rounded-lg bg-neutral-900 p-6 text-sm">Carregando...</div>}>
            {modalType === "income" ? <AddIncome /> : <AddSpending />}
        </Suspense>
    );
}

export function Header() {
    const summary = useFinanceSummary();
    const { goToPage, currentPage } = usePage();
    const { openModal } = useModal();
    const [hoveredNav, setHoveredNav] = useState<string | null>(null);
    const indicatorTarget = hoveredNav ?? NAV_ITEMS.find((item) => item.page === currentPage)?.label ?? null;

    return (
        <header className="sticky top-5 z-50 px-6 pointer-events-none mb-10">
            <div
                className="pointer-events-auto flex items-center justify-between gap-2 rounded-[18px] border border-white/[0.08] px-3.5 py-2.5"
                style={{
                    background: "rgba(10,10,10,0.92)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2), 0 20px 50px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
            >
                <nav className="relative flex items-center gap-1 rounded-[11px] bg-white/[0.04] p-[3px]" onMouseLeave={() => setHoveredNav(null)}>
                    {NAV_ITEMS.map(({ label, page, icon }) => {
                        const isActive = currentPage === page;
                        const isLit = hoveredNav ? hoveredNav === label : isActive;

                        return (
                            <button
                                key={page + label}
                                type="button"
                                onClick={() => goToPage(page)}
                                onMouseEnter={() => setHoveredNav(label)}
                                className={[
                                    "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-[7px]",
                                    "text-[12.5px] font-medium tracking-[0.02em] transition-colors duration-[180ms] z-10",
                                    isLit ? "text-neutral-300" : "text-neutral-600",
                                    isActive && "bg-white/[0.15] text-white",
                                ].join(" ")}
                            >
                                {indicatorTarget === label && (
                                    <motion.span layoutId="nav-indicator" className="absolute inset-0 rounded-lg bg-white/[0.05]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {icon}
                                    <span className="text-xs uppercase overflow-hidden whitespace-nowrap">{label}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2">
                    {METRIC_ITEMS.map(({ label, amountKey, modalType, isBalance }, index) => {
                        const amount: number = summary[amountKey];
                        const amountColor = isBalance ? (amount >= 0 ? "text-emerald-300" : "text-red-400") : "text-white/85";

                        return (
                            <div key={label + index} className="contents">
                                {index > 0 && <div className="mx-0.5 h-5 w-px bg-white/[0.06]" />}
                                {!isBalance ? (
                                    <div className="group relative flex cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-5 py-1.5 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.05]">
                                        <div className="flex flex-col gap-px transition-opacity duration-150 group-hover:opacity-0">
                                            <span className="whitespace-nowrap text-[12px] font-light uppercase tracking-[0.2em] text-white/30">{label}</span>
                                            <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                                R$ {amount.toFixed(2)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => modalType && openModal(renderLazyModal(modalType))}
                                            title={`Adicionar ${label}`}
                                            className={[
                                                "absolute inset-0 flex cursor-pointer w-full items-center justify-center gap-[5px] rounded-[9px]",
                                                "border-none bg-white/[0.08] text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70",
                                                "opacity-0 backdrop-blur-sm transition-opacity duration-[180ms] group-hover:opacity-100",
                                            ].join(" ")}
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 rounded-[9px] border border-transparent px-5 py-1.5">
                                        <div className="flex flex-col gap-px">
                                            <span className="whitespace-nowrap text-[12px] font-light uppercase tracking-[0.2em] text-white/30">{label}</span>
                                            <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                                R$ {amount.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
