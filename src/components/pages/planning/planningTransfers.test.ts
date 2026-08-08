import { describe, expect, it } from "vitest";
import type { PlanningState, Transaction, Wallet } from "../../../context/FinanceContext";
import { buildTimelineProjection, getCurrentMonthKey } from "./planningTimelineUtils";
import { getScopedTransactions } from "./planningWalletScope";

const SOURCE_WALLET_ID = "wallet-source";
const DESTINATION_WALLET_ID = "wallet-destination";

function makeWallet(id: string, name: string): Wallet {
    return {
        id,
        name,
        icon: "wallet",
        type: "checking",
        balance: 0,
        initialBalance: 0,
        currency: "BRL",
        color: "#ffffff",
        isActive: true,
        includeInMainTotals: true,
        createdAt: "2026-01-01T12:00:00.000Z",
    };
}

function makeTransfer(monthKey: string): Transaction {
    return {
        id: "transfer-1",
        groupId: "transfer-group-1",
        type: "transfer",
        value: 250,
        date: `${monthKey}-15`,
        inWallet: SOURCE_WALLET_ID,
        destinationWalletId: DESTINATION_WALLET_ID,
        categoryId: null,
        beneficiaryId: null,
        tagIds: [],
        description: "Reserva mensal",
        status: "pending",
        installmentNumber: null,
        invoiceId: null,
        paymentMethod: "wallet",
        creditCardId: null,
        systemKind: null,
        invoicePaymentMeta: null,
        category: {
            id: null,
            label: "Transferência",
            parentLabel: null,
            icon: "arrow-right-left",
            color: null,
            type: "expense",
        },
        beneficiary: "",
        tags: [],
        meta: {
            criado_em: "2026-01-01T12:00:00.000Z",
            atualizado_em: null,
        },
    };
}

function makePlanningState(): PlanningState {
    return {
        simulatedExpenses: [],
        simulatedIncomes: [],
        wishlistSelections: [],
        revenueOverrides: [],
        disabledInheritedExpenseIds: [],
        disabledIncomeIds: [],
        disabledSimulatedExpenseIds: [],
        disabledSimulatedIncomeIds: [],
        timelineSelectedWalletIds: [],
        timelineCompareMode: true,
        timelineHorizontalMode: false,
        timelineMonthCount: 3,
        reportsSelectedWalletIds: [],
        reportsSelectedCreditCardIds: [],
        reportsPeriod: {
            startMonth: "2026-01",
            endMonth: "2026-12",
        },
    };
}

function projectTransfer(wallets: Wallet[], selectedWalletIds: string[]) {
    const monthKey = getCurrentMonthKey();
    const transfer = makeTransfer(monthKey);
    const scopedTransactions = getScopedTransactions([transfer], selectedWalletIds, [], false);

    return buildTimelineProjection({
        wallets,
        creditCards: [],
        creditCardInvoices: [],
        transactions: scopedTransactions,
        ledgerEntries: [],
        wishItems: [],
        planning: makePlanningState(),
        monthsToShow: 3,
    }).months[0];
}

describe("transferências no planejamento mensal", () => {
    const sourceWallet = makeWallet(SOURCE_WALLET_ID, "Origem");
    const destinationWallet = makeWallet(DESTINATION_WALLET_ID, "Destino");

    it("mostra uma despesa na carteira de origem", () => {
        const month = projectTransfer([sourceWallet], [SOURCE_WALLET_ID]);

        expect(month.originalIncome).toBe(0);
        expect(month.inheritedExpenses).toBe(250);
        expect(month.originalMonthBalance).toBe(-250);
        expect(month.inheritedItems).toMatchObject([
            {
                id: "transfer:transfer-1",
                source: "transfer",
                iconName: "arrow-right-left",
            },
        ]);
    });

    it("mostra uma receita na carteira de destino", () => {
        const month = projectTransfer([destinationWallet], [DESTINATION_WALLET_ID]);

        expect(month.originalIncome).toBe(250);
        expect(month.inheritedExpenses).toBe(0);
        expect(month.originalMonthBalance).toBe(250);
        expect(month.incomeItems).toMatchObject([
            {
                id: "income-transfer:transfer-1",
                source: "transfer",
                iconName: "arrow-right-left",
            },
        ]);
    });

    it("exibe os dois lados sem alterar o saldo quando ambas as carteiras estão selecionadas", () => {
        const month = projectTransfer([sourceWallet, destinationWallet], [SOURCE_WALLET_ID, DESTINATION_WALLET_ID]);

        expect(month.originalIncome).toBe(250);
        expect(month.inheritedExpenses).toBe(250);
        expect(month.originalMonthBalance).toBe(0);
        expect(month.incomeItems).toHaveLength(1);
        expect(month.inheritedItems).toHaveLength(1);
    });
});
