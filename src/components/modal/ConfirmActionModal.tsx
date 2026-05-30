import { useState } from "react";
import { useModal } from "../../context/ModalContext";
import { ModalStructure } from "./ModalStructure";

interface ConfirmActionModalProps {
    title: string;
    description: string;
    consequences?: string[];
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "danger" | "success";
    onConfirm: () => Promise<void> | void;
}

const CONFIRM_TONE_CLASS: Record<NonNullable<ConfirmActionModalProps["tone"]>, string> = {
    danger: "border-red-400/40 bg-red-500/15 text-red-100 hover:border-red-400/60 hover:bg-red-500/20",
    success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/55 hover:bg-emerald-500/20",
};

export function ConfirmActionModal({
    title,
    description,
    consequences,
    confirmLabel,
    cancelLabel = "Cancelar",
    tone = "danger",
    onConfirm,
}: ConfirmActionModalProps) {
    const { closeModal } = useModal();
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        try {
            await onConfirm();
            closeModal();
        } catch (error) {
            console.error("Failed to confirm modal action:", error);
            setSubmitting(false);
        }
    };

    return (
        <ModalStructure height="auto" width="420px">
            <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-5 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <p className="text-sm leading-6 text-white/65">{description}</p>
                    {consequences && consequences.length > 0 ? (
                        <ul className="space-y-2 pt-1 text-sm leading-6 text-white/72">
                            {consequences.map((item) => (
                                <li key={item} className="flex gap-2">
                                    <span className="pt-2 text-white/35">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={submitting}
                        className="inline-flex min-w-24 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={submitting}
                        className={`inline-flex min-w-32 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${CONFIRM_TONE_CLASS[tone]}`}
                    >
                        {submitting ? "Processando..." : confirmLabel}
                    </button>
                </div>
            </div>
        </ModalStructure>
    );
}
