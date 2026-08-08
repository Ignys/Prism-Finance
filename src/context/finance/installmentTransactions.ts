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
    return splitAmountAcrossInstallments(totalAmount, installmentCount).map((amount, index) => ({
        installmentNumber: index + 1,
        amount,
        scheduledDate: advanceDatesMonthly ? addMonthsToLocalDate(startDate, index) : startDate,
        status: index < ignoredInstallmentsCount ? "skipped" : index === ignoredInstallmentsCount ? initialStatus : "pending",
    }));
}
