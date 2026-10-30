import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, FileText, Home, Menu, Plus, Settings } from "lucide-react";
import { Suspense, lazy, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { APP_NAVIGATION_ITEMS } from "../components/layout/appNavigation";
import { AddCardSpending } from "../components/modal/AddCardSpending";
import { AddTransactionModal } from "../components/modal/AddTransaction";
import { DisplayModal } from "../components/modal/DisplayModal";
import { PageSkeletonScreen } from "../components/pages/Loading";
import { useModal } from "../context/ModalContext";
import { getPathForPage, usePage } from "../context/PageContext";
import { MobileHeader } from "./MobileHeader";
import { MobileHome } from "./MobileHome";
import { MobileSheet } from "./MobileSheet";
import { MobileRegistry } from "./registry/MobileRegistry";
import { MobileStatement } from "./MobileStatement";
import { MobileTransactions } from "./MobileTransactions";
import { MobileWishlist } from "./MobileWishlist";

const TAB_PAGES = new Set(["home", "transactions", "statement"]);
const MORE_ITEMS = APP_NAVIGATION_ITEMS.filter((item) => !TAB_PAGES.has(item.page));

// Heavier pages load on demand, like on desktop.
const MobilePlanning = lazy(() => import("./MobilePlanning").then((module) => ({ default: module.MobilePlanning })));
const MobileReports = lazy(() => import("./MobileReports").then((module) => ({ default: module.MobileReports })));

const REGISTRY_PATHS = ["/registry", "/registry/carteiras", "/registry/wallets", "/registry/cartoes", "/registry/credit-cards", "/registry/creditcards", "/registry/categorias", "/registry/categories", "/registry/beneficiarios", "/registry/beneficiaries", "/registry/tags"];

const TRANSACTION_PATHS = ["/transactions", "/transactions/receitas", "/transactions/income", "/transactions/despesas", "/transactions/spending", "/transactions/transferencias", "/transactions/transfer", "/transactions/transfers"];

// Mobile pages are declared before the shared routes, so they win on equal paths; the rest render the desktop page content.
export function MobileApp({ routes }: { routes: ReactNode }) {
    const { currentPage } = usePage();
    const { pathname } = useLocation();
    const reduceMotion = useReducedMotion();

    return (
        <div className="min-h-dvh bg-[#0e0e10] pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-white">
            <DisplayModal />
            <MobileHeader />
            <main className="min-w-0 px-3 pt-3">
                <Suspense fallback={<PageSkeletonScreen page={currentPage} />}>
                    <motion.div
                        key={pathname}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Routes>
                            <Route path="/home" element={<MobileHome />} />
                            {TRANSACTION_PATHS.map((path) => (
                                <Route key={path} path={path} element={<MobileTransactions key={path} />} />
                            ))}
                            <Route path="/statement" element={<MobileStatement />} />
                            <Route path="/fatura" element={<MobileStatement />} />
                            <Route path="/wishlist" element={<MobileWishlist />} />
                            {["/planning", "/planejamento", "/analises"].map((path) => (
                                <Route key={path} path={path} element={<MobilePlanning />} />
                            ))}
                            {["/reports", "/relatorios"].map((path) => (
                                <Route key={path} path={path} element={<MobileReports />} />
                            ))}
                            {REGISTRY_PATHS.map((path) => (
                                <Route key={path} path={path} element={<MobileRegistry />} />
                            ))}
                            {routes}
                        </Routes>
                    </motion.div>
                </Suspense>
            </main>
            <MobileTabBar />
        </div>
    );
}

const MORE_PATHS = new Set(MORE_ITEMS.map((item) => getPathForPage(item.page)).concat(getPathForPage("settings")));
const PILL_TRANSITION = { type: "spring", stiffness: 500, damping: 40 } as const;

function TabButton({ active, label, icon, ...rest }: { active: boolean; label: string; icon: ReactNode } & ({ to: string } | { onClick: () => void })) {
    const reduceMotion = useReducedMotion();
    const content = (
        <>
            {active && <motion.span layoutId="mobile-tab-pill" transition={reduceMotion ? { duration: 0 } : PILL_TRANSITION} className="absolute inset-x-1 inset-y-1 -z-10 rounded-2xl bg-white/[0.08]" />}
            <motion.span animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }} transition={reduceMotion ? { duration: 0 } : PILL_TRANSITION}>
                {icon}
            </motion.span>
            <span className={active ? "font-medium" : ""}>{label}</span>
        </>
    );
    const className = `relative isolate flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] outline-none transition-colors focus-visible:text-white ${active ? "text-white" : "text-neutral-500"}`;

    return "to" in rest ? (
        <Link to={rest.to} aria-current={active ? "page" : undefined} className={className}>
            {content}
        </Link>
    ) : (
        <button type="button" aria-haspopup="dialog" onClick={rest.onClick} className={className}>
            {content}
        </button>
    );
}

