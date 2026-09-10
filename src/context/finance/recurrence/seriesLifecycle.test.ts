import { describe, expect, it } from "vitest";
import { fixtureCard, fixtureGroup, fixtureSnapshot, fixtureTransaction } from "../financeTestFixtures";
import type { FinanceSnapshot, TransactionDraft, TransactionSeriesScope } from "../domainTypes";
import { updateTransactionSeriesSnapshot } from "../transactionSeries/updateTransactionSeriesSnapshot";
import { deleteTransactionsSnapshot } from "../transactionSeries/deleteTransactions";
import { updateTransactionsBulkSnapshot } from "../transactionSeries/bulkUpdate";
import { occurrenceId, projectOccurrences } from "./projectOccurrences";
import { materializeOccurrence } from "./materializeOccurrence";
import { requireRecurrenceRule } from "./rule";
import { normalizeCreditCardInvoice } from "../financeCore";

const now = "2026-03-05T12:00:00.000Z";
const rule = requireRecurrenceRule({ anchorDate: "2026-01-31", amount: 100, end: { type: "count", count: 6 } });
const group = fixtureGroup({ transactionMode: "recurring", recurrenceRule: rule });
const empty = () => fixtureSnapshot([group], []);
const id = (number: number) => occurrenceId(group.id, number);
function project(snapshot: FinanceSnapshot) {
    return projectOccurrences({ groups: snapshot.transactionGroups, transactions: snapshot.transactions, transactionTags: snapshot.transactionTags,
        creditCards: snapshot.creditCards, period: { startDate: "2026-01-01", endDate: "2027-12-31" } }).transactions
        .sort((a, b) => a.occurrenceNumber! - b.occurrenceNumber!);
}
function edit(snapshot: FinanceSnapshot, number: number, scope: TransactionSeriesScope, draft: TransactionDraft, revision = "revision") {
    return updateTransactionSeriesSnapshot({ snapshot: materializeOccurrence(snapshot, id(number)), transactionId: id(number), scope, draft,
        wasProjected: !snapshot.transactions.some((item) => item.id === id(number)), now, createGroupId: () => revision }).snapshot;
}

