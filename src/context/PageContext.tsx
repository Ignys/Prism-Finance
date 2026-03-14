import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

export type AppPage = "home" | "spending" | "income" | "balance" | "beneficiaries" | "categories" | "tags" | "statement" | "transactions" | "registry";
export type TransactionsIntentTab = "income" | "spending" | "transfer";
export type PageNavigationIntent =
    | {
          page: "transactions";
          tab: TransactionsIntentTab;
      }
    | {
          page: "statement";
          selectedCardId: string;
          selectedMonth: string;
      };

interface PageContextType {
    currentPage: AppPage;
    setCurrentPage: React.Dispatch<React.SetStateAction<AppPage>>;
    goToPage: (page: AppPage, intent?: PageNavigationIntent) => void;
    consumePendingNavigation: () => PageNavigationIntent | null;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
    const [currentPage, setCurrentPage] = useState<AppPage>("home");
    const pendingNavigationRef = useRef<PageNavigationIntent | null>(null);

    const goToPage = useCallback((page: AppPage, intent?: PageNavigationIntent) => {
        setCurrentPage(page);
        pendingNavigationRef.current = intent && intent.page === page ? intent : null;
    }, []);

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
        [consumePendingNavigation, currentPage, goToPage],
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