const rowClass = "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none active:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-sky-400/60";

function MobileTabBar() {
    const { openModal } = useModal();
    const { pathname } = useLocation();
    const reduceMotion = useReducedMotion();
    const [sheet, setSheet] = useState<"create" | "more" | null>(null);
    const close = () => setSheet(null);
    const create = (modal: ReactNode) => {
        close();
        openModal(modal);
    };
    const onMorePage = [...MORE_PATHS].some((path) => pathname === path || pathname.startsWith(`${path}/`));

    return (
        <>
            <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40">
                <div className="flex items-center rounded-[1.4rem] border border-white/[0.08] bg-[#17171a]/85 px-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                    <TabButton to="/home" label="Início" icon={<Home size={20} />} active={pathname === "/home"} />
                    <TabButton to="/transactions" label="Transações" icon={<ArrowLeftRight size={20} />} active={pathname.startsWith("/transactions")} />
                    <div className="flex flex-1 justify-center py-1.5">
                        <motion.button
                            type="button"
                            aria-label={sheet === "create" ? "Fechar" : "Nova transação"}
                            aria-haspopup="dialog"
                            onClick={() => setSheet(sheet === "create" ? null : "create")}
                            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                            animate={{ rotate: sheet === "create" ? 45 : 0 }}
                            transition={reduceMotion ? { duration: 0 } : PILL_TRANSITION}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black shadow-[0_6px_20px_-6px_rgba(255,255,255,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                            <Plus size={24} strokeWidth={2.4} />
                        </motion.button>
                    </div>
                    <TabButton to="/statement" label="Faturas" icon={<FileText size={20} />} active={pathname === "/statement" || pathname === "/fatura"} />
                    <TabButton onClick={() => setSheet("more")} label="Mais" icon={<Menu size={20} />} active={sheet === "more" || (sheet === null && onMorePage)} />
                </div>
            </nav>

            <MobileSheet open={sheet === "create"} onClose={close} title="Nova transação">
                <button type="button" className={rowClass} onClick={() => create(<AddTransactionModal type="income" />)}>
                    <ArrowUpRight size={20} className="text-emerald-300" /> Receita
                </button>
                <button type="button" className={rowClass} onClick={() => create(<AddTransactionModal type="spending" />)}>
                    <ArrowDownLeft size={20} className="text-rose-300" /> Despesa
                </button>
                <button type="button" className={rowClass} onClick={() => create(<AddCardSpending />)}>
                    <CreditCard size={20} className="text-sky-300" /> Gasto no cartão
                </button>
            </MobileSheet>

            <MobileSheet open={sheet === "more"} onClose={close} title="Mais páginas">
                {MORE_ITEMS.map((item) => (
                    <Link key={item.page} to={getPathForPage(item.page)} onClick={close} className={rowClass}>
                        <span className="text-neutral-400">{item.icon}</span>
                        <span className="min-w-0">
                            <span className="block text-sm text-white">{item.label}</span>
                            <span className="block truncate text-xs text-neutral-500">{item.description}</span>
                        </span>
                    </Link>
                ))}
                <Link to={getPathForPage("settings")} onClick={close} className={rowClass}>
                    <Settings size={20} className="text-neutral-400" />
                    <span className="text-sm text-white">Configurações</span>
                </Link>
            </MobileSheet>
        </>
    );
}
