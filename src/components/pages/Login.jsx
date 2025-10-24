import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "/src/firebase/firebaseClient.js";
import prismLogo from "/src/assets/pngFinal.png";
import { useFinance } from "/src/context/FinanceContext";
import { LoadingPage } from "./Loading";

export function LoginPage() {
    const { loading } = useFinance(); // 🔹 pega o loading global
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [localLoading, setLocalLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLocalLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // o FinanceProvider vai cuidar do redirecionamento
        } catch (err) {
            console.error(err);
            setError("E-mail ou senha incorretos.");
        }

        setLocalLoading(false);
    };

    // 🔹 mostra o loader se o contexto ainda estiver carregando
    if (loading) return <LoadingPage />;

    return (
        <div className="flex items-center justify-center p-20 bg-[#0f0f0f] text-white h-screen">
            <form onSubmit={handleLogin} className="bg-[#1e1e1e] p-10 rounded-2xl flex flex-col gap-5 w-[350px]">
                <img src={prismLogo} alt="Logo" className="w-24 mx-auto mb-3" />
                <h1 className="text-2xl font-semibold text-center mb-5">Prism Finance</h1>
                <input
                    type="email"
                    placeholder="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="p-3 bg-neutral-900 rounded-lg outline-none"
                />
                <input
                    type="password"
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="p-3 bg-neutral-900 rounded-lg outline-none"
                />

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                <button
                    type="submit"
                    disabled={localLoading}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                >
                    {localLoading ? "Entrando..." : "Entrar"}
                </button>
            </form>
        </div>
    );
}
