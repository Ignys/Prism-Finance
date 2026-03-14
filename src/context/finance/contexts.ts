import { Context, createContext, useContext } from "react";
import type {
    Beneficiary,
    Category,
    CreditCard,
    CreditCardInvoice,
    LedgerEntry,
    StoredTransaction,
    Tag,
    Transaction,
    TransactionGroup,
    TransactionTag,
    Wallet,
} from "../financeTypes";
import type { FinanceActionsValue, FinanceSessionValue, FinanceSummaryValue } from "./contextTypes";

export const FinanceSessionContext = createContext<FinanceSessionValue | undefined>(undefined);
export const FinanceFavoriteWalletContext = createContext<string | undefined>(undefined);
export const FinanceFavoriteCreditCardContext = createContext<string | null | undefined>(undefined);
export const FinanceWalletsContext = createContext<Wallet[] | undefined>(undefined);
export const FinanceCreditCardsContext = createContext<CreditCard[] | undefined>(undefined);
export const FinanceCreditCardInvoicesContext = createContext<CreditCardInvoice[] | undefined>(undefined);
export const FinanceBeneficiariesContext = createContext<Beneficiary[] | undefined>(undefined);
export const FinanceCategoriesContext = createContext<Category[] | undefined>(undefined);
export const FinanceTagsContext = createContext<Tag[] | undefined>(undefined);
export const FinanceTransactionGroupsContext = createContext<TransactionGroup[] | undefined>(undefined);
export const FinanceStoredTransactionsContext = createContext<StoredTransaction[] | undefined>(undefined);
export const FinanceTransactionTagsContext = createContext<TransactionTag[] | undefined>(undefined);
export const FinanceLedgerEntriesContext = createContext<LedgerEntry[] | undefined>(undefined);
export const FinanceTransactionsContext = createContext<Transaction[] | undefined>(undefined);
export const FinanceSummaryContext = createContext<FinanceSummaryValue | undefined>(undefined);
export const FinanceActionsContext = createContext<FinanceActionsValue | undefined>(undefined);

export function useRequiredContext<T>(context: Context<T | undefined>, hookName: string): T {
    const value = useContext(context);
    if (value === undefined) {
        throw new Error(`${hookName} must be used within a FinanceProvider`);
    }
    return value;
}
