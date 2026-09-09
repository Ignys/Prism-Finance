import { normalizeComparisonText } from "../../context/finance/helpers";
import type { CreditCardInvoice } from "../../context/finance/domainTypes";

interface InvoiceSearchOption {
    invoice: CreditCardInvoice;
    monthLabel: string;
    cycleKey: string;
    searchText: string;
}

export function filterInvoiceOption(option: InvoiceSearchOption, query: string): boolean {
    const search = normalizeComparisonText(query.trim());
    if (option.invoice.status === "paid") {
        // Searching "paga" is not a request for a particular month/cycle.
        return search.length >= 3 && !/^\d{4}$/.test(search) && normalizeComparisonText(`${option.monthLabel} ${option.cycleKey}`).includes(search);
    }
    return !search || normalizeComparisonText(option.searchText).includes(search);
}

export function defaultInvoiceOption<T extends InvoiceSearchOption>(options: T[], preferredId?: string): T | undefined {
    const selectable = options.filter((option) => option.invoice.status !== "paid");
    return selectable.find((option) => option.invoice.id === preferredId) ?? selectable[0];
}
