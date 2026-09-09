import { addMonthsToLocalDate } from "../../lib/localDate";
import type { TransactionDraft, TransactionGroup, TransactionMode, TransactionStatus } from "../financeTypes";
import { splitAmountAcrossInstallments } from "./helpers";

export interface InstallmentScheduleItem {
    installmentNumber: number;
    amount: number;
    scheduledDate: string;
    status: TransactionStatus;
}

interface BuildInstallmentScheduleOptions {
    totalAmount: number;
    installmentCount: number;
    startDate: string;
    initialStatus: TransactionStatus;
    ignoredInstallmentsCount?: number;
    advanceDatesMonthly: boolean;
}

export function resolveNewTransactionMode(
    groupType: TransactionGroup["type"],
    requestedMode: TransactionDraft["transactionMode"],
): TransactionMode {
    if (groupType === "transfer") {
        return "single";
    }

    return requestedMode === "installment" || requestedMode === "recurring" ? requestedMode : "single";
}

export function buildInstallmentSchedule({
    totalAmount,
    installmentCount,
    startDate,
    initialStatus,
    ignoredInstallmentsCount = 0,
    advanceDatesMonthly,
}: BuildInstallmentScheduleOptions): InstallmentScheduleItem[] {
    if (!Number.isInteger(installmentCount) || installmentCount < 2) throw new Error("Informe uma quantidade inteira de pelo menos duas parcelas.");
    if (!Number.isFinite(totalAmount) || Math.round(Math.abs(totalAmount) * 100) < installmentCount) {
        throw new Error("Cada parcela deve ter valor de pelo menos R$ 0,01.");
    }
    return splitAmountAcrossInstallments(totalAmount, installmentCount).map((amount, index) => ({
        installmentNumber: index + 1,
        amount,
        scheduledDate: advanceDatesMonthly ? addMonthsToLocalDate(startDate, index) : startDate,
        status: index < ignoredInstallmentsCount ? "skipped" : index === ignoredInstallmentsCount ? initialStatus : "pending",
    }));
}

export function normalizeIgnoredInstallmentsCount(value: unknown, installmentCount: number | null): number {
    if (!installmentCount || installmentCount < 2) {
        return 0;
    }

    const parsedValue = Number(value);
    const safeValue = Number.isFinite(parsedValue) ? Math.floor(parsedValue) : 0;
    return Math.max(0, Math.min(installmentCount - 1, safeValue));
}
