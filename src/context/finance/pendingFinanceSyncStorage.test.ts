import { describe, expect, it } from "vitest";
import { createEmptySupabaseFinanceData } from "../../supabase/finance";
import { parsePendingFinanceSync } from "./pendingFinanceSyncStorage";

describe("parsePendingFinanceSync", () => {
    it("reads the IndexedDB record without serializing finance data to localStorage", () => {
        const data = createEmptySupabaseFinanceData();
        const parsed = parsePendingFinanceSync({
            key: "user-1:client-1",
            version: 4,
            userId: "user-1",
            clientId: "client-1",
            queuedAt: "2026-09-03T12:00:00.000Z",
            baseRevision: 42,
            baseData: data,
            targetData: data,
        }, "user-1", "client-1");

        expect(parsed).toMatchObject({ baseRevision: 42, queuedAt: "2026-09-03T12:00:00.000Z" });
    });

    it("rejects a pending record owned by another browser client", () => {
        const data = createEmptySupabaseFinanceData();
        expect(parsePendingFinanceSync({
            version: 4,
            userId: "user-1",
            clientId: "other-client",
            queuedAt: "2026-09-03T12:00:00.000Z",
            baseRevision: 42,
            baseData: data,
            targetData: data,
        }, "user-1", "client-1")).toBeNull();
    });
});
