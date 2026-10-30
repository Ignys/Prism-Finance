import { describe, expect, it } from "vitest";
import { normalizeCreditCardInvoice, toTransactionList } from "../../../context/finance/financeCore";
import { fixtureCard, fixtureGroup, fixtureTransaction, fixtureWallet } from "../../../context/finance/financeTestFixtures";
import type { Transaction } from "../../../context/finance/domainTypes";
import { buildReportsDataset, type ReportScope } from "./planningReportsUtils";

const base: Transaction = { ...toTransactionList([fixtureTransaction()], [fixtureGroup()], [], [], [], [])[0], inWallet: fixtureWallet.id, date: "2026-01-20" };
// Fatura de fevereiro: a compra de janeiro deve aparecer em fevereiro.
const invoice = normalizeCreditCardInvoice({ id: "invoice", creditCardId: fixtureCard.id, cycleKey: "2026-02", totalAmount: 50 }, new Set([fixtureCard.id]));
const period = { startMonth: "2026-01", endMonth: "2026-02" };
const walletOnly: ReportScope = { walletIds: [fixtureWallet.id], creditCardIds: [] };
const cardOnly: ReportScope = { walletIds: [], creditCardIds: [fixtureCard.id] };
const both: ReportScope = { walletIds: [fixtureWallet.id], creditCardIds: [fixtureCard.id] };

const purchase = (overrides: Partial<Transaction> = {}): Transaction => ({
    ...base,
    id: "purchase",
    type: "spending",
    value: 50,
    status: "pending",
    paymentMethod: "credit_card",
    creditCardId: fixtureCard.id,
    invoiceId: invoice.id,
    commitment: "posted",
    ...overrides,
});
const payment: Transaction = {
    ...base,
    id: "payment",
    type: "spending",
    value: 50,
    date: "2026-02-10",
    status: "paid",
    systemKind: "invoice_payment",
    invoicePaymentMeta: { invoiceId: invoice.id, creditCardId: fixtureCard.id },
};
const income: Transaction = { ...base, id: "salary", type: "income", value: 100, status: "paid" };

const month = (scope: ReportScope, transactions: Transaction[], monthKey: string) =>
    buildReportsDataset(period, transactions, [invoice], scope).monthReports.find((report) => report.monthKey === monthKey);

describe("scoped reports", () => {
    it("counts card purchases in the invoice month, not the purchase date", () => {
        expect(month(cardOnly, [purchase()], "2026-01")?.spending).toBe(0);
        expect(month(cardOnly, [purchase()], "2026-02")?.cardSpending).toBe(50);
    });

    it("ignores paying a selected card, so the purchase is not counted twice", () => {
        const result = buildReportsDataset(period, [purchase(), payment, income], [invoice], both);
        expect(result.summary.spending).toBe(50);
        expect(result.summary.income).toBe(100);
        expect(result.summary.methodReports.map((method) => method.key)).toEqual(["credit_card"]);
    });

    it("shows a payment of an unselected card as its own category in wallet reports", () => {
        const result = buildReportsDataset(period, [purchase(), payment], [invoice], walletOnly);
        expect(result.summary.spending).toBe(50);
        expect(result.categoryReports.map((row) => row.label)).toEqual(["Pagamento de cartão"]);
    });

    it("keeps wallet income out of card-only reports", () => {
        expect(buildReportsDataset(period, [purchase(), income], [invoice], cardOnly).summary.income).toBe(0);
    });

    it("excludes forecasts and manual closes without wallet movement", () => {
        const manual: Transaction = { ...payment, invoicePaymentMeta: null, paymentForInvoiceId: "other", isNonCashSettlement: true };
        const result = buildReportsDataset(period, [purchase({ commitment: "forecast" }), manual], [invoice], both);
        expect(result.summary.spending).toBe(0);
        expect(result.summary.transactionCount).toBe(0);
    });
});

describe("tag reports", () => {
    const tag = (id: string, name: string) => ({ id, userId: null, name, color: null, isActive: true, sortOrder: 0, createdAt: "2026-01-01" });
    const tags = [tag("trip", "Viagem"), tag("work", "Trabalho")];

    it("counts a spending in every tag it has and ignores income and unknown tags", () => {
        const spending: Transaction = { ...base, id: "dinner", type: "spending", value: 80, status: "paid", tagIds: ["trip", "work", "deleted"] };
        const taggedIncome: Transaction = { ...income, tagIds: ["trip"] };
        const { tagReports } = buildReportsDataset(period, [spending, taggedIncome], [invoice], walletOnly, [], tags);

        expect(tagReports.map((report) => [report.label, report.totalAmount, report.percent])).toEqual([
            ["Trabalho", 80, 100],
            ["Viagem", 80, 100],
        ]);
    });
});
