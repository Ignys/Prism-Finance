import { ChevronRight, UserRound, Users } from "lucide-react";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { AuthShell } from "../layout/AuthShell";
import { usePage } from "../../context/PageContext";
import { auth } from "../../firebase/firebaseClient";
import { AccountSettingsTab } from "./settings/AccountSettingsTab";
import { FamilySettingsTab } from "./settings/FamilySettingsTab";
import { SettingsSidebarButton } from "./settings/SettingsSidebarButton";
import type { SettingsTab, SettingsTabId } from "./settings/types";

export function SettingsPage() {


    const { goToPage } = usePage();
    const [activeTab, setActiveTab] = useState<SettingsTabId>("account");
    const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
    const [monthlySummaryEnabled, setMonthlySummaryEnabled] = useState(true);
    const [focusModeEnabled, setFocusModeEnabled] = useState(false);

    const tabs = useMemo<SettingsTab[]>(
        () => [
            {
                id: "account",
                label: "Detalhes da conta",
                description: "Perfil ativo, sessão e preferências rápidas.",
                icon: UserRound,
            },
            {
                id: "family",
                label: "Família",
                description: "Espaço para vínculos, convites e permissões compartilhadas.",
                icon: Users,
            },
        ],
        []
    );


    async function handleSignOut() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Falha ao sair da conta:", error);
        }
    }

    return (
        <AuthShell mainClassName="text-white">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-[90%] flex-col gap-5 pb-6 pt-2">
                <header className="flex flex-wrap items-end justify-between gap-3 text-left px-3">
                    <div>
                        <h1 className="mt-2 text-2xl font-semibold text-white">Configurações</h1>
                    </div>

                    <button
                        type="button"
                        onClick={() => goToPage("home")}
                        className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
                    >
                        Voltar ao início
                        <ChevronRight size={16} />
                    </button>
                </header>

                <section className="flex justify-center gap-2 ">
                    <aside className=" border-white/[0.08] p-2 min-w-[280px] max-w-[280px]">
                        <nav className="space-y-1">
                            {tabs.map((tab) => (
                                <SettingsSidebarButton
                                    key={tab.id}
                                    active={activeTab === tab.id}
                                    icon={tab.icon}
                                    label={tab.label}
                                    onClick={() => setActiveTab(tab.id)}
                                />
                            ))}
                        </nav>
                    </aside>

                    <div className="grow px-3">
                        {activeTab === "account" ? (
                            <AccountSettingsTab
                                emailAlertsEnabled={emailAlertsEnabled}
                                focusModeEnabled={focusModeEnabled}
                                monthlySummaryEnabled={monthlySummaryEnabled}
                                onEmailAlertsChange={setEmailAlertsEnabled}
                                onFocusModeChange={setFocusModeEnabled}
                                onMonthlySummaryChange={setMonthlySummaryEnabled}
                                onOpenRegistry={() => goToPage("registry")}
                                onOpenTransactions={() => goToPage("transactions")}
                                onOpenWishlist={() => goToPage("wishlist")}
                                onSignOut={handleSignOut}
                            />
                        ) : (
                            <FamilySettingsTab />
                        )}
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
