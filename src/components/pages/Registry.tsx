import type { ReactNode } from "react";
import { CreditCard, LayoutGrid, Tag, UserRound, Wallet } from "lucide-react";
import { type AppPage, usePage } from "../../context/PageContext";
import { RegistryBeneficiariesSection } from "./registry/RegistryBeneficiariesSection";
import { RegistryCategoriesSection } from "./registry/RegistryCategoriesSection";
import { RegistryCreditCardsSection } from "./registry/RegistryCreditCardsSection";
import { RegistryTagsSection } from "./registry/RegistryTagsSection";
import { RegistryWalletsSection } from "./registry/RegistryWalletsSection";

type RegistryTabPage = "wallets" | "creditCards" | "categories" | "beneficiaries" | "tags";

const REGISTRY_TABS: { page: RegistryTabPage; label: string; description: string; icon: ReactNode }[] = [
    { page: "wallets", label: "Carteiras", description: "Contas, saldos iniciais e favoritas", icon: <Wallet size={16} /> },
    { page: "creditCards", label: "Cartões de crédito", description: "Limites, vencimentos e cartões favoritos", icon: <CreditCard size={16} /> },
    { page: "categories", label: "Categorias", description: "Classificação de receitas e despesas", icon: <LayoutGrid size={16} /> },
    { page: "beneficiaries", label: "Beneficiários", description: "Pessoas, pets e centros de custo", icon: <UserRound size={16} /> },
    { page: "tags", label: "Tags", description: "Marcadores livres para organização", icon: <Tag size={16} /> },
];

function isRegistryTabPage(page: AppPage): page is RegistryTabPage {
    return REGISTRY_TABS.some((tab) => tab.page === page);
}

function renderRegistrySection(page: RegistryTabPage) {
    switch (page) {
        case "wallets":
            return <RegistryWalletsSection />;
        case "creditCards":
            return <RegistryCreditCardsSection />;
        case "categories":
            return <RegistryCategoriesSection />;
        case "beneficiaries":
            return <RegistryBeneficiariesSection />;
        case "tags":
            return <RegistryTagsSection />;
        default:
            return <RegistryWalletsSection />;
    }
}

export function RegistryPage() {
    const { currentPage, goToPage } = usePage();
    const activeTab = currentPage === "registry" ? "wallets" : isRegistryTabPage(currentPage) ? currentPage : "wallets";

    return (
        <div className="flex min-h-[calc(100vh-8rem)] justify-center overflow-visible lg:h-[calc(95vh-5rem)] lg:min-h-0 lg:overflow-hidden">
            <section className="flex min-h-0 w-full flex-col space-y-3 overflow-visible lg:h-full lg:overflow-hidden">
                <div className="flex flex-wrap gap-2">
                    {REGISTRY_TABS.map((tab) => {
                        const isActive = tab.page === activeTab;

                        return (
                            <button
                                key={tab.page}
                                type="button"
                                onClick={() => goToPage(tab.page)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                                    isActive
                                        ? "border-white/20 bg-white/[0.08] text-white"
                                        : "border-white/[0.08] bg-white/[0.02] text-white/65 hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-white"
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-0 flex-1 overflow-visible lg:overflow-hidden">{renderRegistrySection(activeTab)}</div>
            </section>
        </div>
    );
}
