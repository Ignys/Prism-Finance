import "./App.css";
import { ModalProvider } from "./context/ModalContext";
import { LoadingPage } from "./components/pages/Loading";
import { LoginPage } from "./components/pages/Login";
import { HomePage } from "./components/pages/Home";
import { FinanceProvider, useFinanceSession } from "./context/FinanceContext";
import { IncomePage } from "./components/pages/Income";
import { SpendingPage } from "./components/pages/Spending";
import { BalancePage } from "./components/pages/Balance";
import { PageProvider, usePage } from "./context/PageContext";
import "./lib/chart";
import { useEffect } from "react";


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
    if (!user) return <LoginPage />;

    if (currentPage === "spending") return <SpendingPage />;
    if (currentPage === "income") return <IncomePage />;
    if (currentPage === "balance") return <BalancePage />;

    return <HomePage />;
}

export default App;
