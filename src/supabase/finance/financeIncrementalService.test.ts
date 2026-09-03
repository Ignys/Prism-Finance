import { describe, expect, it } from "vitest";
import { createEmptySupabaseFinanceData } from "./financeService";
import { applySupabaseFinanceChangesPage, type SupabaseFinanceChangesPage } from "./financeIncrementalService";
import type { WalletRow } from "./financeTables";
import { fromWalletRow } from "./financeRowMappers";

const walletRow = (id: string, balance: number): WalletRow => ({
    user_id: "user-1",
    id,
    name: id,
    icon: "wallet",
    type: "checking",
    balance,
    initial_balance: balance,
    currency: "BRL",
    color: "#000000",
    is_active: true,
    include_in_main_totals: true,
    created_at: "2026-01-01T00:00:00.000Z",
});

function changesPage(overrides: Partial<SupabaseFinanceChangesPage["changes"]>): SupabaseFinanceChangesPage {
    return {
        from_revision: 1,
        until_revision: 2,
        current_revision: 2,
        has_more: false,
        requires_full_reload: false,
        changes: {
            preferences: null,
            wallets: [],
            credit_cards: [],
            beneficiaries: [],
            categories: [],
            tags: [],
            wish_items: [],
            transaction_groups: [],
            credit_card_invoices: [],
            transactions: [],
            ledger_entries: [],
            transaction_tags: [],
            tombstones: [],
            ...overrides,
        },
    };
}

describe("applySupabaseFinanceChangesPage", () => {
    it("upserts changed rows without replacing untouched collections", () => {
        const base = createEmptySupabaseFinanceData();
        base.wallets = [fromWalletRow(walletRow("wallet-1", 10)), fromWalletRow(walletRow("wallet-2", 20))];

        const result = applySupabaseFinanceChangesPage(base, changesPage({ wallets: [walletRow("wallet-1", 30)] }));

        expect(result.wallets).toHaveLength(2);
        expect(result.wallets.find((wallet) => wallet.id === "wallet-1")?.balance).toBe(30);
        expect(result.wallets.find((wallet) => wallet.id === "wallet-2")?.balance).toBe(20);
    });

    it("applies explicit tombstones after upserts", () => {
        const base = createEmptySupabaseFinanceData();
        base.wallets = [fromWalletRow(walletRow("wallet-1", 10))];
        const page = changesPage({
            wallets: [walletRow("wallet-1", 30)],
            tombstones: [{
                entity_type: "wallet",
                entity_id: "wallet-1",
                related_id: "",
                version: 2,
                deleted_at: "2026-01-02T00:00:00.000Z",
                deleted_by: "other-device",
            }],
        });

        expect(applySupabaseFinanceChangesPage(base, page).wallets).toEqual([]);
    });

    it("applies explicit null favorite preferences from the canonical database row", () => {
        const base = createEmptySupabaseFinanceData();
        base.favoriteWalletId = "old-wallet";
        base.favoriteCreditCardId = "old-card";

        const result = applySupabaseFinanceChangesPage(base, changesPage({
            preferences: {
                user_id: "user-1",
                favorite_wallet_id: null,
                favorite_credit_card_id: null,
                planning: {},
            },
        }));

        expect(result.favoriteWalletId).toBeNull();
        expect(result.favoriteCreditCardId).toBeNull();
    });
});