describe("recurrence lifecycle and stable identity", () => {
    it("updates an unconfirmed forecast after closing while preserving posted card history", () => {
        const cardGroup = fixtureGroup({ ...group, sourceWalletId: null, creditCardId: fixtureCard.id });
        const invoice = normalizeCreditCardInvoice({ id: "closed-unpaid", creditCardId: fixtureCard.id, cycleKey: "2026-02",
            closingDate: "2026-02-10", dueDate: "2026-02-17", totalAmount: 100, paidAmount: 0 }, new Set([fixtureCard.id]));
        const posted = fixtureTransaction({ id: id(1), occurrenceNumber: 1, scheduledDate: "2026-01-31", commitment: "posted", invoiceId: invoice.id });
        const forecast = fixtureTransaction({ id: id(2), occurrenceNumber: 2, scheduledDate: "2026-02-05", commitment: "forecast", invoiceId: invoice.id });
        const snapshot = { ...fixtureSnapshot([cardGroup], [posted, forecast]), creditCardInvoices: [invoice] };
        const updated = edit(snapshot, 3, "all", { amount: 200 });
        expect(updated.transactions.find((row) => row.id === posted.id)).toEqual(posted);
        expect(updated.transactions.find((row) => row.id === forecast.id)).toMatchObject({ amount: 200, commitment: "forecast" });
        expect(updated.creditCardInvoices.find((row) => row.id === invoice.id)?.totalAmount).toBe(100);
    });
    it("keeps an individually moved occurrence as an override after reloading and projects the remaining five", () => {
        const snapshot = edit(empty(), 2, "single", { scheduledDate: "2026-04-03", amount: 125 });
        const reloaded = structuredClone(snapshot);
        expect(reloaded.transactions).toHaveLength(1);
        expect(project(reloaded).map((item) => [item.occurrenceNumber, item.scheduledDate, item.amount])).toEqual([
            [1, "2026-01-31", 100], [2, "2026-04-03", 125], [3, "2026-03-31", 100],
            [4, "2026-04-30", 100], [5, "2026-05-31", 100], [6, "2026-06-30", 100],
        ]);
    });

    it("splits this and next without storing forecasts or duplicating global occurrence numbers", () => {
        const first = edit(empty(), 3, "this_and_next", { scheduledDate: "2026-03-15", amount: 150 });
        const second = edit(first, 5, "this_and_next", { scheduledDate: "2026-05-20", amount: 180 }, "revision-2");
        expect(second.transactions).toHaveLength(0);
        expect(project(second).map((item) => [item.id, item.scheduledDate, item.amount])).toEqual([
            [id(1), "2026-01-31", 100], [id(2), "2026-02-28", 100], [id(3), "2026-03-15", 150],
            [id(4), "2026-04-15", 150], [id(5), "2026-05-20", 180], [id(6), "2026-06-20", 180],
        ]);
    });

    it("preserves the whole paid occurrence and its original metadata on all-series changes", () => {
        const paid = updateTransactionsBulkSnapshot(empty(), { transactionIds: [id(1)], status: "paid" }, now);
        const historical = structuredClone(paid.transactions[0]);
        const ledger = structuredClone(paid.ledgerEntries);
        const updated = edit(paid, 3, "all", { scheduledDate: "2026-03-10", amount: 200, description: "New title" });
        expect(updated.transactions).toEqual([historical]);
        expect(updated.ledgerEntries).toEqual(ledger);
        expect(updated.transactionGroups.find((item) => item.id === historical.groupId)?.title).toBe(group.title);
        expect(project(updated).map((item) => item.amount)).toEqual([100, 200, 200, 200, 200, 200]);
    });

    it("persists an individual deletion only in the series rule and ends next occurrences while retaining paid history", () => {
        const deleted = deleteTransactionsSnapshot(empty(), id(2), "single", "2026-03-05");
        expect(deleted.transactions).toHaveLength(0);
        expect(deleted.transactionGroups[0].recurrenceRule?.excludedDates).toContain("2026-02-28");
        expect(project(structuredClone(deleted)).map((item) => item.occurrenceNumber)).toEqual([1, 3, 4, 5, 6]);
        expect(() => materializeOccurrence(structuredClone(deleted), id(2))).toThrow();
        const paid = updateTransactionsBulkSnapshot(deleted, { transactionIds: [id(1)], status: "paid" }, now);
        const ended = deleteTransactionsSnapshot(paid, id(3), "this_and_next", "2026-03-05");
        expect(project(ended).map((item) => item.occurrenceNumber)).toEqual([1]);
        expect(() => materializeOccurrence(ended, id(3))).toThrow();
        expect(ended.ledgerEntries).toEqual(paid.ledgerEntries);
    });

    it("cancels one occurrence without moving siblings and ends future occurrences by scope", () => {
        const cancelledSingle = edit(empty(), 2, "single", { status: "cancelled" });
        expect(cancelledSingle.transactions).toHaveLength(1);
        expect(cancelledSingle.transactions[0]).toMatchObject({
            id: id(2),
            occurrenceNumber: 2,
            scheduledDate: "2026-02-28",
            status: "cancelled",
        });
        expect(project(cancelledSingle).map((item) => [item.occurrenceNumber, item.status])).toEqual([
            [1, "pending"], [2, "cancelled"], [3, "pending"], [4, "pending"], [5, "pending"], [6, "pending"],
        ]);

        const ended = edit(cancelledSingle, 4, "this_and_next", { status: "cancelled" }, "cancelled-revision");
        expect(project(ended).map((item) => [item.occurrenceNumber, item.status])).toEqual([
            [1, "pending"], [2, "cancelled"], [3, "pending"], [4, "cancelled"],
        ]);
        expect(ended.ledgerEntries).toHaveLength(0);
        expect(() => materializeOccurrence(ended, id(5))).toThrow();
    });

    it("retains each card occurrence's invoice on metadata edits", () => {
        const cardGroup = { ...group, creditCardId: fixtureCard.id };
        const rows = [1, 2, 3].map((number) => fixtureTransaction({ id: id(number), occurrenceNumber: number,
            scheduledDate: `2026-0${number}-05`, invoiceId: `invoice-${fixtureCard.id}-2026-0${number}`, commitment: "forecast" }));
        const snapshot = fixtureSnapshot([cardGroup], rows);
        const updated = edit(snapshot, 1, "all", { description: "Renamed" });
        expect(updated.transactions.map((item) => item.invoiceId)).toEqual(rows.map((item) => item.invoiceId));
    });

    it("preserves individual metadata overrides when only the series date changes", () => {
        const first = edit(empty(), 2, "single", { description: "Special February", notes: "Receipt note", amount: 125 });
        const second = edit(first, 3, "single", { description: "Special March", notes: "Different note", amount: 135 });
        const updated = edit(second, 2, "this_and_next", { scheduledDate: "2026-02-20", description: "Special February", notes: "Receipt note", amount: 125 });
        expect(updated.transactions.map((item) => [item.title, item.notes, item.amount])).toEqual([
            ["Special February", "Receipt note", 125], ["Special March", "Different note", 135],
        ]);
        const newRule = updated.transactionGroups.find((item) => item.id === "revision")!;
        expect(newRule.title).toBe(group.title);
        expect(newRule.recurrenceRule!.amount).toBe(100);
        expect(project(updated).find((item) => item.occurrenceNumber === 4)?.amount).toBe(100);
    });

    it("pays a mixed wallet batch today once, retaining dates and series identities", () => {
        const incomeGroup = fixtureGroup({ id: "income", type: "income" });
        const income = fixtureTransaction({ id: "income-tx", groupId: incomeGroup.id, scheduledDate: "2026-02-15" });
        const snapshot = fixtureSnapshot([group, incomeGroup], [income]);
        const draft = { transactionIds: [id(2), income.id, id(2)], status: "paid" as const };
        const paid = updateTransactionsBulkSnapshot(snapshot, draft, now);
        const repeated = updateTransactionsBulkSnapshot(paid, draft, "2026-03-06T12:00:00Z");
        expect(repeated.transactions.map((item) => item.scheduledDate)).toEqual(["2026-02-15", "2026-02-28"]);
        expect(repeated.transactions.every((item) => item.paidAt === now)).toBe(true);
        expect(repeated.ledgerEntries).toHaveLength(2);
        expect(repeated.ledgerEntries.reduce((sum, item) => sum + item.amount, 0)).toBe(0);
        expect(repeated.transactionGroups).toHaveLength(2);
    });

    it("settles only the selected recurring occurrence on today's date", () => {
        const paid = updateTransactionsBulkSnapshot(empty(), { transactionIds: [id(2)], status: "paid", settleToday: true }, now);
        expect(paid.transactions).toHaveLength(1);
        expect(paid.transactions[0]).toMatchObject({ occurrenceNumber: 2, scheduledDate: "2026-03-05", status: "paid", paidAt: now });
        expect(project(paid).map((item) => [item.occurrenceNumber, item.scheduledDate])).toEqual([
            [1, "2026-01-31"], [2, "2026-03-05"], [3, "2026-03-31"], [4, "2026-04-30"], [5, "2026-05-31"], [6, "2026-06-30"],
        ]);
    });

    it("confirms one card occurrence without confirming future occurrences", () => {
        const cardGroup = { ...group, sourceWalletId: null, creditCardId: fixtureCard.id };
        const snapshot = fixtureSnapshot([cardGroup], []);
        const confirmed = updateTransactionSeriesSnapshot({
            snapshot: materializeOccurrence(snapshot, id(2)), transactionId: id(2), scope: "single",
            draft: { commitment: "posted" }, now, wasProjected: true,
        }).snapshot;
        expect(confirmed.transactions[0]).toMatchObject({ occurrenceNumber: 2, commitment: "posted" });
        expect(project(confirmed).filter((item) => item.occurrenceNumber !== 2).every((item) => item.commitment === "forecast")).toBe(true);
    });

    it("keeps card commitment individual even when other edits use a series scope", () => {
        const cardGroup = { ...group, sourceWalletId: null, creditCardId: fixtureCard.id };
        const rows = [1, 2, 3].map((number) => fixtureTransaction({
            id: id(number), occurrenceNumber: number, scheduledDate: `2026-0${number}-05`, commitment: "forecast",
            invoiceId: `invoice-${fixtureCard.id}-2026-0${number}`,
        }));
        const confirmed = updateTransactionSeriesSnapshot({
            snapshot: fixtureSnapshot([cardGroup], rows), transactionId: id(1), scope: "all",
            draft: { commitment: "posted" }, now, createGroupId: () => "commitment-revision",
        }).snapshot;
        expect(confirmed.transactions.map((item) => item.commitment)).toEqual(["posted", "forecast", "forecast"]);
    });

    it("moves one card occurrence to a wallet without detaching its identity or changing later card forecasts", () => {
        const snapshot = fixtureSnapshot([{ ...group, creditCardId: fixtureCard.id }], []);
        const updated = edit(snapshot, 2, "single", { paymentMethod: "wallet", creditCardId: null });
        expect(updated.transactions).toHaveLength(1);
        const override = updated.transactions[0];
        expect(override).toMatchObject({ id: id(2), occurrenceNumber: 2, creditCardId: null, invoiceId: null });
        const overrideGroup = updated.transactionGroups.find((item) => item.id === override.groupId)!;
        expect(overrideGroup.creditCardId).toBeNull();
        expect(overrideGroup.recurrenceRule).toMatchObject({ seriesId: group.id, startNumber: 2, stopNumber: 1 });
        const projected = project(updated);
        expect(projected).toHaveLength(6);
        expect(projected.filter((item) => item.isProjected).every((item) => item.invoiceId?.includes(fixtureCard.id))).toBe(true);
    });
});
