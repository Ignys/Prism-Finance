import { describe, expect, it } from "vitest";
import type { SupabaseFinanceData } from "../../supabase/finance";
import { createFinanceSnapshot, DEFAULT_PLANNING_STATE } from "../financeTypes";
import { mergeSupabaseFinanceData } from "./financeSyncMerge";

function financeData(wallets: SupabaseFinanceData["wallets"]): SupabaseFinanceData {
    return {
        ...createFinanceSnapshot(wallets, [], [], null, [], [], [], [], [], [], [], [], DEFAULT_PLANNING_STATE),
        favoriteWalletId: null,
    };
}

const wallet = {
    id: "wallet-1",
    name: "Principal",
    icon: "wallet",
    type: "checking" as const,
    balance: 100,
    initialBalance: 100,
    currency: "BRL",
    color: "#000000",
    isActive: true,
    includeInMainTotals: true,
    createdAt: "2026-01-01T00:00:00.000Z",
};

describe("mergeSupabaseFinanceData", () => {
    it("keeps a confirmed remote deletion instead of resurrecting a stale row", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([wallet]),
            remoteData: financeData([]),
            targetData: financeData([{ ...wallet, name: "Alterada offline" }]),
        });

        expect(merged.wallets).toEqual([]);
    });

    it("preserves independent local and remote inserts", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([]),
            remoteData: financeData([{ ...wallet, id: "remote" }]),
            targetData: financeData([{ ...wallet, id: "local" }]),
        });

        expect(merged.wallets.map((item) => item.id)).toEqual(["remote", "local"]);
    });

    it("combines concurrent edits to different fields of the same entity", () => {
        const merged = mergeSupabaseFinanceData({
            baseData: financeData([wallet]),
            remoteData: financeData([{ ...wallet, balance: 150, initialBalance: 150 }]),
            targetData: financeData([{ ...wallet, name: "Conta conjunta" }]),
        });

        expect(merged.wallets[0]).toMatchObject({ name: "Conta conjunta", balance: 150, initialBalance: 150 });
    });
});
