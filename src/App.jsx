// src/App.jsx
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import "./App.css";
import { useEffect } from "react";
import { format } from "date-fns";
import { CircleUserRound } from "lucide-react";
import { LoginPage } from "./components/pages/Login";
import { HomePage } from "./components/pages/Home";
import { LoadingPage } from "./components/pages/Loading";
import { ModalProvider } from "./context/ModalContext";

function App() {
    return (
        <FinanceProvider>
            <ModalProvider>
                <MainApp />
            </ModalProvider>
        </FinanceProvider>
    );
}

function MainApp() {
    const { user, loading, } = useFinance();

    if (loading) return <LoadingPage />;
    if (!user) return <LoginPage />;

    return (
        <HomePage />
    );
}

export default App;
