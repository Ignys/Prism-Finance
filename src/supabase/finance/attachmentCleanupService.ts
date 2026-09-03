import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";

const ATTACHMENT_BUCKET = "transaction-attachments";
const CLEANUP_BATCH_SIZE = 100;

interface AttachmentDeletionRow {
    storage_path: string;
    attempts: number;
}

export async function drainAttachmentDeletionQueue(client: SupabaseClient = getSupabaseClient()): Promise<number> {
    const pendingResult = await client
        .from("attachment_deletion_queue")
        .select("storage_path, attempts")
        .eq("bucket_id", ATTACHMENT_BUCKET)
        .order("queued_at", { ascending: true })
        .limit(CLEANUP_BATCH_SIZE);
    if (pendingResult.error) {
        throw pendingResult.error;
    }

    const pendingRows = (pendingResult.data ?? []) as AttachmentDeletionRow[];
    const paths = pendingRows.map((row) => row.storage_path);
    if (paths.length === 0) {
        return 0;
    }

    const storageResult = await client.storage.from(ATTACHMENT_BUCKET).remove(paths);
    if (storageResult.error) {
        await Promise.all(
            pendingRows.map((row) =>
                client
                    .from("attachment_deletion_queue")
                    .update({ attempts: row.attempts + 1, last_error: storageResult.error.message })
                    .eq("bucket_id", ATTACHMENT_BUCKET)
                    .eq("storage_path", row.storage_path),
            ),
        );
        throw storageResult.error;
    }

    const deleteResult = await client
        .from("attachment_deletion_queue")
        .delete()
        .eq("bucket_id", ATTACHMENT_BUCKET)
        .in("storage_path", paths);
    if (deleteResult.error) {
        throw deleteResult.error;
    }

    return paths.length;
}
