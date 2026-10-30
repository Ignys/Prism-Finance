import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useModal } from "../../context/ModalContext";

// Moldura visual compartilhada pelos modais (mesmo padrão do formulário de transação).

export function ModalPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#131313] p-4 text-white shadow-[0_26px_70px_-38px_rgba(0,0,0,0.95)] ${className}`.trim()}>
            {children}
        </div>
    );
}

interface ModalHeaderProps {
    title: string;
    children?: ReactNode;
    disabled?: boolean;
}

export function ModalHeader({ title, children, disabled = false }: ModalHeaderProps) {
    const { closeModal } = useModal();

    return (
        <header className="flex shrink-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
                <h2 className="ml-1 truncate text-sm uppercase opacity-50">{title}</h2>
                {children}
            </div>
            <button
                type="button"
                onClick={closeModal}
                disabled={disabled}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                aria-label="Fechar modal"
                title="Fechar"
            >
                <X size={15} />
            </button>
        </header>
    );
}

export function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`elegant-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-1 ${className}`.trim()}>{children}</div>;
}

export function ModalError({ children }: { children: ReactNode }) {
    return <p role="alert" className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">{children}</p>;
}

/** `start` recebe ações secundárias (arquivar, excluir…); `children` ficam à direita. */
export function ModalFooter({ start, children }: { start?: ReactNode; children: ReactNode }) {
    return (
        <footer className="mt-4 flex shrink-0 flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-1">{start}</div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">{children}</div>
        </footer>
    );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const BASE_BUTTON_CLASS = "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function ModalCancelButton({ children = "Cancelar", className = "", ...props }: ButtonProps) {
    const { closeModal } = useModal();
    return (
        <button type="button" onClick={closeModal} {...props} className={`${BASE_BUTTON_CLASS} min-w-24 border-white/[0.12] bg-white/[0.03] font-medium text-white/70 hover:border-white/[0.2] hover:text-white ${className}`}>
            {children}
        </button>
    );
}

export function ModalPrimaryButton({ className = "", ...props }: ButtonProps) {
    return <button type="button" {...props} className={`${BASE_BUTTON_CLASS} min-w-28 border-emerald-300/35 bg-emerald-400/[0.14] font-semibold text-emerald-50 hover:border-emerald-300/55 hover:bg-emerald-400/[0.2] ${className}`} />;
}

/** Ação secundária do rodapé (lado esquerdo), no mesmo estilo dos botões Excluir/Duplicar da transação. */
export function ModalFooterAction({ tone = "neutral", className = "", ...props }: ButtonProps & { tone?: "neutral" | "danger" }) {
    const toneClass = tone === "danger" ? "border-red-400/25 text-red-200/80 hover:border-red-400/45 hover:text-red-100" : "border-white/[0.12] text-white/62 hover:border-white/[0.28] hover:text-white";
    return <button type="button" {...props} className={`inline-flex items-center justify-center gap-1 rounded-lg border bg-white/[0.03] px-2 py-2 text-[11px] uppercase tracking-[0.04em] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${toneClass} ${className}`} />;
}
