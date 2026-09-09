import { describe, expect, it, vi } from "vitest";
import { createEmptySupabaseFinanceData } from "../../supabase/finance";
import { recoverPendingSync } from "./recoverPendingSync";

const remote = { data: createEmptySupabaseFinanceData(), revision: 12, tombstones: [] };

function steps() {
    return { load: vi.fn(async () => remote), backup: vi.fn(async () => undefined),
        removePending: vi.fn(async () => undefined), isCurrent: vi.fn(() => true), publish: vi.fn() };
}

describe("explicit sync recovery", () => {
    it("backs up before removing the pending action and publishes the confirmed revision", async () => {
        const actions = steps();
        const order: string[] = [];
        actions.backup.mockImplementation(async () => { order.push("backup"); });
        actions.removePending.mockImplementation(async () => { order.push("remove"); });
        actions.publish.mockImplementation(() => { order.push("publish"); });
        await recoverPendingSync(actions);
        expect(order).toEqual(["backup", "remove", "publish"]);
        expect(actions.publish).toHaveBeenCalledWith(remote);
    });

    it("preserves pending work when the backup fails", async () => {
        const actions = steps();
        actions.backup.mockRejectedValue(new Error("Storage full"));
        await expect(recoverPendingSync(actions)).rejects.toThrow("Storage full");
        expect(actions.removePending).not.toHaveBeenCalled();
        expect(actions.publish).not.toHaveBeenCalled();
    });

    it("leaves local work intact when the remote request fails", async () => {
        const actions = steps();
        actions.load.mockRejectedValue(new Error("Offline"));
        await expect(recoverPendingSync(actions)).rejects.toThrow("Offline");
        expect(actions.backup).not.toHaveBeenCalled();
        expect(actions.removePending).not.toHaveBeenCalled();
    });

    it("aborts when another edit arrives during the backup", async () => {
        const actions = steps();
        actions.backup.mockImplementation(async () => { actions.isCurrent.mockReturnValue(false); });
        await expect(recoverPendingSync(actions)).rejects.toThrow("dados locais mudaram");
        expect(actions.removePending).not.toHaveBeenCalled();
        expect(actions.publish).not.toHaveBeenCalled();
    });

    it("does not replace the UI when a newer pending action supersedes the conditional removal", async () => {
        const actions = steps();
        actions.removePending.mockImplementation(async () => { actions.isCurrent.mockReturnValue(false); });
        await expect(recoverPendingSync(actions)).rejects.toThrow("dados locais mudaram");
        expect(actions.publish).not.toHaveBeenCalled();
    });
});
