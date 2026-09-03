import { describe, expect, it } from "vitest";
import { createFinanceSnapshot, DEFAULT_PLANNING_STATE } from "../../context/financeTypes";
import type { SupabaseFinanceData } from "./financeService";
import { buildFinanceChangesPayload } from "./financeChanges";

function emptyData(): SupabaseFinanceData {
    return {
        ...createFinanceSnapshot([], [], [], null, [], [], [], [], [], [], [], [], DEFAULT_PLANNING_STATE),
        favoriteWalletId: null,
    };
}

describe("buildFinanceChangesPayload", () => {
    it("sends only changed rows and explicit deletions", () => {
        const base = emptyData();
        base.tags = [
            { id: "unchanged", userId: "user", name: "Fixa", color: null, isActive: true, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "removed", userId: "user", name: "Antiga", color: null, isActive: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z" },
        ];
        const target = emptyData();
        target.tags = [
            base.tags[0],
            { id: "new", userId: "user", name: "Nova", color: "#fff", isActive: true, sortOrder: 2, createdAt: "2026-01-02T00:00:00.000Z" },
        ];

        const changes = buildFinanceChangesPayload("00000000-0000-0000-0000-000000000001", base, target);

        expect(changes.protocol_version).toBe(2);
        expect(changes.upserts.tags).toHaveLength(1);
        expect(changes.upserts.tags[0]).toMatchObject({ id: "new", name: "Nova" });
        expect(changes.deletes).toContainEqual({ entity_type: "tag", entity_id: "removed" });
    });

    it("does not send client-authored ledger projections", () => {
        const base = emptyData();
        const target = emptyData();
        target.ledgerEntries = [{
            id: "ledger-client",
            walletId: "wallet-1",
            transactionId: "transaction-1",
            invoiceId: null,
            amount: 10,
            balanceAfter: 10,
            description: "Client projection",
            createdAt: "2026-01-01T00:00:00.000Z",
        }];

        const changes = buildFinanceChangesPayload("00000000-0000-0000-0000-000000000001", base, target);

        expect(changes.upserts.ledger_entries).toEqual([]);

        base.ledgerEntries = target.ledgerEntries;
        target.ledgerEntries = [];
        const deletionAttempt = buildFinanceChangesPayload("00000000-0000-0000-0000-000000000001", base, target);
        expect(deletionAttempt.deletes).not.toContainEqual(expect.objectContaining({ entity_type: "ledger_entry" }));
    });
});
