import { describe, expect, it } from "vitest";
import { describeFinanceSyncError } from "./financeSyncErrors";

describe("sync error recovery", () => {
    it.each(["RECURRENCE_ROUTING_REFERENCE_INVALID", "RECURRENCE_TAG_REFERENCE_INVALID"])("does not endlessly retry an invalid registry reference: %s", (code) => {
        const result = describeFinanceSyncError(new Error(code));
        expect(result.retryAutomatically).toBe(false);
        expect(result.message).toContain("dados locais foram preservados");
    });
    it("retains manual retry but stops automatic retries for an ended series conflict", () => {
        const result = describeFinanceSyncError(new Error("PostgreSQL: RECURRENCE_OCCURRENCE_OUTSIDE_RULE"));
        expect(result.retryAutomatically).toBe(false);
        expect(result.message).toContain("alteração local foi preservada");
    });

    it("does not treat temporary connectivity failures as domain conflicts", () => {
        expect(describeFinanceSyncError(new Error("Failed to fetch")).retryAutomatically).toBe(true);
        expect(describeFinanceSyncError(new Error("HTTP 503")).retryAutomatically).toBe(true);
    });

    it("explains why paid invoice mutations require intervention", () => {
        const result = describeFinanceSyncError(new Error("PAID_INVOICE_REQUIRES_PAYMENT_REVERSAL"));
        expect(result.retryAutomatically).toBe(false);
        expect(result.message).toContain("reverter o pagamento");
    });

    it("does not endlessly retry an invoice overpayment rejected by PostgreSQL", () => {
        const result = describeFinanceSyncError(new Error("INVOICE_OVERPAYMENT"));
        expect(result.retryAutomatically).toBe(false);
        expect(result.message).toContain("pagamentos concorrentes");
    });
});
