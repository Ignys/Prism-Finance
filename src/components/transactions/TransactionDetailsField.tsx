import { Download, FileText, LoaderCircle, NotebookPen, Paperclip, Plus, X } from "lucide-react";
import type { TransactionAttachment } from "../../types/transactionDetails";
import { FIELD_EMBEDDED_INPUT_CLASS, FIELD_ICON_CONTROL_CLASS } from "./transactionForm.constants";
import { TransactionFieldIcon } from "./TransactionFieldIcon";
import type { TransactionDetailsController } from "./useTransactionDetails";

interface TransactionDetailsFieldProps {
    details: TransactionDetailsController;
    disabled?: boolean;
}

function formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }
    if (sizeBytes < 1024 * 1024) {
        return `${Math.round(sizeBytes / 1024)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ attachment, onDownload, onRemove, disabled }: { attachment: TransactionAttachment; onDownload: () => void; onRemove: () => void; disabled: boolean }) {
    return (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/[0.08] text-emerald-100/75">
                <FileText size={15} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white/82">{attachment.fileName}</p>
                <p className="text-[10px] text-white/38">{formatFileSize(attachment.sizeBytes)}</p>
            </div>
            <button type="button" onClick={onDownload} disabled={disabled} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40" aria-label={`Baixar ${attachment.fileName}`}>
                <Download size={13} />
            </button>
            <button type="button" onClick={onRemove} disabled={disabled} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40" aria-label={`Remover ${attachment.fileName}`}>
                <X size={13} />
            </button>
        </div>
    );
}

export function TransactionDetailsField({ details, disabled = false }: TransactionDetailsFieldProps) {
    const controlsDisabled = disabled || details.loading || details.disabled;

    return (
        <div className="grid gap-2 md:grid-cols-2">
            <div>
                <label className={`${FIELD_ICON_CONTROL_CLASS} flex min-h-32 items-start gap-2`}>
                    <TransactionFieldIcon icon={NotebookPen} className="mt-0.5 text-violet-200/75" />
                    <textarea
                        aria-label="Anotação"
                        value={details.annotation}
                        onChange={(event) => details.setAnnotation(event.target.value)}
                        disabled={controlsDisabled}
                        maxLength={2000}
                        placeholder="Adicione contexto, observações ou detalhes"
                        className={`${FIELD_EMBEDDED_INPUT_CLASS} min-h-[108px] resize-none leading-6`}
                    />
                </label>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-black/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span title="Anexos" aria-label="Anexos">
                        <TransactionFieldIcon icon={Paperclip} className="text-emerald-100/70" />
                    </span>
                    <span className="text-[10px] text-white/32">{details.attachments.length + details.stagedFiles.length}/5 · 10 MB cada</span>
                </div>

                <div className="elegant-scrollbar max-h-28 space-y-1.5 overflow-y-auto pr-1">
                    {details.loading ? (
                        <div className="flex h-16 items-center justify-center text-white/38"><LoaderCircle size={17} className="animate-spin" /></div>
                    ) : (
                        <>
                            {details.attachments.map((attachment) => (
                                <AttachmentRow
                                    key={attachment.id}
                                    attachment={attachment}
                                    onDownload={() => void details.downloadAttachment(attachment)}
                                    onRemove={() => details.removeAttachment(attachment)}
                                    disabled={controlsDisabled}
                                />
                            ))}
                            {details.stagedFiles.map((file, index) => (
                                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-300/15 bg-emerald-400/[0.035] px-2.5 py-2">
                                    <FileText size={14} className="shrink-0 text-emerald-100/62" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs text-white/78">{file.name}</p>
                                        <p className="text-[10px] text-emerald-100/42">Novo · {formatFileSize(file.size)}</p>
                                    </div>
                                    <button type="button" onClick={() => details.removeStagedFile(file)} disabled={controlsDisabled} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/45 hover:bg-red-500/10 hover:text-red-200" aria-label={`Remover ${file.name}`}>
                                        <X size={13} />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <label className={`mt-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.025] text-xs text-white/55 transition-colors hover:border-emerald-300/25 hover:bg-emerald-400/[0.04] hover:text-emerald-50 ${controlsDisabled ? "pointer-events-none opacity-45" : ""}`}>
                    <Plus size={14} />
                    Adicionar arquivo
                    <input
                        type="file"
                        multiple
                        className="sr-only"
                        disabled={controlsDisabled}
                        onChange={(event) => {
                            details.addFiles(Array.from(event.target.files ?? []));
                            event.target.value = "";
                        }}
                    />
                </label>
                {details.disabled ? <p className="mt-2 text-[10px] text-amber-100/55">Disponível para usuários conectados.</p> : null}
                {details.error ? <p className="mt-2 text-[10px] leading-4 text-red-200/75">{details.error}</p> : null}
            </div>
        </div>
    );
}
