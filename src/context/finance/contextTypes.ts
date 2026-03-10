import type { User } from "firebase/auth";
import type {
    Beneficiary,
    Category,
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
    deleteTransaction: (transaction: Transaction) => Promise<void>;
    clearTransactions: () => Promise<void>;
    addWallet: (newWallet: Wallet) => Promise<void>;
    addBeneficiary: (newBeneficiary: Beneficiary) => Promise<void>;
    addCategory: (newCategory: Category) => Promise<void>;
    addTag: (newTag: Tag) => Promise<void>;
}

export interface FinanceContextType extends FinanceActionsValue {
    user: User | null;
    loading: boolean;
    finance: FinanceSnapshot | null;
    favoriteWalletId: string;
    wallets: Wallet[];
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
}

export interface FinanceStoreValue extends FinanceActionsValue {
    user: User | null;
    loading: boolean;
    favoriteWalletId: string;
    wallets: Wallet[];
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
