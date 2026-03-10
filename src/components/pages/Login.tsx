import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { LoadingPage } from "./Loading";
import { auth } from "../../firebase/firebaseClient";
import { useFinanceSession } from "../../context/FinanceContext";

const googleProvider = new GoogleAuthProvider();

function resolveAuthErrorMessage(error: unknown): string {
    if (!error || typeof error !== "object" || !("code" in error)) {
        return "Nao foi possivel concluir a autenticacao. Tente novamente.";
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string") {
        return "Nao foi possivel concluir a autenticacao. Tente novamente.";
    }

    const errorByCode: Record<string, string> = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "Digite um e-mail valido.",
        "auth/missing-password": "Digite sua senha.",
        "auth/wrong-password": "E-mail ou senha incorretos.",
        "auth/user-not-found": "Nenhuma conta encontrada para esse e-mail.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        "auth/email-already-in-use": "Ja existe uma conta com esse e-mail.",
        "auth/weak-password": "A senha precisa ter no minimo 6 caracteres.",
        "auth/popup-closed-by-user": "O login com Google foi cancelado.",
        "auth/popup-blocked": "Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente.",
        "auth/account-exists-with-different-credential": "Ja existe conta com este e-mail em outro metodo de login.",
    };

    return errorByCode[code] ?? "Nao foi possivel concluir a autenticacao. Tente novamente.";
}

export function LoginPage() {
    const { loading } = useFinanceSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSignUpMode, setIsSignUpMode] = useState(false);
    const [error, setError] = useState("");
    const [authActionLoading, setAuthActionLoading] = useState<"email" | "google" | null>(null);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("Digite um e-mail valido.");
            return;
        }

        if (!password.trim()) {
            setError("Digite sua senha.");
            return;
        }

        if (isSignUpMode) {
            if (password.length < 6) {
                setError("A senha precisa ter no minimo 6 caracteres.");
                return;
            }

            if (password !== confirmPassword) {
                setError("As senhas nao conferem.");
                return;
            }
        }

        setAuthActionLoading("email");

        try {
            if (isSignUpMode) {
                await createUserWithEmailAndPassword(auth, email.trim(), password);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
        } catch (err) {
            console.error(err);
            setError(resolveAuthErrorMessage(err));
        } finally {
            setAuthActionLoading(null);
        }
    };

    const handleGoogleLogin = async () => {
        setError("");
        setAuthActionLoading("google");

        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error(err);
            setError(resolveAuthErrorMessage(err));
        } finally {
            setAuthActionLoading(null);
        }
    };

    const isLoading = authActionLoading !== null;

    const handleModeChange = (nextModeIsSignUp: boolean) => {
        setError("");
        setIsSignUpMode(nextModeIsSignUp);
        setPassword("");
        setConfirmPassword("");
    };

    if (loading) return <LoadingPage />;

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#070b12] px-4 py-8 text-white sm:px-6 lg:px-8">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.22),transparent_35%)]"
            />

            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center">
                <section className="grid overflow-hidden rounded-3xl border border-white/10 bg-[#0e1320]/80 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
                    <div className="relative hidden flex-col justify-between border-r border-white/10 bg-[linear-gradient(160deg,#0a1428_0%,#12263f_65%,#1b3f63_100%)] p-10 lg:flex">
                        <div>
                            <img src={"pngFinal.png"} alt="Logo Prism Finance" className="mb-8 w-24" />
                            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">Painel financeiro pessoal</p>
                            <h1 className="mt-5 max-w-sm text-4xl font-semibold leading-tight text-white">Controle suas financas sem complicacao.</h1>
                            <p className="mt-4 max-w-md text-sm leading-relaxed text-cyan-100/90">
                                Acompanhe saldo, gastos e metas em um fluxo simples: entre, organize e mantenha seus dados sincronizados em qualquer dispositivo.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-black/20 p-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/80">Fluxo rapido</p>
                            <ul className="mt-3 space-y-2 text-sm text-white/90">
                                <li>1. Conecte sua conta</li>
                                <li>2. Registre receitas e despesas</li>
                                <li>3. Veja sua evolucao em tempo real</li>
                            </ul>
                        </div>
                    </div>

                    <div className="p-6 sm:p-9 lg:p-10">
                        <div className="mx-auto w-full max-w-md">
                            <div className="mb-7 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold">{isSignUpMode ? "Criar conta" : "Entrar no Prism"}</h2>
                                    <p className="mt-1 text-sm text-slate-300">{isSignUpMode ? "Use e-mail e senha para comecar." : "Acesse sua conta para continuar."}</p>
                                </div>
                                <img src={"pngFinal.png"} alt="Logo Prism Finance" className="w-12 lg:hidden" />
                            </div>

                            <div className="mb-6 grid grid-cols-2 rounded-xl bg-white/5 p-1 text-sm">
                                <button
                                    type="button"
                                    onClick={() => handleModeChange(false)}
                                    disabled={isLoading}
                                    className={`rounded-lg px-3 py-2 transition-colors ${!isSignUpMode ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300 hover:text-white"}`}
                                >
                                    Entrar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange(true)}
                                    disabled={isLoading}
                                    className={`rounded-lg px-3 py-2 transition-colors ${isSignUpMode ? "bg-emerald-500/20 text-emerald-100" : "text-slate-300 hover:text-white"}`}
                                >
                                    Criar conta
                                </button>
                            </div>

                            <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
                                <label className="text-sm text-slate-200">
                                    E-mail
                                    <input
                                        type="email"
                                        placeholder="voce@exemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        required
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f1a] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/70"
                                    />
                                </label>

                                <label className="text-sm text-slate-200">
                                    Senha
                                    <input
                                        type="password"
                                        placeholder={isSignUpMode ? "Minimo 6 caracteres" : "Sua senha"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete={isSignUpMode ? "new-password" : "current-password"}
                                        required
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f1a] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/70"
                                    />
                                </label>

                                {isSignUpMode && (
                                    <label className="text-sm text-slate-200">
                                        Confirmar senha
                                        <input
                                            type="password"
                                            placeholder="Repita sua senha"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            autoComplete="new-password"
                                            required
                                            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a0f1a] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/70"
                                        />
                                    </label>
                                )}

                                {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="mt-1 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {authActionLoading === "email" ? (isSignUpMode ? "Criando conta..." : "Entrando...") : isSignUpMode ? "Criar conta" : "Entrar"}
                                </button>
                            </form>

                            <div className="my-5 flex items-center gap-3">
                                <span className="h-px flex-1 bg-white/10" />
                                <span className="text-xs uppercase tracking-[0.12em] text-slate-400">ou</span>
                                <span className="h-px flex-1 bg-white/10" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    <path d="M1 1h22v22H1z" fill="none" />
                                </svg>
                                {authActionLoading === "google" ? "Conectando..." : "Continuar com Google"}
                            </button>

                            <p className="mt-6 text-center text-sm text-slate-300">
                                {isSignUpMode ? "Ja possui conta?" : "Ainda nao tem conta?"}{" "}
                                <button
                                    type="button"
                                    onClick={() => handleModeChange(!isSignUpMode)}
                                    disabled={isLoading}
                                    className="font-semibold text-cyan-300 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSignUpMode ? "Entrar" : "Criar conta"}
                                </button>
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
