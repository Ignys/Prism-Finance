import "./App.css";
import { ModalProvider } from "./context/ModalContext";
import { LoadingPage } from "./components/pages/Loading";
import { LoginPage } from "./components/pages/Login";
import { HomePage } from "./components/pages/Home";
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { IncomePage } from "./components/pages/Income";
import { SpendingPage } from "./components/pages/Spending";

function App() {
    return (
        <BrowserRouter>
            <FinanceProvider>
                <ModalProvider>
                    <MainApp />
                </ModalProvider>
            </FinanceProvider>
        </BrowserRouter>
    );
}

function MainApp() {
    const { user, loading } = useFinance();

    if (loading) return <LoadingPage />;
    if (!user) return <LoginPage />;

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={user ? <Navigate to="/home" /> : <Navigate to="/login" />} />
            <Route path="/home" element={user ? <HomePage /> : <Navigate to="/login" />} />
            <Route path="/spending" element={user ? <SpendingPage /> : <Navigate to="/login" />} />
            <Route path="/income" element={user ? <IncomePage /> : <Navigate to="/login" />} />
        </Routes>
    );
}

export default App;
