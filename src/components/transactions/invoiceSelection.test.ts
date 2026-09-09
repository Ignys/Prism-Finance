import { describe, expect, it } from "vitest";
import { normalizeCreditCardInvoice } from "../../context/finance/financeCore";
import { defaultInvoiceOption, filterInvoiceOption } from "./invoiceSelection";
import { buildCardInvoiceOptions } from "./cardInvoiceOptions";
import { fixtureCard } from "../../context/finance/financeTestFixtures";

const paid = { invoice: normalizeCreditCardInvoice({ id: "paid", creditCardId: "card", cycleKey: "2026-03", totalAmount: 100, paidAmount: 100, status: "paid" }, new Set(["card"])),
    monthLabel: "março de 2026", cycleKey: "2026-03", searchText: "março de 2026 paga" };
const open = { ...paid, invoice: { ...paid.invoice, id: "open", status: "open" as const, paidAmount: 0 } };
describe("invoice selector", () => {
    it("hides paid invoices unless the search identifies the month or cycle", () => {
        for (const query of ["", " ", "paga", "2026", "R$100"]) expect(filterInvoiceOption(paid, query)).toBe(false);
        for (const query of ["março", "MARCO", "mar", "2026-03"]) expect(filterInvoiceOption(paid, query)).toBe(true);
        expect(filterInvoiceOption(paid, "abril")).toBe(false);
        expect(filterInvoiceOption(open, "")).toBe(true);
    });
    it("never defaults to a paid invoice even when it is preferred", () => {
        expect(defaultInvoiceOption([paid, open], paid.invoice.id)).toBe(open);
        expect(defaultInvoiceOption([paid])).toBeUndefined();
    });
    it("does not fabricate an unpaid duplicate of a paid cycle with a historical custom ID", () => {
        const invoice = { ...paid.invoice, creditCardId: fixtureCard.id, id: "historical-custom-id" };
        const options = buildCardInvoiceOptions(fixtureCard, [invoice], [invoice.cycleKey]);
        expect(options).toHaveLength(1);
        expect(options[0]).toMatchObject({ id: invoice.id, disabled: true });
        expect(defaultInvoiceOption(options)).toBeUndefined();
        expect(options.filter((option) => filterInvoiceOption(option, ""))).toHaveLength(0);
    });
});
