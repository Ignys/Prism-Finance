import { Menu } from "lucide-react";
import { useFinanceSession } from "../../context/FinanceContext";
import { usePage } from "../../context/PageContext";
import { resolveUserDisplayName } from "../../lib/userProfile";
import { signOutSupabase } from "../../supabase/auth/authService";
import { HeaderMetricsRow } from "./header/HeaderMetricsRow";
import { HeaderProfileMenu } from "./header/HeaderProfileMenu";
import { useHeaderAmounts } from "./header/useHeaderAmounts";

interface HeaderProps {
    onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
    const { user, profile } = useFinanceSession();
    const { goToPage } = usePage();

    const metricAmounts = useHeaderAmounts();

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
