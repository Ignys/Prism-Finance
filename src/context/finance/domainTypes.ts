import type { RecurrenceRule } from "./recurrence/types";
import type { WishItemPriority } from "../../lib/wishlistPriority";

export type TransactionType = "income" | "spending" | "transfer";
export type TransactionGroupType = "income" | "expense" | "transfer";
export type TransactionMode = "single" | "installment" | "recurring";
export type TransactionStatus = "pending" | "paid" | "cancelled" | "skipped";
export type PaymentMethod = "wallet" | "credit_card";
export type TransactionSystemKind = "invoice_payment";
export type TransactionSeriesScope = "single" | "this_and_next" | "all";
export type InvoiceStatus = "open" | "paid";
export type WalletType = "checking" | "savings" | "cash" | "investment";
export type BeneficiaryType = "person" | "cost_center" | "pet" | "other";
export type BeneficiarySource = "personal" | "family_shared";
export type CategoryType = "income" | "expense";
export type { WishItemPriority };

export interface TransactionEntity {
    id: string;
    groupId: string;
    type: TransactionType;
    value: number;
    date: string;
    inWallet: string;
    destinationWalletId: string | null;
    categoryId: string | null;
    beneficiaryId: string | null;
    tagIds: string[];
    description: string;
    status: TransactionStatus;
    installmentNumber: number | null;
    occurrenceNumber?: number | null;
    isProjected?: boolean;
    commitment?: "forecast" | "posted";
    invoiceId: string | null;
    paymentMethod: PaymentMethod;
    creditCardId: string | null;
    systemKind: TransactionSystemKind | null;
    paymentForInvoiceId?: string | null;
    isNonCashSettlement?: boolean;
    invoicePaymentMeta: InvoicePaymentMeta | null;
    meta: {
        criado_em: string;
        atualizado_em: string | null;
    };
}

export interface ResolvedTransactionCategory {
    id: string | null;
    label: string;
    parentLabel: string | null;
    icon: string;
    color: string | null;
    type: CategoryType;
}

export interface TransactionListItem extends TransactionEntity {
    category: ResolvedTransactionCategory;
    beneficiary: string;
    tags: Tag[];
}

export type Transaction = TransactionListItem;

export interface StoredTransaction {
    /** When set, nullable routing fields are explicit rather than inherited. */
    routingOverride?: boolean;
    id: string;
    groupId: string;
    installmentNumber: number | null;
    occurrenceNumber?: number | null;
    isProjected?: boolean;
    commitment?: "forecast" | "posted";
    amount: number;
    scheduledDate: string;
    status: TransactionStatus;
    paidAt: string | null;
    invoiceId: string | null;
    paymentForInvoiceId?: string | null;
    notes: string | null;
    title: string | null;
    categoryId: string | null;
    beneficiaryId: string | null;
    sourceWalletId: string | null;
    destinationWalletId: string | null;
    creditCardId: string | null;
    createdAt: string;
}

export interface TransactionGroup {
    id: string;
    userId: string | null;
    beneficiaryId: string | null;
    beneficiaryName: string;
    categoryId: string | null;
    categoryName: string;
    subcategoryName: string | null;
    title: string;
    notes: string | null;
    type: TransactionGroupType;
    transactionMode: TransactionMode;
    totalAmount: number;
    installmentCount: number | null;
    recurrenceRule: RecurrenceRule | null;
    recurrenceEndDate: string | null;
    sourceWalletId: string | null;
    destinationWalletId: string | null;
    creditCardId: string | null;
    createdAt: string;
}

