import { useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, MailCheck } from "lucide-react";
import { resolveSupabaseAuthErrorMessage } from "../../../supabase/auth/authErrorMessages";
import { resendSignUpConfirmation } from "../../../supabase/auth/authService";

interface ConfirmEmailPanelProps {
    email: string;
    onBack: () => void;
}

export function ConfirmEmailPanel({ email, onBack }: ConfirmEmailPanelProps) {
    const [resending, setResending] = useState(false);
    const [error, setError] = useState("");
    const [resent, setResent] = useState(false);

    const handleResend = async () => {
        setError("");
        setResent(false);
        setResending(true);
        try {
            await resendSignUpConfirmation(email);
            setResent(true);
        } catch (err) {
            console.error(err);
            setError(resolveSupabaseAuthErrorMessage(err, "Não foi possível reenviar o e-mail. Tente novamente em alguns minutos."));
        } finally {
            setResending(false);
        }
    };

    return (
        <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
                <MailCheck size={22} aria-hidden />
            </span>

            <h2 className="mt-6 text-[2rem] font-semibold leading-tight tracking-[-0.025em]">Confirme seu e-mail</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Enviamos um link de confirmação para <span className="break-all font-medium text-white">{email}</span>. Abra o e-mail e toque no link para ativar sua conta e entrar.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">Não chegou? Confira a caixa de spam ou reenvie o link.</p>

            <div className="mt-8 flex flex-col gap-3">
                {error && (
                    <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                        <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-red-400" />
                        {error}
                    </p>
                )}
                {resent && (
                    <p role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-sm text-emerald-100">
                        <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
                        Link reenviado. Pode levar alguns minutos.
                    </p>
                )}

                <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resending}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#111111] px-4 py-3 text-sm font-medium text-neutral-100 transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {resending && <LoaderCircle size={16} aria-hidden className="animate-spin" />}
                    {resending ? "Reenviando..." : "Reenviar link"}
                </button>
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-neutral-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                    Já confirmei, entrar
                </button>
            </div>
        </div>
    );
}
