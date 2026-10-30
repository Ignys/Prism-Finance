import { useState } from "react";
import { LoadingPage } from "./Loading";
import { useFinanceSession } from "../../context/FinanceContext";
import { resolveSupabaseAuthErrorMessage } from "../../supabase/auth/authErrorMessages";
import { sendSupabasePasswordReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from "../../supabase/auth/authService";
import { ArrowLeft, CircleAlert, CircleCheck, Eye, EyeOff, Hexagon, LoaderCircle, Lock, Mail, ShieldCheck } from "lucide-react";
import { LoginShowcase } from "./login/LoginShowcase";
import { ConfirmEmailPanel } from "./login/ConfirmEmailPanel";

function GoogleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

function PrismMark() {
    return (
        <div className="relative flex items-center gap-2 font-medium text-white">
            <Hexagon size={25} />
            <span className="uppercase">Prism</span>
        </div>
    );
}

const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-[#111111] py-3 pl-10 pr-3.5 text-[15px] text-white placeholder:text-neutral-600 outline-none transition hover:border-white/[0.14] focus:border-white/30 focus-visible:ring-4 focus-visible:ring-white/[0.06]";

export function LoginPage() {
    const { loading } = useFinanceSession();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSignUpMode, setIsSignUpMode] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [authActionLoading, setAuthActionLoading] = useState<"email" | "google" | null>(null);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

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
                const needsConfirmation = await signUpWithEmail(email.trim(), password);
                if (needsConfirmation) {
                    setPendingConfirmationEmail(email.trim());
                    setPassword("");
                    setConfirmPassword("");
                }
            } else {
                await signInWithEmail(email.trim(), password);
            }
        } catch (err) {
            console.error(err);
            setError(resolveSupabaseAuthErrorMessage(err, "Nao foi possivel concluir a autenticacao. Tente novamente."));
        } finally {
            setAuthActionLoading(null);
        }
    };

    const handleGoogleLogin = async () => {
        setError("");
        setSuccess("");
        setAuthActionLoading("google");

        try {
            await signInWithGoogle();
        } catch (err) {
            console.error(err);
            setError(resolveSupabaseAuthErrorMessage(err, "Nao foi possivel concluir a autenticacao. Tente novamente."));
        } finally {
            setAuthActionLoading(null);
        }
    };

    const isLoading = authActionLoading !== null;

    const handleModeChange = (nextModeIsSignUp: boolean) => {
        setError("");
        setSuccess("");
        setIsSignUpMode(nextModeIsSignUp);
        setPassword("");
        setConfirmPassword("");
    };

    const handlePasswordReset = async () => {
        setError("");
        setSuccess("");

        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            setError("Digite seu e-mail para receber a redefinicao de senha.");
            return;
        }

        setAuthActionLoading("email");
        try {
            await sendSupabasePasswordReset(normalizedEmail);
            setSuccess("Enviamos um link de redefinicao para seu e-mail.");
        } catch (err) {
            console.error(err);
            setError(resolveSupabaseAuthErrorMessage(err, "Nao foi possivel enviar a redefinicao de senha."));
        } finally {
            setAuthActionLoading(null);
        }
    };

    if (loading) return <LoadingPage />;

    return (
        <div className="min-h-screen bg-[#0e0e10] text-white lg:grid lg:h-screen lg:grid-cols-[1.15fr_1fr] lg:overflow-hidden">
            <aside className="relative m-3 hidden flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#131316] lg:flex">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_80%_60%_at_70%_100%,black,transparent)]"
                />
                <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-[520px] w-[640px] rounded-full bg-emerald-400/[0.08] blur-[120px]" />

                <div className="relative px-12 pt-12">
                    <h1 className="max-w-lg text-[clamp(2rem,3vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.035em]">Saiba quanto sobra antes do mês acabar.</h1>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-neutral-400">Contas, cartões, parcelas e metas em um só lugar, sincronizados em todos os seus dispositivos.</p>
                </div>

                <LoginShowcase />
            </aside>

            <main className="relative flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-12">
                <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/[0.06] blur-[90px] lg:hidden" />

                <div className="relative">
                    <PrismMark />
                </div>

                <div className="relative mx-auto my-auto w-full max-w-sm py-10">
                    {pendingConfirmationEmail ? (
                        <ConfirmEmailPanel
                            email={pendingConfirmationEmail}
                            onBack={() => {
                                setPendingConfirmationEmail(null);
                                handleModeChange(false);
                            }}
                        />
                    ) : !showEmailForm ? (
                        <>
                            <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.025em]">Entre no Prism</h2>
                            <p className="mt-2 text-sm text-neutral-400">Primeira vez aqui? Sua conta é criada no mesmo passo.</p>

                            <div className="mt-8 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleGoogleLogin()}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#0e0e10] transition hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {authActionLoading === "google" ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : <GoogleIcon />}
                                    {authActionLoading === "google" ? "Conectando..." : "Continuar com Google"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError("");
                                        setShowEmailForm(true);
                                    }}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.1] bg-[#111111] px-4 py-3.5 text-sm font-medium text-neutral-100 transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <Mail size={18} aria-hidden className="text-neutral-400" />
                                    Continuar com e-mail
                                </button>
                            </div>

                            {error && (
                                <div className="mt-4">
                                    <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                                        <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-red-400" />
                                        {error}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    handleModeChange(false);
                                    setShowEmailForm(false);
                                }}
                                disabled={isLoading}
                                className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-neutral-400 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-60"
                            >
                                <ArrowLeft size={16} aria-hidden />
                                Outras formas de entrar
                            </button>
                            <div className="relative mb-8 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-[#111111] p-1 text-sm" role="tablist" aria-label="Modo de acesso">
                                <span
                                    aria-hidden
                                    className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white/[0.08] transition-transform duration-300 ease-out motion-reduce:transition-none ${isSignUpMode ? "translate-x-full" : ""}`}
                                />
                                {[false, true].map((signUp) => (
                                    <button
                                        key={String(signUp)}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSignUpMode === signUp}
                                        onClick={() => handleModeChange(signUp)}
                                        disabled={isLoading}
                                        className={`relative rounded-lg py-2 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/60 ${isSignUpMode === signUp ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                                    >
                                        {signUp ? "Criar conta" : "Entrar"}
                                    </button>
                                ))}
                            </div>

                            <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.025em]">{isSignUpMode ? "Comece a organizar seu mês" : "Bem-vindo de volta"}</h2>
                            <p className="mt-2 text-sm text-neutral-400">{isSignUpMode ? "Crie sua conta com e-mail e senha. Leva menos de um minuto." : "Entre para ver quanto sobra este mês."}</p>

                            <form onSubmit={handleEmailAuth} className="mt-8 flex flex-col gap-4">
                                <span className="relative block">
                                    <Mail size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                    <input
                                        type="email"
                                        autoFocus
                                        aria-label="E-mail"
                                        placeholder="E-mail"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        required
                                        className={inputClass}
                                    />
                                </span>

                                <div>
                                    <span className="relative block">
                                        <Lock size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            aria-label="Senha"
                                            placeholder={isSignUpMode ? "Senha (mínimo 6 caracteres)" : "Senha"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete={isSignUpMode ? "new-password" : "current-password"}
                                            required
                                            className={`${inputClass} pr-11`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((current) => !current)}
                                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400/60"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </span>
                                    {!isSignUpMode ? (
                                        <button
                                            type="button"
                                            onClick={() => void handlePasswordReset()}
                                            disabled={isLoading}
                                            className="ml-auto mt-2 block text-xs text-neutral-500 underline-offset-4 transition hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    ) : null}
                                </div>

                                {isSignUpMode && (
                                    <span className="relative block">
                                        <Lock size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            aria-label="Confirmar senha"
                                            placeholder="Confirmar senha"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            autoComplete="new-password"
                                            required
                                            className={inputClass}
                                        />
                                    </span>
                                )}

                                {error && (
                                    <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                                        <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-red-400" />
                                        {error}
                                    </p>
                                )}
                                {success && (
                                    <p role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-sm text-emerald-100">
                                        <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
                                        {success}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0e0e10] transition hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {authActionLoading === "email" && <LoaderCircle size={16} aria-hidden className="animate-spin" />}
                                    {authActionLoading === "email" ? (isSignUpMode ? "Criando conta..." : "Entrando...") : isSignUpMode ? "Criar conta" : "Entrar"}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="relative mx-auto flex items-center gap-2 text-xs text-neutral-500">
                    <ShieldCheck size={14} aria-hidden className="text-emerald-400/80" />
                    Seus dados ficam protegidos e sincronizados entre dispositivos.
                </p>
            </main>
        </div>
    );
}
