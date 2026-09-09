import { describe, expect, it } from "vitest";
import { transactionSettlementDate } from "./transactionSettlementDate";

const scheduled = { status: "paid" as const, date: "2026-01-05", meta: { criado_em: "2026-01-01T12:00:00Z", atualizado_em: "2026-02-10T12:00:00Z" } };

describe("cash settlement date", () => {
    it("places late payment in its effective month without changing the scheduled date", () => {
        expect(transactionSettlementDate(scheduled)?.getMonth()).toBe(1);
        expect(scheduled.date).toBe("2026-01-05");
    });
    it("excludes pending transactions and uses the scheduled date only for legacy payments", () => {
        expect(transactionSettlementDate({ ...scheduled, status: "pending" })).toBeNull();
        expect(transactionSettlementDate({ ...scheduled, isNonCashSettlement: true })).toBeNull();
        expect(transactionSettlementDate({ ...scheduled, meta: { ...scheduled.meta, atualizado_em: null } })?.getMonth()).toBe(0);
    });
});
