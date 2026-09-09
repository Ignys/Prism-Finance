import type { Transaction } from "../../../context/finance/domainTypes";

/** Allocate whole cents by largest remainder, preserving the exact payment total. */
export function invoicePaymentContributions(payment: Transaction, invoiceTotal: number, purchases: Transaction[]) {
    const paymentCents = Math.round(payment.value * 100);
    if (paymentCents <= 0) return [];
    const weightedPurchases = purchases
        .map((purchase) => ({ purchase, weight: Math.round(purchase.value * 100) }))
        .filter(({ weight }) => weight > 0);
    const totalWeight = weightedPurchases.reduce((sum, entry) => sum + entry.weight, 0);
    if (invoiceTotal <= 0 || totalWeight === 0) return [{ purchase: payment, amount: paymentCents / 100 }];

    const contributions = weightedPurchases.map(({ purchase, weight }) => {
        const exactCents = paymentCents * weight / totalWeight;
        const cents = Math.floor(exactCents);
        return { purchase, cents, remainder: exactCents - cents };
    });
    const remainingCents = paymentCents - contributions.reduce((sum, entry) => sum + entry.cents, 0);
    const ranked = [...contributions].sort((left, right) => right.remainder - left.remainder || left.purchase.id.localeCompare(right.purchase.id));
    for (let index = 0; index < remainingCents; index++) ranked[index].cents += 1;
    return contributions.filter(({ cents }) => cents > 0).map(({ purchase, cents }) => ({ purchase, amount: cents / 100 }));
}
