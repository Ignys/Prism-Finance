import type { CreditCard, CreditCardInvoice } from "../financeTypes";
import { resolveCreditCardInvoiceCycle } from "../financeTypes";
import { getLocalTodayDate } from "../../lib/localDate";
import { roundToCents } from "./helpers";

export type CreditCardInvoiceVisualStatus = "paid" | "overdue" | "closed" | "open" | "future";

export interface CreditCardInvoiceReadState {
    openAmount: number;
    hasPendingBalance: boolean;
    visualStatus: CreditCardInvoiceVisualStatus;
}

type InvoiceLike = Pick<CreditCardInvoice, "status" | "cycleKey" | "closingDate" | "dueDate" | "totalAmount" | "paidAmount">;
type CreditCardCycleLike = Pick<CreditCard, "closingDay" | "dueDay">;

export function getCreditCardInvoiceOpenAmount(invoice: Pick<CreditCardInvoice, "totalAmount" | "paidAmount">): number {
    return roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount));
}

export function getCreditCardInvoiceReadState(
    invoice: InvoiceLike,
    creditCard: CreditCardCycleLike | null = null,
    referenceDate = new Date(),
): CreditCardInvoiceReadState {
    const openAmount = getCreditCardInvoiceOpenAmount(invoice);
    const hasPendingBalance = invoice.status !== "paid" && openAmount > 0;
    const today = getLocalTodayDate(referenceDate);

    if (invoice.status === "paid") {
        return {
            openAmount,
            hasPendingBalance,
            visualStatus: "paid",
        };
    }

    if (creditCard) {
        const currentOpenCycleKey = resolveCreditCardInvoiceCycle(today, creditCard.closingDay, creditCard.dueDay).cycleKey;
        const cycleComparison = invoice.cycleKey.localeCompare(currentOpenCycleKey);

        if (cycleComparison === 0) {
            return {
                openAmount,
                hasPendingBalance,
                visualStatus: today >= invoice.closingDate ? "closed" : "open",
            };
        }

        if (cycleComparison > 0) {
            return {
                openAmount,
                hasPendingBalance,
                visualStatus: "future",
            };
        }

        return {
            openAmount,
            hasPendingBalance,
            visualStatus: hasPendingBalance && today > invoice.dueDate ? "overdue" : "closed",
        };
    }

    if (hasPendingBalance && today > invoice.dueDate) {
        return {
            openAmount,
            hasPendingBalance,
            visualStatus: "overdue",
        };
    }

    if (today >= invoice.closingDate && today <= invoice.dueDate) {
        return {
            openAmount,
            hasPendingBalance,
            visualStatus: "closed",
        };
    }

    return {
        openAmount,
        hasPendingBalance,
        visualStatus: today < invoice.closingDate ? "open" : "closed",
    };
}
