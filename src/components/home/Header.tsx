import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, CalendarRange, ChevronDown, FolderKanban, Home, LogOut, ReceiptText, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import {
    useFinanceCategories,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinanceFavoriteCreditCard,
    useFinanceFavoriteWallet,
    useFinanceSession,
    useFinanceSummary,
    useFinanceTransactions,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { auth } from "../../firebase/firebaseClient";
import { buildCreditCardInvoiceId, getMonthKeyFromDateValue, resolveCreditCardInvoiceCycle } from "../../context/financeTypes";
import { useModal } from "../../context/ModalContext";
import { AppPage, usePage } from "../../context/PageContext";
import { formatLocalDateInput, getLocalTodayDate } from "../../lib/localDate";

const AddIncome = lazy(() => import("../modal/AddIncome").then((module) => ({ default: module.AddIncome })));
const AddSpending = lazy(() => import("../modal/AddSpending").then((module) => ({ default: module.AddSpending })));
const AddCardSpending = lazy(() => import("../modal/AddCardSpending").then((module) => ({ default: module.AddCardSpending })));

const iconSize = 20;

const NAV_ITEMS: { label: string; page: AppPage; icon: React.ReactNode }[] = [
    { label: "Início", page: "home", icon: <Home size={iconSize} /> },
    { label: "Transações", page: "transactions", icon: <ArrowLeftRight size={iconSize} /> },
    { label: "Fatura", page: "statement", icon: <ReceiptText size={iconSize} /> },
    { label: "Planejamentos", page: "planning", icon: <CalendarRange size={iconSize} /> },
    { label: "Cadastros", page: "registry", icon: <FolderKanban size={iconSize} /> },
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

function renderLazyModal(modalType: "income" | "spending" | "card_spending") {
    return (
        <Suspense fallback={<div className="rounded-lg bg-neutral-900 p-6 text-sm">Carregando...</div>}>
            {modalType === "income" ? <AddIncome /> : modalType === "spending" ? <AddSpending /> : <AddCardSpending />}
        </Suspense>
    );
}

export function Header() {
    const { user } = useFinanceSession();
    const summary = useFinanceSummary();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const categories = useFinanceCategories();
    const transactions = useFinanceTransactions();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const favoriteCreditCardId = useFinanceFavoriteCreditCard();
    const { goToPage, currentPage } = usePage();
    const { openModal } = useModal();
    const [hoveredNav, setHoveredNav] = useState<string | null>(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);

    const resolvedWalletId = wallets.some((wallet) => wallet.id === favoriteWalletId) ? favoriteWalletId : (wallets[0]?.id ?? "default");
    const resolvedFavoriteCard = useMemo(() => creditCards.find((card) => card.id === favoriteCreditCardId) ?? creditCards[0] ?? null, [creditCards, favoriteCreditCardId]);
    const openFavoriteInvoiceId = useMemo(() => {
        if (!resolvedFavoriteCard) {
            return null;
        }

        const openCycle = resolveCreditCardInvoiceCycle(getLocalTodayDate(), resolvedFavoriteCard.closingDay, resolvedFavoriteCard.dueDay);
        return buildCreditCardInvoiceId(resolvedFavoriteCard.id, openCycle.cycleKey);
    }, [resolvedFavoriteCard]);
    const pendingInvoicesAmount = useMemo(
        () =>
            Number(
                creditCardInvoices
                    .reduce((sum, invoice) => {
                        const openAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
                        return sum + openAmount;
                    }, 0)
                    .toFixed(2),
            ),
        [creditCardInvoices],
    );
    const monthlySummary = useMemo(() => {
        const currentMonthKey = getMonthKeyFromDateValue(getLocalTodayDate());

        const totals = transactions.reduce(
            (acc, transaction) => {
                if (transaction.status !== "paid") {
                    return acc;
                }

                if (getMonthKeyFromDateValue(transaction.date) !== currentMonthKey) {
                    return acc;
                }

                if (transaction.type === "income") {
                    acc.receitas += transaction.value;
                    return acc;
                }

                if (transaction.type === "spending" && transaction.paymentMethod !== "credit_card") {
                    acc.despesas += transaction.value;
                }

                return acc;
            },
            { receitas: 0, despesas: 0 },
        );

        return {
            receitas: Number(totals.receitas.toFixed(2)),
            despesas: Number(totals.despesas.toFixed(2)),
        };
    }, [transactions]);
    const metricAmounts = useMemo(
        () => ({
            balance: summary.balance,
            receitas: monthlySummary.receitas,
            despesas: monthlySummary.despesas,
        }),
        [monthlySummary.despesas, monthlySummary.receitas, summary.balance],
    );

    const userName = useMemo(() => {
        const displayName = user?.displayName?.trim();
        if (displayName) {
            return displayName;
        }

        const emailPrefix = user?.email?.split("@")[0]?.trim();
        if (emailPrefix) {
            return emailPrefix;
        }

        return "Usuario";
    }, [user?.displayName, user?.email]);
    const userInitial = userName.charAt(0).toUpperCase();
    const userPhotoUrl = user?.photoURL?.trim() ? user.photoURL : null;

    useEffect(() => {
        if (!isProfileMenuOpen) {
            return undefined;
        }

        function handleClickOutside(event: MouseEvent) {
            if (!profileMenuRef.current?.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsProfileMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isProfileMenuOpen]);

    function handleOpenSettings() {
        setIsProfileMenuOpen(false);
        window.alert("Configuracoes em breve.");
    }

    async function handleSwitchAccount() {
        setIsProfileMenuOpen(false);
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Falha ao trocar de conta:", error);
        }
    }

    const normalizedPage: AppPage =
        currentPage === "wallets" || currentPage === "creditCards" || currentPage === "beneficiaries" || currentPage === "categories" || currentPage === "tags"
            ? "registry"
            : currentPage === "spending" || currentPage === "income"
              ? "transactions"
              : currentPage;
    const indicatorTarget = hoveredNav ?? NAV_ITEMS.find((item) => item.page === normalizedPage)?.label ?? null;

    return (
        <header className="pointer-events-none sticky top-5 z-20 mb-10 px-6">
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
                        const isActive = normalizedPage === page;
                        const isLit = hoveredNav ? hoveredNav === label : isActive;

                        return (
                            <button
                                key={page + label}
                                type="button"
                                onClick={() => goToPage(page)}
                                onMouseEnter={() => setHoveredNav(label)}
                                className={[
                                    "relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-[7px]",
                                    "text-[12.5px] font-medium tracking-[0.02em] transition-colors duration-[180ms]",
                                    isLit ? "text-neutral-300" : "text-neutral-600",
                                    isActive && "bg-white/[0.15] text-white",
                                ].join(" ")}
                            >
                                {indicatorTarget === label && (
                                    <motion.span layoutId="nav-indicator" className="absolute inset-0 rounded-lg bg-white/[0.05]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {icon}
                                    <span className="overflow-hidden whitespace-nowrap text-xs uppercase">{label}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2">
                    {METRIC_ITEMS.map(({ label, amountKey, modalType, isBalance }, index) => {
                        const amount: number = metricAmounts[amountKey];
                        const amountColor = isBalance ? (amount >= 0 ? "text-emerald-300" : "text-red-400") : "text-white/85";

                        return (
                            <div key={label + index} className="contents">
                                {index > 0 && <div className="mx-0.5 h-5 w-px bg-white/[0.06]" />}
                                {!isBalance ? (
                                    <div className="group relative flex cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-5 py-1.5 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.05]">
                                        <div className="flex flex-col gap-px transition-opacity duration-150 group-hover:opacity-0">
                                            <span className="whitespace-nowrap text-[12px] font-light uppercase tracking-[0.2em] text-white/30 text-start">{label}</span>
                                            <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                                R$ {amount.toFixed(2)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => modalType && openModal(renderLazyModal(modalType))}
                                            title={`Adicionar ${label}`}
                                            className={[
                                                "absolute inset-0 flex w-full cursor-pointer items-center justify-center gap-[5px] rounded-[9px]",
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
                                            <span className="whitespace-nowrap text-[12px] font-light uppercase tracking-[0.2em] text-white/30 text-start">{label}</span>
                                            <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                                R$ {amount.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="mx-0.5 h-5 w-px bg-white/[0.06]" />
                    <div className="group relative flex cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-5 py-1.5 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.05]">
                        <div className="flex flex-col gap-px transition-opacity duration-150 group-hover:opacity-0">
                            <span className="whitespace-nowrap text-[12px] font-light uppercase tracking-[0.2em] text-white/30 text-start">Faturas</span>
                            <span className="whitespace-nowrap text-[15px] font-normal text-white/85" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                R$ {pendingInvoicesAmount.toFixed(2)}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => openModal(renderLazyModal("card_spending"))}
                            title="Adicionar gasto no cartao"
                            className={[
                                "absolute inset-0 flex w-full cursor-pointer items-center justify-center gap-[5px] rounded-[9px]",
                                "border-none bg-white/[0.08] text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70",
                                "opacity-0 backdrop-blur-sm transition-opacity duration-[180ms] group-hover:opacity-100",
                            ].join(" ")}
                        >
                            Adicionar
                        </button>
                    </div>
                    <div className="mx-0.5 h-5 w-px bg-white/[0.06]" />
                    <div className="relative" ref={profileMenuRef}>
                        <button
                            type="button"
                            onClick={() => setIsProfileMenuOpen((current) => !current)}
                            aria-haspopup="menu"
                            aria-expanded={isProfileMenuOpen}
                            className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.07]"
                        >
                            <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-700 text-xs font-semibold text-white">
                                {userPhotoUrl ? <img src={userPhotoUrl} alt={`Foto de ${userName}`} className="h-full w-full object-cover" /> : userInitial}
                            </span>
                            <span className="max-w-[120px] truncate text-sm font-medium text-white/90">{userName}</span>
                            <ChevronDown size={16} className={`text-white/60 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isProfileMenuOpen && (
                            <div
                                role="menu"
                                aria-label="Menu do usuario"
                                className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[180px] overflow-hidden rounded-xl border border-white/[0.1] bg-neutral-950/95 p-1 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.85)] backdrop-blur-lg"
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleOpenSettings}
                                    className="w-full flex gap-2 items-center rounded-lg px-3 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08]"
                                >
                                    <Settings size={18} />
                                    Configurações
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleSwitchAccount}
                                    className="w-full flex gap-2 items-center rounded-lg px-3 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08]"
                                >
                                    <LogOut size={18} />
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
