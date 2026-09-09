import type { TransactionAttachment, TransactionDetails } from "../../types/transactionDetails";
import { getSupabaseClient } from "../supabaseClient";
import { drainAttachmentDeletionQueue } from "./attachmentCleanupService";
import { createTransactionAttachmentId } from "./transactionAttachmentIdentity";

const ATTACHMENTS_BUCKET = "transaction-attachments";
const DETAILS_TABLE = "transaction_details";
const ATTACHMENTS_TABLE = "transaction_attachments";

interface TransactionDetailsRow {
    annotation: string | null;
}

interface TransactionAttachmentRow {
    id: string;
    transaction_id: string;
    file_name: string;
    storage_path: string;
    mime_type: string | null;
    size_bytes: number | string;
    created_at: string;
}

interface SaveTransactionDetailsParams {
    userId: string;
    transactionId: string;
    annotation: string;
    files: File[];
    attachmentsToRemove: TransactionAttachment[];
}

function sanitizeFileName(fileName: string): string {
    const normalized = fileName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const safeName = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return safeName.slice(0, 120) || "arquivo";
}

function fromAttachmentRow(row: TransactionAttachmentRow): TransactionAttachment {
    return {
        id: row.id,
        transactionId: row.transaction_id,
        fileName: row.file_name,
        storagePath: row.storage_path,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes) || 0,
        createdAt: row.created_at,
    };
}

async function waitForTransactionPersistence(userId: string, transactionId: string): Promise<void> {
    const client = getSupabaseClient();

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await client.from("transactions").select("id").eq("user_id", userId).eq("id", transactionId).maybeSingle();
        if (result.error) {
            throw result.error;
        }
        if (result.data) {
            return;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }

    throw new Error("A transação ainda está sincronizando. Aguarde um instante e tente salvar os detalhes novamente.");
}

export async function loadTransactionDetails(userId: string, transactionId: string): Promise<TransactionDetails> {
    const client = getSupabaseClient();
    const [detailsResult, attachmentsResult] = await Promise.all([
        client.from(DETAILS_TABLE).select("annotation").eq("user_id", userId).eq("transaction_id", transactionId).maybeSingle(),
        client.from(ATTACHMENTS_TABLE).select("id, transaction_id, file_name, storage_path, mime_type, size_bytes, created_at").eq("user_id", userId).eq("transaction_id", transactionId).order("created_at"),
    ]);

    if (detailsResult.error) {
        throw detailsResult.error;
    }
    if (attachmentsResult.error) {
        throw attachmentsResult.error;
    }

    const detailsRow = detailsResult.data as TransactionDetailsRow | null;
    const attachmentRows = (attachmentsResult.data ?? []) as TransactionAttachmentRow[];

    return {
        annotation: detailsRow?.annotation ?? "",
        attachments: attachmentRows.map(fromAttachmentRow),
    };
}

async function uploadAttachment(userId: string, transactionId: string, file: File): Promise<TransactionAttachment> {
    const client = getSupabaseClient();
    const attachmentId = await createTransactionAttachmentId(transactionId, file);
    const storagePath = `${userId}/${transactionId}/${attachmentId}-${sanitizeFileName(file.name)}`;
    const uploadResult = await client.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: true,
    });

    if (uploadResult.error) {
        throw uploadResult.error;
    }

    const createdAt = new Date().toISOString();
    const row = {
        user_id: userId,
        id: attachmentId,
        transaction_id: transactionId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_at: createdAt,
    };
    const metadataResult = await client.from(ATTACHMENTS_TABLE).upsert(row, { onConflict: "user_id,id" });

    if (metadataResult.error) {
        // Keep the deterministically named object so retrying can finish the
        // metadata write without uploading a duplicate attachment.
        throw metadataResult.error;
    }

    return fromAttachmentRow(row);
}

async function removeAttachment(userId: string, attachment: TransactionAttachment): Promise<void> {
    const client = getSupabaseClient();
    // Delete metadata first: the database trigger durably queues the object
    // path, so a transient Storage failure cannot leave an unrecoverable row.
    const metadataResult = await client.from(ATTACHMENTS_TABLE).delete().eq("user_id", userId).eq("id", attachment.id);
    if (metadataResult.error) {
        throw metadataResult.error;
    }

    try {
        await drainAttachmentDeletionQueue(client);
    } catch (error) {
        console.error("Failed to drain attachment deletion queue:", error);
    }
}

export async function saveTransactionDetails({ userId, transactionId, annotation, files, attachmentsToRemove }: SaveTransactionDetailsParams): Promise<TransactionDetails> {
    const client = getSupabaseClient();
    await waitForTransactionPersistence(userId, transactionId);
    const normalizedAnnotation = annotation.trim();
    const detailsResult = await client.from(DETAILS_TABLE).upsert(
        {
            user_id: userId,
            transaction_id: transactionId,
            annotation: normalizedAnnotation || null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,transaction_id" },
    );

    if (detailsResult.error) {
        throw detailsResult.error;
    }

    const uploadedAttachments: TransactionAttachment[] = [];
    for (const file of files) {
        uploadedAttachments.push(await uploadAttachment(userId, transactionId, file));
    }

    for (const attachment of attachmentsToRemove) {
        await removeAttachment(userId, attachment);
    }

    const refreshed = await loadTransactionDetails(userId, transactionId);
    return {
        annotation: refreshed.annotation,
        attachments: refreshed.attachments.length > 0 ? refreshed.attachments : uploadedAttachments,
    };
}

export async function createTransactionAttachmentDownloadUrl(storagePath: string): Promise<string> {
    const client = getSupabaseClient();
    const result = await client.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 60);
    if (result.error) {
        throw result.error;
    }
    return result.data.signedUrl;
}
