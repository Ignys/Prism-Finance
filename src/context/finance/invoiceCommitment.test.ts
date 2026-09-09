import { describe, expect, it } from "vitest";
import { buildStatementSummary } from "../../components/pages/statement/statementPageShared";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction } from "./financeTestFixtures";
import { normalizeCreditCardInvoice, normalizeFinanceSnapshot, toTransactionList } from "./financeCore";
import { buildInstallmentSchedule } from "./installmentTransactions";
import { projectInvoiceForecasts } from "./invoiceForecasts";
import { syncCreditCardInvoices } from "./syncCreditCardInvoices";
import { requireRecurrenceRule } from "./recurrence/rule";
import { projectOccurrences } from "./recurrence/projectOccurrences";
import type { CreditCardInvoice } from "./domainTypes";

function summary(invoices: CreditCardInvoice[]) {
    return buildStatementSummary({ selectedMonth: "2026-02", selectedCardName: fixtureCard.name, scopedCards: [fixtureCard], scopedInvoices: invoices,
        monthInvoices: invoices.filter((item) => item.cycleKey === "2026-02"), monthTransactions: [], cardNameById: new Map([[fixtureCard.id, fixtureCard.name]]),
        referenceDate: new Date("2026-01-01T12:00:00Z") });
}

describe("forecast versus posted card commitment", () => {
    it("uses the canonical custom invoice ID for projection and aggregation", () => {
        const group = fixtureGroup({ creditCardId: fixtureCard.id, transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100 }) });
        const invoice = normalizeCreditCardInvoice({ id: "custom-history-id", creditCardId: fixtureCard.id, cycleKey: "2026-01", totalAmount: 0 }, new Set([fixtureCard.id]));
        const projection = projectOccurrences({ groups: [group], transactions: [], transactionTags: [], creditCards: [fixtureCard], creditCardInvoices: [invoice], period: { startDate: "2026-01-01", endDate: "2026-01-31" } });
        expect(projection.transactions[0].invoiceId).toBe(invoice.id);
        const forecasts = projectInvoiceForecasts([invoice], toTransactionList(projection.transactions, [group], [], [], [], []), [fixtureCard]);
        expect(forecasts).toHaveLength(1);
        expect(forecasts[0]).toMatchObject({ id: invoice.id, totalAmount: 0, forecastAmount: 100 });
    });
    it("a R$100 fixed monthly forecast does not reserve R$1,200 or become payable", () => {
        const group = fixtureGroup({ creditCardId: fixtureCard.id, transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100 }) });
        const projected = projectOccurrences({ groups: [group], transactions: [], transactionTags: [], creditCards: [fixtureCard], period: { startDate: "2026-01-01", endDate: "2026-12-31" } });
        const transactions = toTransactionList(projected.transactions, [group], [], [], [], []);
        const invoices = projectInvoiceForecasts([], transactions, [fixtureCard]);
        expect(invoices.reduce((sum, item) => sum + item.forecastAmount!, 0)).toBe(1200);
        expect(invoices.every((item) => item.totalAmount === 0 && item.paidAmount === 0)).toBe(true);
        expect(summary(invoices)).toMatchObject({ openAmountScope: 0, availableLimitEstimate: 2000 });
    });

    it("a R$600 purchase in six installments reserves its whole unpaid commitment", () => {
        const group = fixtureGroup({ creditCardId: fixtureCard.id, transactionMode: "installment", installmentCount: 6, totalAmount: 600 });
        const schedule = buildInstallmentSchedule({ totalAmount: 600, installmentCount: 6, startDate: "2026-01-31", initialStatus: "pending", advanceDatesMonthly: false });
        expect(schedule.map((item) => item.amount)).toEqual([100, 100, 100, 100, 100, 100]);
        const transactions = schedule.map((item) => fixtureTransaction({ ...item, id: `installment-${item.installmentNumber}`, invoiceId: `invoice-${fixtureCard.id}-2026-0${item.installmentNumber + 1}` }));
        const synced = syncCreditCardInvoices({ creditCards: [fixtureCard], transactionGroups: [group], transactions, existingInvoices: [] });
        expect(synced.creditCardInvoices).toHaveLength(6);
        expect(summary(synced.creditCardInvoices)).toMatchObject({ openAmountScope: 600, availableLimitEstimate: 1400, spentInMonth: 100 });
    });

    it("materializing for an attachment keeps a forecast out of invoice totals after backup normalization", () => {
        const group = fixtureGroup({ creditCardId: fixtureCard.id, transactionMode: "recurring", recurrenceRule: requireRecurrenceRule({ anchorDate: "2026-01-05", amount: 100 }) });
        const transaction = fixtureTransaction({ occurrenceNumber: 1, commitment: "forecast", invoiceId: `invoice-${fixtureCard.id}-2026-01` });
        const snapshot = fixtureSnapshot([group], [transaction]);
        const normalized = normalizeFinanceSnapshot(snapshot, "user").snapshot;
        expect(normalized.creditCardInvoices[0].totalAmount).toBe(0);
        expect(normalized.transactions[0].commitment).toBe("forecast");
    });
});
