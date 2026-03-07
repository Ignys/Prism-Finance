import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type AppPage = "home" | "spending" | "income" | "balance" | "statement";

interface PageContextType {
    currentPage: AppPage;
    setCurrentPage: React.Dispatch<React.SetStateAction<AppPage>>;
    goToPage: (page: AppPage) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
    const [currentPage, setCurrentPage] = useState<AppPage>("home");

    const value = useMemo<PageContextType>(
        () => ({
            currentPage,
            setCurrentPage,
            goToPage: (page: AppPage) => setCurrentPage(page),
        }),
        [currentPage],
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
