import { describe, expect, it } from "vitest";
import { resolveCreditCardInvoiceCycleFromCycleKey } from "../../../context/finance/invoiceCycles";
import type { CreditCardInvoice } from "../../../context/finance/domainTypes";
import { resolveCurrentInvoiceMonth } from "./statementPageShared";

const reference = new Date(2026, 2, 20); // 2026-03-20

const card = { closingDay: 10, dueDay: 20 };

function invoice(id: string, cycleKey: string, overrides: Partial<CreditCardInvoice> = {}): CreditCardInvoice {
    const cycle = resolveCreditCardInvoiceCycleFromCycleKey(cycleKey, card.closingDay, card.dueDay);

    return {
        id,
        creditCardId: "card-1",
        cycleKey,
        closingDate: cycle.closingDate,
        dueDate: cycle.dueDate,
        totalAmount: 100,
        paidAmount: 0,
        status: "open",
        paidAt: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        ...overrides,
    };
}

describe("resolveCurrentInvoiceMonth", () => {
    const overdue = invoice("overdue", "2026-02");
    const closed = invoice("closed", "2026-03");
    const open = invoice("open", "2026-04");
    const paid = invoice("paid", "2026-01", { status: "paid", paidAmount: 100, paidAt: "2026-01-15" });

    it("prioriza a fechada nao paga sobre a vencida e a aberta", () => {
        expect(resolveCurrentInvoiceMonth(card, [open, overdue, closed, paid], "1999-01", reference)).toBe("2026-03");
    });

    it("cai para a vencida quando nao ha fechada", () => {
        expect(resolveCurrentInvoiceMonth(card, [open, overdue, paid], "1999-01", reference)).toBe("2026-02");
    });

    it("cai para a aberta quando nao ha fechada nem vencida", () => {
        expect(resolveCurrentInvoiceMonth(card, [open, paid], "1999-01", reference)).toBe("2026-04");
    });

    it("usa o fallback quando so restam faturas pagas", () => {
        expect(resolveCurrentInvoiceMonth(card, [paid], "1999-01", reference)).toBe("1999-01");
    });
});
