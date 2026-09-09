import { describe, expect, it, vi } from "vitest";
import { createEmptySupabaseFinanceData } from "../../supabase/finance";
import { persistConflictResolution } from "./persistConflictResolution";
import type { PendingFinanceSync } from "./pendingFinanceSyncStorage";

const data = createEmptySupabaseFinanceData();
const original: PendingFinanceSync = { queuedAt: "original", baseRevision: 1, baseData: data, targetData: data };
const resolved = { ...original, queuedAt: "resolved", baseRevision: 2 };

describe("durable conflict resolution", () => {
    it("keeps the original pending action on a failed IndexedDB write", async () => {
        let current = original;
        await expect(persistConflictResolution({ original, resolved,
            isCurrent: (pending) => current === pending,
            persist: async () => { throw new Error("quota exceeded"); },
            publish: (pending) => { current = pending; },
        })).rejects.toThrow("quota exceeded");
        expect(current).toBe(original);
    });

    it("does not overwrite an edit made while durable storage is pending", async () => {
        let current = original;
        const newer = { ...original, queuedAt: "newer" };
        const publish = vi.fn();
        const result = await persistConflictResolution({ original, resolved,
            isCurrent: (pending) => current === pending,
            persist: async () => { current = newer; }, publish,
        });
        expect(result).toBe(false);
        expect(publish).not.toHaveBeenCalled();
        expect(current).toBe(newer);
    });

    it("publishes a rebase only after durable storage succeeds", async () => {
        const events: string[] = [];
        await persistConflictResolution({ original, resolved, isCurrent: () => true,
            persist: async () => { events.push("stored"); },
            publish: () => { events.push("published"); },
        });
        expect(events).toEqual(["stored", "published"]);
    });
});
