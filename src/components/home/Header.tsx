import { useMemo } from "react";
import { Menu } from "lucide-react";
import { useFinanceCreditCardInvoices, useFinanceSession, useFinanceSummary, useFinanceTransactions, useFinanceWallets } from "../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../context/financeTypes";
import { usePage } from "../../context/PageContext";
import { getLocalTodayDate } from "../../lib/localDate";
import { resolveUserDisplayName } from "../../lib/userProfile";
import { signOutSupabase } from "../../supabase/auth/authService";
import { HeaderMetricsRow } from "./header/HeaderMetricsRow";
import { HeaderProfileMenu } from "./header/HeaderProfileMenu";

interface HeaderProps {
    onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
    const { user, profile } = useFinanceSession();
    const summary = useFinanceSummary();
    const creditCardInvoices = useFinanceCreditCardInvoices();
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { goToPage } = usePage();

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

    const walletInclusionById = useMemo(() => new Map(wallets.map((wallet) => [wallet.id, wallet.includeInMainTotals])), [wallets]);

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

                if ((walletInclusionById.get(transaction.inWallet) ?? true) === false) {
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
    }, [transactions, walletInclusionById]);

    const metricAmounts = useMemo(
        () => ({
            balance: summary.balance,
            receitas: monthlySummary.receitas,
            despesas: monthlySummary.despesas,
            pendingInvoices: pendingInvoicesAmount,
        }),
        [monthlySummary.despesas, monthlySummary.receitas, pendingInvoicesAmount, summary.balance],
    );

    const userName = profile?.displayName ?? resolveUserDisplayName(user);
    const userPhotoUrl = profile ? profile.photoURL : user?.photoURL?.trim() ? user.photoURL : null;

    function handleOpenSettings() {
        goToPage("settings");
    }

    async function handleSwitchAccount() {
        try {
            await signOutSupabase();
        } catch (error) {
            console.error("Falha ao trocar de conta:", error);
        }
    }

    return (
        <header className="pointer-events-none sticky top-2.5 z-20 mx-2 mb-2.5">
            <div
                className="pointer-events-auto rounded-[18px] border border-white/[0.08] px-3 py-2 bg-zinc-950/70"
                style={{
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                }}
            >
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={onOpenSidebar}
                            aria-label="Abrir menu lateral"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.03] text-white/75 transition-[background-color,color,transform] duration-200 hover:scale-[1.04] hover:bg-white/[0.07] hover:text-white laptop:hidden"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="elegant-scrollbar min-w-0 flex-1 overflow-x-auto pb-0.5">
                            <HeaderMetricsRow amounts={metricAmounts} />
                        </div>
                    </div>
                    <HeaderProfileMenu onOpenSettings={handleOpenSettings} onSignOut={handleSwitchAccount} userName={userName} userPhotoUrl={userPhotoUrl} />
                </div>
            </div>
        </header>
    );
}
