const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

export function formatRegistryCurrency(value: number): string {
    return currencyFormatter.format(value);
}
