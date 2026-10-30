import { ArrowDownLeft, ArrowUpRight, ChevronRight, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { HeaderProfileMenu } from "../components/home/header/HeaderProfileMenu";
import { useHeaderAmounts } from "../components/home/header/useHeaderAmounts";
import { formatCurrencyBRL } from "../components/transactions/transactionView";
import { useFinanceSession } from "../context/FinanceContext";
import { usePage } from "../context/PageContext";
import { resolveUserDisplayName } from "../lib/userProfile";
import { signOutSupabase } from "../supabase/auth/authService";

// Same label treatment as the desktop HeaderMetricsRow.
export const LABEL_CLASS = "whitespace-nowrap text-[12px] font-light uppercase tracking-[0.09em] text-white/40";
const AMOUNT_FONT = { fontFamily: "'Azeret Mono', monospace" };
// Two thresholds: collapsing shortens the page, which can pull scrollY back under a single threshold and loop.
const COLLAPSE_AT = 48;
const EXPAND_AT = 8;

function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

function useCollapsedOnScroll() {
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        const update = () => setCollapsed((current) => (current ? window.scrollY > EXPAND_AT : window.scrollY > COLLAPSE_AT));
        update();
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, []);
    return collapsed;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
    return (
        <span className={`whitespace-nowrap tabular-nums ${className}`} style={AMOUNT_FONT}>
            {value < 0 && "−"}R$ {formatCurrencyBRL(Math.abs(value))}
        </span>
    );
}

export function MobileHeader() {
    const { user, profile } = useFinanceSession();
    const { goToPage } = usePage();
    const { balance, receitas, despesas, pendingInvoices } = useHeaderAmounts();
    const collapsed = useCollapsedOnScroll();

    const userName = profile?.displayName ?? resolveUserDisplayName(user);
    const userPhotoUrl = profile ? profile.photoURL : user?.photoURL?.trim() ? user.photoURL : null;
    const firstName = userName.trim().split(/\s+/)[0];
    const flow = receitas + despesas;

    const signOut = async () => {
        try {
            await signOutSupabase();
        } catch (error) {
            console.error("Falha ao trocar de conta:", error);
        }
    };

    return (
        <header
            className={`sticky top-0 z-30 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-[background-color,border-color] duration-300 motion-reduce:transition-none ${
                collapsed ? "border-b border-white/[0.06] bg-[#0e0e10]/90 pb-3 backdrop-blur-xl" : "border-b border-transparent pb-4"
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    {collapsed ? (
                        <p className="flex items-baseline gap-2">
                            <span className={LABEL_CLASS}>Saldo atual</span>
                            <Money value={balance} className={`text-lg ${balance < 0 ? "text-rose-300" : "text-white"}`} />
                        </p>
                    ) : (
                        <p className="truncate text-sm text-neutral-400">
                            {greeting()}
                            {firstName && `, ${firstName}`}
                        </p>
                    )}
                </div>
                <HeaderProfileMenu onOpenSettings={() => goToPage("settings")} onSignOut={signOut} userName={userName} userPhotoUrl={userPhotoUrl} />
            </div>

            {/* 1fr → 0fr collapses the details smoothly without measuring heights. */}
            <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                }`}
                inert={collapsed}
            >
                <div className="overflow-hidden">
                    <p className={`mt-4 ${LABEL_CLASS}`}>Saldo atual</p>
                    <Money value={balance} className={`mt-1 block text-[1.875rem] leading-none tracking-[-0.04em] ${balance < 0 ? "text-rose-300" : "text-white"}`} />

                    <div className="mt-5 flex h-1.5 gap-[3px]" role="img" aria-label={`Receitas desse mês R$ ${formatCurrencyBRL(receitas)}, despesas desse mês R$ ${formatCurrencyBRL(despesas)}`}>
                        {flow > 0 ? (
                            <>
                                {receitas > 0 && <span className="rounded-full bg-emerald-300" style={{ flexGrow: receitas }} />}
                                {despesas > 0 && <span className="rounded-full bg-rose-300" style={{ flexGrow: despesas }} />}
                            </>
                        ) : (
                            <span className="flex-1 rounded-full bg-white/[0.06]" />
                        )}
                    </div>

                    <div className="mt-3 text-sm">
                        <button type="button" onClick={() => goToPage("income")} className="flex w-full items-center justify-between gap-3 py-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
                            <span className={`flex items-center gap-2 ${LABEL_CLASS}`}>
                                <ArrowUpRight size={15} className="text-emerald-300" /> Receitas desse mês
                            </span>
                            <span className="flex items-center gap-1">
                                <Money value={receitas} className="text-neutral-100" />
                                <ChevronRight size={14} className="text-neutral-600" />
                            </span>
                        </button>
                        <button type="button" onClick={() => goToPage("spending")} className="flex w-full items-center justify-between gap-3 py-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
                            <span className={`flex items-center gap-2 ${LABEL_CLASS}`}>
                                <ArrowDownLeft size={15} className="text-rose-300" /> Despesas desse mês
                            </span>
                            <span className="flex items-center gap-1">
                                <Money value={despesas} className="text-neutral-100" />
                                <ChevronRight size={14} className="text-neutral-600" />
                            </span>
                        </button>
                        <button type="button" onClick={() => goToPage("statement")} className="flex w-full items-center justify-between gap-3 py-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
                            <span className={`flex items-center gap-2 ${LABEL_CLASS}`}>
                                <CreditCard size={15} className="text-violet-300" /> Faturas abertas
                            </span>
                            <span className="flex items-center gap-1">
                                <Money value={pendingInvoices} className="text-neutral-100" />
                                <ChevronRight size={14} className="text-neutral-600" />
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
