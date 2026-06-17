import type { AppUser } from "../../auth/appUser";
import type { UserProfileData } from "../../lib/userProfile";
import type { FamilyInvite, FamilySummary, SharedWishlistSnapshot } from "../familyTypes";
import type {
    Beneficiary,
    Category,
    CreditCard,
    CreditCardInvoice,
    FinanceSnapshot,
    LedgerEntry,
    PlanningState,
    StoredTransaction,
    Tag,
    Transaction,
    TransactionDraft,
    TransactionGroup,
    TransactionSeriesScope,
    TransactionTag,
    WishItem,
    Wallet,
} from "../financeTypes";

export interface PayCreditCardInvoiceDraft {
    invoiceId: string;
    walletId: string;
    amount: number;
    paymentDate: string;
}

export interface SetCreditCardInvoicesPaidStateDraft {
    invoiceIds: string[];
    markAsPaid: boolean;
}

export interface UpdateInvoicePaymentTransactionDraft {
    transactionId: string;
    description: string;
    beneficiaryId: string | null;
    date: string;
}

export interface UpdateTransactionDraft {
    transaction: Transaction;
    draft: TransactionDraft;
    scope?: TransactionSeriesScope;
}

export interface FinanceSessionValue {
    user: AppUser | null;
    profile: UserProfileData | null;
    loading: boolean;
    family: FamilySummary | null;
    profileVersion: number;
}

export interface FinanceSummaryValue {
    despesas: number;
    receitas: number;
    balance: number;
}

export interface FinanceActionsValue {
    setStartBalance: (walletId: string, balance: number) => Promise<void>;
    setFavoriteWallet: (walletId: string) => Promise<void>;
    setWalletActive: (walletId: string, isActive: boolean) => Promise<void>;
    deleteWallet: (walletId: string) => Promise<void>;
    permanentlyDeleteWallet: (walletId: string) => Promise<void>;
    updateFinance: (newFinance: FinanceSnapshot) => Promise<void>;
    addTransaction: (newTransaction: TransactionDraft) => Promise<void>;
    updateTransaction: (draft: UpdateTransactionDraft) => Promise<void>;
    markTransactionAsPaid: (transaction: Transaction) => Promise<void>;
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    deleteTransactionWithScope: (transaction: Transaction, scope?: TransactionSeriesScope) => Promise<void>;
    updateInvoicePaymentTransaction: (draft: UpdateInvoicePaymentTransactionDraft) => Promise<void>;
    updatePlanningState: (planning: PlanningState) => Promise<void>;
    clearTransactions: () => Promise<void>;
    addWallet: (newWallet: Wallet) => Promise<void>;
    addBeneficiary: (newBeneficiary: Beneficiary) => Promise<void>;
    addCategory: (newCategory: Category) => Promise<void>;
    addTag: (newTag: Tag) => Promise<void>;
    addWishItem: (newWishItem: WishItem) => Promise<void>;
    reorderBeneficiaries: (beneficiaryIds: string[]) => Promise<void>;
    reorderCategories: (categoryIds: string[]) => Promise<void>;
    reorderTags: (tagIds: string[]) => Promise<void>;
    setBeneficiaryActive: (beneficiaryId: string, isActive: boolean) => Promise<void>;
    permanentlyDeleteBeneficiary: (beneficiaryId: string) => Promise<void>;
    setCategoryActive: (categoryId: string, isActive: boolean) => Promise<void>;
    permanentlyDeleteCategory: (categoryId: string) => Promise<void>;
    setTagActive: (tagId: string, isActive: boolean) => Promise<void>;
    permanentlyDeleteTag: (tagId: string) => Promise<void>;
    addCreditCard: (newCreditCard: CreditCard) => Promise<void>;
    setFavoriteCreditCard: (creditCardId: string) => Promise<void>;
    setCreditCardActive: (creditCardId: string, isActive: boolean) => Promise<void>;
    deleteCreditCard: (creditCardId: string) => Promise<void>;
    permanentlyDeleteCreditCard: (creditCardId: string) => Promise<void>;
    payCreditCardInvoice: (draft: PayCreditCardInvoiceDraft) => Promise<void>;
    setCreditCardInvoicesPaidState: (draft: SetCreditCardInvoicesPaidStateDraft) => Promise<void>;
    removeWishItem: (wishItemId: string) => Promise<void>;
    createFamily: (familyName?: string) => Promise<void>;
    generateFamilyInvite: () => Promise<FamilyInvite>;
    joinFamilyByCode: (code: string) => Promise<void>;
    removeFamilyMember: (memberUid: string) => Promise<void>;
}

export interface FinanceContextType extends FinanceActionsValue {
    user: AppUser | null;
    profile: UserProfileData | null;
    loading: boolean;
    profileVersion: number;
    family: FamilySummary | null;
    sharedWishlists: SharedWishlistSnapshot[];
    finance: FinanceSnapshot | null;
    favoriteWalletId: string;
    favoriteCreditCardId: string | null;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    tags: Tag[];
    wishItems: WishItem[];
    transactions: Transaction[];
    planning: PlanningState;
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
    beneficiaryOrder?: string[];
    categories?: Category[];
    tags?: Tag[];
    wishItems?: WishItem[];
    transactionTags?: TransactionTag[];
    favoriteWalletId?: string;
    creditCards?: CreditCard[];
    creditCardInvoices?: CreditCardInvoice[];
    favoriteCreditCardId?: string | null;
    planning?: PlanningState;
}

export interface FinanceStoreValue extends FinanceActionsValue {
    user: AppUser | null;
    profile: UserProfileData | null;
    loading: boolean;
    profileVersion: number;
    family: FamilySummary | null;
    sharedWishlists: SharedWishlistSnapshot[];
    favoriteWalletId: string;
    favoriteCreditCardId: string | null;
    wallets: Wallet[];
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    beneficiaries: Beneficiary[];
    categories: Category[];
    tags: Tag[];
    wishItems: WishItem[];
    transactionGroups: TransactionGroup[];
    storedTransactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
    transactions: Transaction[];
    planning: PlanningState;
    despesas: number;
    receitas: number;
    balance: number;
}
