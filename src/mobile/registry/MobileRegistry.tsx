import { CreditCard, LayoutGrid, Tag, UserRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { type AppPage, usePage } from "../../context/PageContext";
import { MobileBeneficiariesSection } from "./MobileBeneficiariesSection";
import { MobileCategoriesSection } from "./MobileCategoriesSection";
import { MobileCreditCardsSection } from "./MobileCreditCardsSection";
import { MobileTagsSection } from "./MobileTagsSection";
import { MobileWalletsSection } from "./MobileWalletsSection";

type RegistryTab = "wallets" | "creditCards" | "categories" | "beneficiaries" | "tags";

const TABS: { page: RegistryTab; label: string; icon: ReactNode; section: ReactNode }[] = [
    { page: "wallets", label: "Carteiras", icon: <Wallet size={16} />, section: <MobileWalletsSection /> },
    { page: "creditCards", label: "Cartões", icon: <CreditCard size={16} />, section: <MobileCreditCardsSection /> },
    { page: "categories", label: "Categorias", icon: <LayoutGrid size={16} />, section: <MobileCategoriesSection /> },
    { page: "beneficiaries", label: "Beneficiários", icon: <UserRound size={16} />, section: <MobileBeneficiariesSection /> },
    { page: "tags", label: "Tags", icon: <Tag size={16} />, section: <MobileTagsSection /> },
];

function isRegistryTab(page: AppPage): page is RegistryTab {
    return TABS.some((tab) => tab.page === page);
}

export function MobileRegistry() {
    const { currentPage, goToPage } = usePage();
    const activeTab = isRegistryTab(currentPage) ? currentPage : "wallets";
    const active = TABS.find((tab) => tab.page === activeTab) ?? TABS[0];

    return (
        <div className="space-y-5 pb-4">
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]" role="tablist" aria-label="Cadastros">
                {TABS.map((tab) => {
                    const selected = tab.page === activeTab;
                    return (
                        <button
                            key={tab.page}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => goToPage(tab.page)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                                selected ? "border-neutral-300/45 bg-neutral-500/15 text-neutral-50" : "border-transparent bg-white/[0.03] text-neutral-400"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div role="tabpanel">{active.section}</div>
        </div>
    );
}
