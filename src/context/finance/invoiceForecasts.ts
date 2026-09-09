import type { CreditCard, CreditCardInvoice, Transaction } from "./domainTypes";
import { resolveCreditCardInvoiceCycleFromCycleKey, parseCreditCardInvoiceId } from "./financeCore";
import { roundToCents } from "./helpers";

/** Forecast amounts never participate in open debt, payments or available limit. */
export function projectInvoiceForecasts(invoices: CreditCardInvoice[], transactions: Transaction[], cards: CreditCard[]): CreditCardInvoice[] {
    const byId = new Map(invoices.map((invoice) => [invoice.id, { ...invoice, forecastAmount: 0 }]));
    for (const transaction of transactions) {
        if (transaction.commitment !== "forecast" || transaction.paymentMethod !== "credit_card" || transaction.status !== "pending" || !transaction.invoiceId) continue;
        const parsed = byId.get(transaction.invoiceId) ?? parseCreditCardInvoiceId(transaction.invoiceId);
        const card = cards.find((item) => item.id === parsed?.creditCardId);
        if (!parsed || !card) continue;
        const existing = byId.get(transaction.invoiceId) ?? [...byId.values()].find((invoice) => invoice.creditCardId === card.id && invoice.cycleKey === parsed.cycleKey);
        if (existing?.status === "paid") continue;
        const invoice = existing ?? {
            id: transaction.invoiceId, creditCardId: card.id,
            ...resolveCreditCardInvoiceCycleFromCycleKey(parsed.cycleKey, card.closingDay, card.dueDay),
            totalAmount: 0, paidAmount: 0, forecastAmount: 0, status: "open" as const, paidAt: null,
            createdAt: transaction.meta.criado_em, updatedAt: transaction.meta.criado_em,
        };
        byId.set(invoice.id, { ...invoice, forecastAmount: roundToCents(invoice.forecastAmount + transaction.value) });
    }
    return [...byId.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
