import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type AppPage =
    | "home"
    | "spending"
    | "income"
    | "planning"
    | "settings"
    | "wallets"
    | "creditCards"
    | "beneficiaries"
    | "categories"
    | "tags"
    | "statement"
    | "transactions"
    | "transfer"
    | "registry"
    | "wishlist";
export type TransactionsIntentTab = "income" | "spending" | "transfer";
export type PageNavigationIntent =
    | {
          page: "transactions";
          tab: TransactionsIntentTab;
      }
    | {
          page: "statement";
          selectedCardId: string;
          // Month key (YYYY-MM) for statement page, always interpreted as invoice due month.
          selectedMonth: string;
      };

interface PageContextType {
    currentPage: AppPage;
    setCurrentPage: React.Dispatch<React.SetStateAction<AppPage>>;
    goToPage: (page: AppPage, intent?: PageNavigationIntent) => void;
    consumePendingNavigation: () => PageNavigationIntent | null;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

const PAGE_PATHS: Record<AppPage, string> = {
    home: "/home",
    spending: "/transactions/spending",
    income: "/transactions/income",
    transfer: "/transactions/transfer",
    planning: "/planning",
    settings: "/settings",
    wallets: "/registry/carteiras",
    creditCards: "/registry/cartoes",
    beneficiaries: "/registry/beneficiarios",
    categories: "/registry/categorias",
    tags: "/registry/tags",
    statement: "/statement",
    transactions: "/transactions",
    registry: "/registry",
    wishlist: "/wishlist",
};

function normalizePathname(pathname: string) {
    const normalized = pathname.toLowerCase().replace(/\/+$/, "");
    return normalized || "/";
}

export function getPathForPage(page: AppPage, intent?: PageNavigationIntent) {
    if (intent?.page === "transactions" && page === "transactions") {
        if (intent.tab === "spending") return PAGE_PATHS.spending;
        if (intent.tab === "transfer") return PAGE_PATHS.transfer;
        return PAGE_PATHS.income;
    }

    return PAGE_PATHS[page];
}

export function getPageFromPathname(pathname: string): AppPage {
    const path = normalizePathname(pathname);

    if (path === "/" || path === "/home") return "home";

    if (path === "/transactions/despesas" || path === "/transactions/spending") return "spending";
    if (path === "/transactions/receitas" || path === "/transactions/income") return "income";
    if (path === "/transactions/transferencias" || path === "/transactions/transfers" || path === "/transactions/transfer") return "transfer";
    if (path === "/transactions") return "transactions";

    if (path === "/registry/carteiras" || path === "/registry/wallets") return "wallets";
    if (path === "/registry/cartoes" || path === "/registry/credit-cards" || path === "/registry/creditcards") return "creditCards";
    if (path === "/registry/beneficiarios" || path === "/registry/beneficiaries") return "beneficiaries";
    if (path === "/registry/categorias" || path === "/registry/categories") return "categories";
    if (path === "/registry/tags") return "tags";
    if (path === "/registry") return "registry";

    if (path === "/planning" || path === "/analises") return "planning";
    if (path === "/statement" || path === "/fatura") return "statement";
    if (path === "/wishlist") return "wishlist";
    if (path === "/settings" || path === "/configuracoes") return "settings";

    return "home";
}

export function PageProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPage = useMemo(() => getPageFromPathname(location.pathname), [location.pathname]);
    const pendingNavigationRef = useRef<PageNavigationIntent | null>(null);

    const goToPage = useCallback((page: AppPage, intent?: PageNavigationIntent) => {
        pendingNavigationRef.current = intent && intent.page === page ? intent : null;
        navigate(getPathForPage(page, intent));
    }, [navigate]);

    const setCurrentPage = useCallback<React.Dispatch<React.SetStateAction<AppPage>>>(
        (nextPageAction) => {
            const nextPage = typeof nextPageAction === "function" ? nextPageAction(currentPage) : nextPageAction;
            pendingNavigationRef.current = null;
            navigate(getPathForPage(nextPage));
        },
        [currentPage, navigate],
    );

    const consumePendingNavigation = useCallback(() => {
        const pendingNavigation = pendingNavigationRef.current;
        pendingNavigationRef.current = null;
        return pendingNavigation;
    }, []);

    const value = useMemo<PageContextType>(
        () => ({
            currentPage,
            setCurrentPage,
            goToPage,
            consumePendingNavigation,
        }),
        [consumePendingNavigation, currentPage, goToPage, setCurrentPage],
    );

    return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePage() {
    const context = useContext(PageContext);
    if (!context) {
        throw new Error("usePage must be used within a PageProvider");
    }
    return context;
}
