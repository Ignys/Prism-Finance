import type { User } from "firebase/auth";
import type {
    Beneficiary,
    Category,
    CreditCard,
    CreditCardInvoice,
    FinanceSnapshot,
    LedgerEntry,
    StoredTransaction,
    Tag,
    Transaction,
    TransactionDraft,
    TransactionGroup,
    TransactionTag,
    Wallet,
} from "../financeTypes";

export interface PayCreditCardInvoiceDraft {
    invoiceId: string;
    walletId: string;
    amount: number;
    paymentDate: string;
}

export interface UpdateInvoicePaymentTransactionDraft {
    transactionId: string;
    description: string;
    beneficiaryId: string | null;
    date: string;
}

export interface FinanceSessionValue {
    user: User | null;
    loading: boolean;
}

export interface FinanceSummaryValue {
    despesas: number;
    receitas: number;
    balance: number;
}

export interface FinanceActionsValue {
    setStartBalance: (walletId: string, balance: number) => Promise<void>;
    setFavoriteWallet: (walletId: string) => Promise<void>;
    updateFinance: (newFinance: FinanceSnapshot) => Promise<void>;
    addTransaction: (newTransaction: TransactionDraft) => Promise<void>;
    markTransactionAsPaid: (transaction: Transaction) => Promise<void>;
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    updateInvoicePaymentTransaction: (draft: UpdateInvoicePaymentTransactionDraft) => Promise<void>;
    clearTransactions: () => Promise<void>;
    addWallet: (newWallet: Wallet) => Promise<void>;
    addBeneficiary: (newBeneficiary: Beneficiary) => Promise<void>;
    addCategory: (newCategory: Category) => Promise<void>;
    addTag: (newTag: Tag) => Promise<void>;
    reorderBeneficiaries: (beneficiaryIds: string[]) => Promise<void>;
    reorderCategories: (categoryIds: string[]) => Promise<void>;
    reorderTags: (tagIds: string[]) => Promise<void>;
    setBeneficiaryActive: (beneficiaryId: string, isActive: boolean) => Promise<void>;
    setCategoryActive: (categoryId: string, isActive: boolean) => Promise<void>;
    setTagActive: (tagId: string, isActive: boolean) => Promise<void>;
    addCreditCard: (newCreditCard: CreditCard) => Promise<void>;
    setFavoriteCreditCard: (creditCardId: string) => Promise<void>;
    payCreditCardInvoice: (draft: PayCreditCardInvoiceDraft) => Promise<void>;
}

export interface FinanceContextType extends FinanceActionsValue {
    user: User | null;
    loading: boolean;
    finance: FinanceSnapshot | null;
    favoriteWalletId: string;
    favoriteCreditCardId: string | null;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    tags: Tag[];
    transactions: Transaction[];
    despesas: number;
    receitas: number;
    balance: number;
}

export interface PersistFields {
    wallets?: Wallet[];
    transactionGroups?: TransactionGroup[];
    transactions?: StoredTransaction[];
    ledgerEntries?: LedgerEntry[];
    beneficiaries?: Beneficiary[];
    categories?: Category[];
    tags?: Tag[];
    transactionTags?: TransactionTag[];
    favoriteWalletId?: string;
    creditCards?: CreditCard[];
    creditCardInvoices?: CreditCardInvoice[];
    favoriteCreditCardId?: string | null;
}

export interface FinanceStoreValue extends FinanceActionsValue {
    user: User | null;
    loading: boolean;
    favoriteWalletId: string;
    favoriteCreditCardId: string | null;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    tags: Tag[];
    transactionGroups: TransactionGroup[];
    storedTransactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
    transactions: Transaction[];
    despesas: number;
    receitas: number;
    balance: number;
}
