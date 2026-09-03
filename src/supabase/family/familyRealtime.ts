import { getSupabaseClient } from "../supabaseClient";

interface FamilyShareRevisionRow {
    revision: number | string;
    updated_by: string | null;
}

export interface FamilyShareRevisionChange {
    revision: number;
    updatedBy: string | null;
}

export function subscribeToFamilyShareRevisionChanges(
    familyId: string,
    onChange: (change: FamilyShareRevisionChange) => void,
): () => void {
    const client = getSupabaseClient();
    const channel = client
        .channel(`family-share-sync:${familyId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "family_share_sync_state",
                filter: `family_id=eq.${familyId}`,
            },
            (payload) => {
                const row = payload.new as Partial<FamilyShareRevisionRow> | null;
                const revision = Number(row?.revision);
                if (!Number.isFinite(revision)) {
                    return;
                }
                onChange({
                    revision,
                    updatedBy: typeof row?.updated_by === "string" ? row.updated_by : null,
                });
            },
        )
        .subscribe();

    return () => {
        void client.removeChannel(channel);
    };
}
