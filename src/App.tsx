import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthShell } from "./components/layout/AuthShell";
import { LoadingPage, PageSkeletonScreen } from "./components/pages/Loading";
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
        <BrowserRouter>
            <FinanceProvider>
                <PageProvider>
                    <ModalProvider>
                        <MainApp />
                    </ModalProvider>
                </PageProvider>
            </FinanceProvider>
        </BrowserRouter>
    );
}

function MainApp() {
    const { user, loading } = useFinanceSession();
    const { currentPage } = usePage();

    if (loading) return <LoadingPage />;

    if (!user) {
        return (
            <Suspense fallback={<LoadingPage />}>
                <LoginPage />
            </Suspense>
        );
    }

    return (
        <AuthShell mainClassName={currentPage === "home" ? "text-center text-white" : "text-white"}>
            <Suspense fallback={<PageSkeletonScreen page={currentPage} />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/transactions/receitas" element={<TransactionsPage />} />
                    <Route path="/transactions/income" element={<TransactionsPage />} />
                    <Route path="/transactions/despesas" element={<TransactionsPage />} />
                    <Route path="/transactions/spending" element={<TransactionsPage />} />
                    <Route path="/transactions/transferencias" element={<TransactionsPage />} />
                    <Route path="/transactions/transfer" element={<TransactionsPage />} />
                    <Route path="/transactions/transfers" element={<TransactionsPage />} />
                    <Route path="/statement" element={<StatementPage />} />
                    <Route path="/fatura" element={<StatementPage />} />
                    <Route path="/planning" element={<PlanningPage />} />
                    <Route path="/analises" element={<PlanningPage />} />
                    <Route path="/wishlist" element={<WishlistPage />} />
                    <Route path="/registry" element={<RegistryPage />} />
                    <Route path="/registry/carteiras" element={<RegistryPage />} />
                    <Route path="/registry/wallets" element={<RegistryPage />} />
                    <Route path="/registry/cartoes" element={<RegistryPage />} />
                    <Route path="/registry/credit-cards" element={<RegistryPage />} />
                    <Route path="/registry/creditcards" element={<RegistryPage />} />
                    <Route path="/registry/categorias" element={<RegistryPage />} />
                    <Route path="/registry/categories" element={<RegistryPage />} />
                    <Route path="/registry/beneficiarios" element={<RegistryPage />} />
                    <Route path="/registry/beneficiaries" element={<RegistryPage />} />
                    <Route path="/registry/tags" element={<RegistryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/configuracoes" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
            </Suspense>
        </AuthShell>
    );
}

export default App;
