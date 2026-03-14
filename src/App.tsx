import { Suspense, lazy, useEffect } from "react";
import "./App.css";
import { LoadingPage } from "./components/pages/Loading";
import { FinanceProvider, useFinanceSession } from "./context/FinanceContext";
import { ModalProvider } from "./context/ModalContext";
import { PageProvider, usePage } from "./context/PageContext";
import "./lib/chart";

const LoginPage = lazy(() => import("./components/pages/Login").then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(() => import("./components/pages/Home").then((module) => ({ default: module.HomePage })));
const BalancePage = lazy(() => import("./components/pages/Balance").then((module) => ({ default: module.BalancePage })));
const StatementPage = lazy(() => import("./components/pages/Statement").then((module) => ({ default: module.StatementPage })));
const RegistryPage = lazy(() => import("./components/pages/Registry").then((module) => ({ default: module.RegistryPage })));
const TransactionsPage = lazy(() => import("./components/pages/TransactionsPage").then((module) => ({ default: module.TransactionsPage })));

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
    if (currentPage === "balance") page = <BalancePage />;
    if (currentPage === "statement") page = <StatementPage />;
    if (currentPage === "registry" || currentPage === "beneficiaries" || currentPage === "categories" || currentPage === "tags") page = <RegistryPage />;

    return <Suspense fallback={<LoadingPage />}>{page}</Suspense>;
}

export default App;
