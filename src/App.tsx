import { Suspense, lazy, useEffect } from "react";
import { LoadingPage } from "./components/pages/Loading";
import { FinanceProvider, useFinanceSession } from "./context/FinanceContext";
import { ModalProvider } from "./context/ModalContext";
import { PageProvider, usePage } from "./context/PageContext";
import "./lib/chart";

const LoginPage = lazy(() => import("./components/pages/Login").then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(() => import("./components/pages/Home").then((module) => ({ default: module.HomePage })));
const PlanningPage = lazy(() => import("./components/pages/Analysis").then((module) => ({ default: module.PlanningPage })));
const StatementPage = lazy(() => import("./components/pages/Statement").then((module) => ({ default: module.StatementPage })));
const RegistryPage = lazy(() => import("./components/pages/Registry").then((module) => ({ default: module.RegistryPage })));
const SettingsPage = lazy(() => import("./components/pages/Settings").then((module) => ({ default: module.SettingsPage })));
const TransactionsPage = lazy(() => import("./components/pages/TransactionsPage").then((module) => ({ default: module.TransactionsPage })));
const WishlistPage = lazy(() => import("./components/pages/Wishlist").then((module) => ({ default: module.WishlistPage })));

function App() {
    return (
        <FinanceProvider>
            <PageProvider>
                <ModalProvider>
                    <MainApp />
                </ModalProvider>
            </PageProvider>
        </FinanceProvider>
    );
}

function MainApp() {
    const { user, loading } = useFinanceSession();
    const { currentPage, setCurrentPage } = usePage();

    useEffect(() => {
        if (user) {
            setCurrentPage("home");
        }
    }, [user, setCurrentPage]);

    if (loading) return <LoadingPage />;

    if (!user) {
        return (
            <Suspense fallback={<LoadingPage />}>
                <LoginPage />
            </Suspense>
        );
    }

    let page = <HomePage />;

    if (currentPage === "transactions") page = <TransactionsPage />;
    if (currentPage === "planning") page = <PlanningPage />;
    if (currentPage === "statement") page = <StatementPage />;
    if (currentPage === "wishlist") page = <WishlistPage />;
    if (currentPage === "settings") page = <SettingsPage />;
    if (currentPage === "registry" || currentPage === "wallets" || currentPage === "creditCards" || currentPage === "beneficiaries" || currentPage === "categories" || currentPage === "tags") {
        page = <RegistryPage />;
    }

    return <Suspense fallback={<LoadingPage />}>{page}</Suspense>;
}

export default App;
