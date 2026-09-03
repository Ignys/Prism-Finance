import { useEffect, useMemo, useState } from "react";
import { createTransactionAttachmentDownloadUrl, loadTransactionDetails, saveTransactionDetails } from "../../supabase/finance/transactionDetailsService";
import type { TransactionAttachment } from "../../types/transactionDetails";

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

interface UseTransactionDetailsOptions {
    transactionId: string;
    userId: string | null | undefined;
    loadExisting: boolean;
}

export interface TransactionDetailsController {
    annotation: string;
    attachments: TransactionAttachment[];
    stagedFiles: File[];
    loading: boolean;
    error: string;
    disabled: boolean;
    setAnnotation: (value: string) => void;
    addFiles: (files: File[]) => void;
    removeStagedFile: (file: File) => void;
    removeAttachment: (attachment: TransactionAttachment) => void;
    downloadAttachment: (attachment: TransactionAttachment) => Promise<void>;
    commit: () => Promise<void>;
}

function formatLoadError(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Não foi possível carregar os detalhes da transação.";
}

export function useTransactionDetails({ transactionId, userId, loadExisting }: UseTransactionDetailsOptions): TransactionDetailsController {
    const [annotation, setAnnotation] = useState("");
    const [initialAnnotation, setInitialAnnotation] = useState("");
    const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [attachmentsToRemove, setAttachmentsToRemove] = useState<TransactionAttachment[]>([]);
    const [loading, setLoading] = useState(loadExisting);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setAnnotation("");
        setInitialAnnotation("");
        setAttachments([]);
        setStagedFiles([]);
        setAttachmentsToRemove([]);
        setError("");

        if (!loadExisting || !userId) {
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setLoading(true);
        void loadTransactionDetails(userId, transactionId)
            .then((details) => {
                if (cancelled) {
                    return;
                }
                setAnnotation(details.annotation);
                setInitialAnnotation(details.annotation);
                setAttachments(details.attachments);
            })
            .catch((loadError: unknown) => {
                if (!cancelled) {
                    setError(formatLoadError(loadError));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [loadExisting, transactionId, userId]);

    const visibleAttachmentCount = useMemo(() => attachments.length + stagedFiles.length, [attachments.length, stagedFiles.length]);

    const addFiles = (files: File[]) => {
        setError("");
        const availableSlots = Math.max(0, MAX_ATTACHMENT_COUNT - visibleAttachmentCount);
        if (availableSlots < 1) {
            setError(`Você pode adicionar até ${MAX_ATTACHMENT_COUNT} anexos por transação.`);
            return;
        }

        const acceptedFiles = files.slice(0, availableSlots);
        const oversizedFile = acceptedFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
        if (oversizedFile) {
            setError(`O arquivo “${oversizedFile.name}” ultrapassa o limite de 10 MB.`);
            return;
        }

        setStagedFiles((current) => [...current, ...acceptedFiles]);
        if (files.length > availableSlots) {
            setError(`Apenas ${availableSlots} arquivo(s) foram adicionados para respeitar o limite de ${MAX_ATTACHMENT_COUNT}.`);
        }
    };

    const removeStagedFile = (file: File) => {
        setStagedFiles((current) => current.filter((item) => item !== file));
        setError("");
    };

    const removePersistedAttachment = (attachment: TransactionAttachment) => {
        setAttachments((current) => current.filter((item) => item.id !== attachment.id));
        setAttachmentsToRemove((current) => (current.some((item) => item.id === attachment.id) ? current : [...current, attachment]));
        setError("");
    };

    const downloadAttachment = async (attachment: TransactionAttachment) => {
        try {
            setError("");
            const downloadUrl = await createTransactionAttachmentDownloadUrl(attachment.storagePath);
            window.open(downloadUrl, "_blank", "noopener,noreferrer");
        } catch (downloadError) {
            setError(formatLoadError(downloadError));
        }
    };

    const commit = async () => {
        const annotationChanged = annotation.trim() !== initialAnnotation.trim();
        if (!annotationChanged && stagedFiles.length === 0 && attachmentsToRemove.length === 0) {
            return;
        }

        if (!userId) {
            if (annotation.trim() || stagedFiles.length > 0 || attachmentsToRemove.length > 0) {
                throw new Error("Faça login para salvar anotações e anexos.");
            }
            return;
        }

        const details = await saveTransactionDetails({
            userId,
            transactionId,
            annotation,
            files: stagedFiles,
            attachmentsToRemove,
        });
        setAnnotation(details.annotation);
        setInitialAnnotation(details.annotation);
        setAttachments(details.attachments);
        setStagedFiles([]);
        setAttachmentsToRemove([]);
        setError("");
    };

    return {
        annotation,
        attachments,
        stagedFiles,
        loading,
        error,
        disabled: !userId,
        setAnnotation,
        addFiles,
        removeStagedFile,
        removeAttachment: removePersistedAttachment,
        downloadAttachment,
        commit,
    };
}
