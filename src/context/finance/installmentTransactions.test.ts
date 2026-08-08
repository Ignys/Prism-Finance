import { describe, expect, it } from "vitest";
import { buildInstallmentSchedule, resolveNewTransactionMode } from "./installmentTransactions";

describe("buildInstallmentSchedule", () => {
    it("divide o total em centavos e agenda parcelas mensais de carteira", () => {
        const schedule = buildInstallmentSchedule({
            totalAmount: 100,
            installmentCount: 3,
            startDate: "2026-01-31",
            initialStatus: "paid",
            advanceDatesMonthly: true,
        });

        expect(schedule).toEqual([
            { installmentNumber: 1, amount: 33.34, scheduledDate: "2026-01-31", status: "paid" },
            { installmentNumber: 2, amount: 33.33, scheduledDate: "2026-02-28", status: "pending" },
            { installmentNumber: 3, amount: 33.33, scheduledDate: "2026-03-31", status: "pending" },
        ]);
    });

    it("mantem a data-base para parcelas vinculadas a faturas", () => {
        const schedule = buildInstallmentSchedule({
            totalAmount: 60,
            installmentCount: 2,
            startDate: "2026-08-07",
            initialStatus: "pending",
            advanceDatesMonthly: false,
        });

        expect(schedule.map((item) => item.scheduledDate)).toEqual(["2026-08-07", "2026-08-07"]);
    });

    it("marca parcelas anteriores como ignoradas", () => {
        const schedule = buildInstallmentSchedule({
            totalAmount: 90,
            installmentCount: 3,
            startDate: "2026-06-15",
            initialStatus: "paid",
            ignoredInstallmentsCount: 1,
            advanceDatesMonthly: true,
        });

        expect(schedule.map((item) => item.status)).toEqual(["skipped", "paid", "pending"]);
    });
});

describe("resolveNewTransactionMode", () => {
    it("permite parcelamento de receitas e despesas", () => {
        expect(resolveNewTransactionMode("income", "installment")).toBe("installment");
        expect(resolveNewTransactionMode("expense", "installment")).toBe("installment");
    });

    it("mantem transferencias como transacoes unicas", () => {
        expect(resolveNewTransactionMode("transfer", "installment")).toBe("single");
    });
});