export interface LedgerEntry {
    id: string;
    walletId: string;
    transactionId: string | null;
    invoiceId: string | null;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

export interface CreditCard {
    id: string;
    name: string;
    icon: string;
    color: string;
    limit: number;
    closingDay: number;
    dueDay: number;
    bankWalletId: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface CreditCardInvoice {
    id: string;
    creditCardId: string;
    cycleKey: string;
    closingDate: string;
    dueDate: string;
    /** Posted charges only; forecasts are a separate read projection. */
    totalAmount: number;
    forecastAmount?: number;
    paidAmount: number;
    status: InvoiceStatus;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Wallet {
    id: string;
    name: string;
    icon: string;
    type: WalletType;
    balance: number;
    initialBalance: number;
    currency: string;
    color: string;
    isActive: boolean;
    includeInMainTotals: boolean;
    createdAt: string;
}

export interface Beneficiary {
    id: string;
    userId: string | null;
    familyId: string | null;
    source: BeneficiarySource;
    isSelfProfile: boolean;
    name: string;
    type: BeneficiaryType;
    avatarColor: string | null;
    avatarImage: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
}

export interface Category {
    id: string;
    userId: string | null;
    parentId: string | null;
    name: string;
    type: CategoryType;
    icon: string;
    color: string | null;
    isActive: boolean;
    isSystem: boolean;
    sortOrder: number;
    createdAt: string;
}

export interface Tag {
    id: string;
    userId: string | null;
    name: string;
    color: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
}

export interface WishItem {
    id: string;
    userId: string | null;
    value: number;
    categoryId: string;
    priority: WishItemPriority;
    description: string;
    link: string | null;
    imageUrl: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface TransactionTag {
    transactionId: string;
    tagId: string;
}

export interface PlanningSimulatedExpense {
    id: string;
    monthKey: string;
    description: string;
    amount: number;
    createdAt: string;
}

export interface PlanningSimulatedIncome {
    id: string;
    monthKey: string;
    description: string;
    amount: number;
    createdAt: string;
}

export interface PlanningWishlistSelection {
    id: string;
    wishItemId: string;
    monthKey: string;
    createdAt: string;
}

export interface PlanningRevenueOverride {
    monthKey: string;
    amount: number;
    updatedAt: string;
}

export interface ReportPeriod {
    startMonth: string;
    endMonth: string;
}

export interface PlanningState {
    simulatedExpenses: PlanningSimulatedExpense[];
    simulatedIncomes: PlanningSimulatedIncome[];
    wishlistSelections: PlanningWishlistSelection[];
    revenueOverrides: PlanningRevenueOverride[];
    disabledInheritedExpenseIds: string[];
    disabledIncomeIds: string[];
    disabledSimulatedExpenseIds: string[];
    disabledSimulatedIncomeIds: string[];
    timelineSelectedWalletIds: string[];
    timelineCompareMode: boolean;
    timelineHorizontalMode: boolean;
    timelineMonthCount: 3 | 6 | 9 | 12;
    reportsSelectedWalletIds: string[];
    reportsSelectedCreditCardIds: string[];
    reportsPeriod: ReportPeriod;
}

export interface FinanceSnapshot {
    despesas: number;
    receitas: number;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    favoriteCreditCardId: string | null;
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    ledgerEntries: LedgerEntry[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    tags: Tag[];
    wishItems: WishItem[];
    transactionTags: TransactionTag[];
    planning: PlanningState;
}

export interface TransactionDraft {
    id?: string;
    type?: TransactionType | TransactionGroupType;
    value?: number;
    amount?: number;
    date?: string;
    scheduledDate?: string;
    inWallet?: string;
    walletId?: string;
    destinationWalletId?: string | null;
    paymentMethod?: PaymentMethod;
    creditCardId?: string | null;
    invoiceId?: string | null;
    categoryId?: string | null;
    category?: {
        principal?: string;
        sub?: string | null;
    };
    beneficiaryId?: string | null;
    beneficiary?: string;
    tagIds?: string[];
    description?: string;
    status?: TransactionStatus | boolean;
    notes?: string;
    groupId?: string;
    transactionMode?: TransactionMode;
    installmentCount?: number | null;
    ignoredInstallmentsCount?: number | null;
    commitment?: "forecast" | "posted";
    recurrenceRule?: Partial<RecurrenceRule> | null;
    recurrenceEndDate?: string | null;
}


export interface InvoicePaymentMeta {
    invoiceId: string;
    creditCardId: string;
}
