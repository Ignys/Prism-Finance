import { createElement, type ReactNode } from "react";
import { ArrowLeftRight, ChartNoAxesCombined, FileText, Gift, Home, WalletCards } from "lucide-react";
import type { AppPage } from "../../context/PageContext";

export interface AppNavigationItem {
    label: string;
    page: AppPage;
    icon: ReactNode;
    description: string;
}

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
    {
        label: "Início",
        page: "home",
        icon: createElement(Home, { size: 20 }),
        description: "Visão geral, alertas e atividades recentes.",
    },
    {
        label: "Transações",
        page: "transactions",
        icon: createElement(ArrowLeftRight, { size: 20 }),
        description: "Entradas, saídas e transferências.",
    },
    {
        label: "Faturas",
        page: "statement",
        icon: createElement(FileText, { size: 20 }),
        description: "Controle de cartões e faturas abertas.",
    },
    {
        label: "Análises",
        page: "planning",
        icon: createElement(ChartNoAxesCombined, { size: 20 }),
        description: "Planejamento e simulações financeiras.",
    },
    {
        label: "Lista de desejos",
        page: "wishlist",
        icon: createElement(Gift, { size: 20 }),
        description: "Itens desejados e prioridades de compra.",
    },
    {
        label: "Cadastros",
        page: "registry",
        icon: createElement(WalletCards, { size: 20 }),
        description: "Carteiras, categorias, beneficiários e tags.",
    },
];

const REGISTRY_PAGES = new Set<AppPage>(["registry", "wallets", "creditCards", "beneficiaries", "categories", "tags"]);
const TRANSACTION_PAGES = new Set<AppPage>(["transactions", "spending", "income", "transfer"]);

export function normalizeNavigationPage(page: AppPage): AppPage {
    if (REGISTRY_PAGES.has(page)) {
        return "registry";
    }

    if (TRANSACTION_PAGES.has(page)) {
        return "transactions";
    }

    return page;
}
