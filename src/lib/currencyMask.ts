export function extractCurrencyDigits(value: string): string {
    return value.replace(/\D/g, "");
}

export function formatCurrencyFromDigits(digits: string): string {
    const normalizedDigits = digits.replace(/^0+(?=\d)/, "") || "0";
    const centsValue = Number(normalizedDigits);

    if (!Number.isFinite(centsValue)) {
        return "R$ 0,00";
    }

    const currencyValue = centsValue / 100;
    const formatted = currencyValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `R$ ${formatted}`;
}

export function parseCurrencyDigitsToNumber(digits: string): number {
    const normalizedDigits = digits.replace(/^0+(?=\d)/, "") || "0";
    const centsValue = Number(normalizedDigits);
    if (!Number.isFinite(centsValue)) {
        return 0;
    }

    return centsValue / 100;
}
