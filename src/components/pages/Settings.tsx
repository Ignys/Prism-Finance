import { ChevronRight, Database, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { usePage } from "../../context/PageContext";
import { signOutSupabase } from "../../supabase/auth/authService";
import { AccountSettingsTab } from "./settings/AccountSettingsTab";
import { DataSettingsTab } from "./settings/DataSettingsTab";
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
            {
                id: "data",
                label: "Dados",
                description: "Backups, importacao e restauracao de snapshots.",
                icon: Database,
            },
        ],
        []
    );


    async function handleSignOut() {
        try {
            await signOutSupabase();
        } catch (error) {
            console.error("Falha ao sair da conta:", error);
        }
    }

    return (
        <>
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] flex-col gap-5">
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

                <section className="flex min-w-0 flex-col justify-center gap-2 lg:flex-row">
                    <aside className="w-full border-white/[0.08] p-2 lg:min-w-[280px] lg:max-w-[280px]">
                        <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
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

                    <div className="min-w-0 grow px-0 sm:px-3">
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
                        ) : activeTab === "data" ? (
                            <DataSettingsTab />
                        ) : (
                            <FamilySettingsTab />
                        )}
                    </div>
                </section>
            </div>
        </>
    );
}
