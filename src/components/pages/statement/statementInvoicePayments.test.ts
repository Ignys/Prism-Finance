import { describe, expect, it } from "vitest";
import { toTransactionList } from "../../../context/finance/financeCore";
import { fixtureGroup, fixtureTransaction } from "../../../context/finance/financeTestFixtures";
import { selectInvoicePayments } from "./statementPageShared";

describe("statement invoice payments", () => {
    it("shows the existing linked payment transaction only on its own invoice", () => {
        const group = fixtureGroup();
        const payment = toTransactionList(
            [fixtureTransaction({ paymentForInvoiceId: "invoice-a", status: "paid" })],
            [group], [], [], [], [],
        )[0];

        expect(selectInvoicePayments([payment], new Set(["invoice-a"]))).toEqual([payment]);
        expect(selectInvoicePayments([payment], new Set(["invoice-b"]))).toEqual([]);
    });
});
