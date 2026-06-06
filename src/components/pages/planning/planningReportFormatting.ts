import { roundToCents } from "./planningReportsUtils";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function formatReportCurrency(value: number): string {
    return currencyFormatter.format(roundToCents(value));
}

export function formatReportPercent(value: number | null): string {
    return value === null ? "--" : `${roundToCents(value).toFixed(1)}%`;
}
