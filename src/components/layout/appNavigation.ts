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
        label: "Inicio",
        page: "home",
        icon: createElement(Home, { size: 18 }),
        description: "Visão geral, alertas e atividades recentes.",
    },
    {
        label: "Transacoes",
        page: "transactions",
        icon: createElement(ArrowLeftRight, { size: 18 }),
        description: "Entradas, saídas e transferências.",
    },
    {
        label: "Fatura",
        page: "statement",
        icon: createElement(FileText, { size: 18 }),
        description: "Controle de cartões e faturas abertas.",
    },
    {
        label: "Analises",
        page: "planning",
        icon: createElement(ChartNoAxesCombined, { size: 18 }),
        description: "Planejamento e simulações financeiras.",
    },
    {
        label: "Wishlist",
        page: "wishlist",
        icon: createElement(Gift, { size: 18 }),
        description: "Itens desejados e prioridades de compra.",
    },
    {
        label: "Cadastros",
        page: "registry",
        icon: createElement(WalletCards, { size: 18 }),
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
