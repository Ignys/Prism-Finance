import { describe, expect, it, vi } from "vitest";
import { createEmptySupabaseFinanceData } from "../../supabase/finance";
import { persistPendingSync } from "./persistPendingSync";
import type { PendingFinanceSync } from "./pendingFinanceSyncStorage";

const data = createEmptySupabaseFinanceData();
const pending: PendingFinanceSync = {
    queuedAt: "2026-09-07T12:00:00.000Z",
    baseRevision: 1,
    baseData: data,
    targetData: data,
};

describe("persistPendingSync", () => {
    it("does not start a remote flush when durable storage fails", async () => {
        const onDurable = vi.fn();

        await expect(persistPendingSync({
            pending,
            isCurrent: () => true,
            persist: async () => { throw new Error("quota exceeded"); },
            onDurable,
        })).rejects.toThrow("quota exceeded");

        expect(onDurable).not.toHaveBeenCalled();
    });

    it("does not flush an older snapshot after a newer edit is queued", async () => {
        let current = pending;
        const newer = { ...pending, queuedAt: "2026-09-07T12:00:01.000Z" };
        const onDurable = vi.fn();

        const persisted = await persistPendingSync({
            pending,
            isCurrent: (candidate) => current === candidate,
            persist: async () => { current = newer; },
            onDurable,
        });

        expect(persisted).toBe(false);
        expect(onDurable).not.toHaveBeenCalled();
    });

    it("releases the current snapshot only after persistence completes", async () => {
        const events: string[] = [];

        const persisted = await persistPendingSync({
            pending,
            isCurrent: () => true,
            persist: async () => { events.push("persisted"); },
            onDurable: () => { events.push("flush"); },
        });

        expect(persisted).toBe(true);
        expect(events).toEqual(["persisted", "flush"]);
    });
});
