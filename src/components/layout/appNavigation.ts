import { createElement, type ReactNode } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, CreditCard, FileText, Gift, Home, LayoutGrid, PiggyBank, Tag, TrendingUp, UserRound, Wallet, WalletCards } from "lucide-react";
import type { NavSubitem } from "./NavSubitems";
import { type AppPage, getPathForPage } from "../../context/PageContext";

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
        label: "Planejamento",
        page: "planning",
        icon: createElement(TrendingUp, { size: 20 }),
        description: "Projeção mês a mês e simulações financeiras.",
    },
    {
        label: "Orçamentos",
        page: "budgets",
        icon: createElement(PiggyBank, { size: 20 }),
        description: "Tetos de gastos por categoria e por recorrência.",
    },
    {
        label: "Relatórios",
        page: "reports",
        icon: createElement(BarChart3, { size: 20 }),
        description: "Fluxo, categorias e rankings de um período.",
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

function subitem(page: AppPage, label: string, icon: typeof Wallet): NavSubitem {
    return { id: page, label, path: getPathForPage(page), marker: createElement(icon, { size: 15, strokeWidth: 2 }) };
}

export const TRANSACTION_NAVIGATION_SUBITEMS: NavSubitem[] = [
    subitem("income", "Receitas", ArrowUpRight),
    subitem("spending", "Despesas", ArrowDownLeft),
    subitem("transfer", "Transferências", ArrowLeftRight),
];

export const REGISTRY_NAVIGATION_SUBITEMS: NavSubitem[] = [
    subitem("wallets", "Carteiras", Wallet),
    subitem("creditCards", "Cartões de crédito", CreditCard),
    subitem("categories", "Categorias", LayoutGrid),
    subitem("beneficiaries", "Beneficiários", UserRound),
    subitem("tags", "Tags", Tag),
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
