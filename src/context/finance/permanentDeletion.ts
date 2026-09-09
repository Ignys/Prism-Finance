import { parseInvoicePaymentNote, type Beneficiary, type Category, type CreditCard, type CreditCardInvoice, type LedgerEntry, type StoredTransaction, type Tag, type TransactionGroup, type TransactionTag, type Wallet, type WishItem } from "./financeCore";
import { excludeRemovedOccurrences } from "./recurrence/excludeRemovedOccurrences";

interface TransactionPruneParams {
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
    shouldRemoveGroup: (group: TransactionGroup) => boolean;
    shouldRemoveTransaction?: (transaction: StoredTransaction) => boolean;
}

interface TransactionPruneResult {
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
}

interface PermanentlyDeleteWalletParams {
    walletId: string;
    wallets: Wallet[];
    creditCards: CreditCard[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
}

interface PermanentlyDeleteCreditCardParams {
    creditCardId: string;
    creditCards: CreditCard[];
    creditCardInvoices: CreditCardInvoice[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    transactionTags: TransactionTag[];
    ledgerEntries: LedgerEntry[];
}

interface PermanentlyDeleteBeneficiaryParams {
    beneficiaryId: string;
    beneficiaries: Beneficiary[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    fallbackBeneficiary: Beneficiary;
}

interface PermanentlyDeleteCategoryParams {
    categoryId: string;
    categories: Category[];
    transactionGroups: TransactionGroup[];
    transactions: StoredTransaction[];
    wishItems: WishItem[];
    fallbackCategory: Category;
}

interface PermanentlyDeleteTagParams {
    tagId: string;
    tags: Tag[];
    transactionTags: TransactionTag[];
    transactionGroups: TransactionGroup[];
}

function normalizeComparisonText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase();
}

function pruneTransactionsAndRelatedData(params: TransactionPruneParams): TransactionPruneResult {
    const targetGroupIds = new Set(params.transactionGroups.filter(params.shouldRemoveGroup).map((group) => group.id));
    const removedTransactionIds = new Set(
        params.transactions
            .filter((transaction) => targetGroupIds.has(transaction.groupId) || params.shouldRemoveTransaction?.(transaction) === true)
            .map((transaction) => transaction.id),
    );

    const nextTransactions = params.transactions.filter((transaction) => !removedTransactionIds.has(transaction.id));
    const nextTransactionGroups = excludeRemovedOccurrences(
        params.transactionGroups.filter((group) => !targetGroupIds.has(group.id)),
        params.transactions.filter((transaction) => removedTransactionIds.has(transaction.id)), params.transactionGroups,
    );

    return {
        transactionGroups: nextTransactionGroups,
        transactions: nextTransactions,
        transactionTags: params.transactionTags.filter((item) => !removedTransactionIds.has(item.transactionId)),
        ledgerEntries: params.ledgerEntries.filter((entry) => !entry.transactionId || !removedTransactionIds.has(entry.transactionId)),
    };
}

export function collectCategoryDescendantIds(categories: Category[], rootId: string): Set<string> {
    const descendants = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
        const currentParentId = queue.shift();
        if (!currentParentId) {
            continue;
        }

        categories.forEach((category) => {
            if (category.parentId === currentParentId && !descendants.has(category.id)) {
                descendants.add(category.id);
                queue.push(category.id);
            }
        });
    }

    return descendants;
}

export function permanentlyDeleteWalletData(params: PermanentlyDeleteWalletParams) {
    const nextWallets = params.wallets.filter((wallet) => wallet.id !== params.walletId);
    const nextCreditCards = params.creditCards.map((card) => (card.bankWalletId === params.walletId ? { ...card, bankWalletId: null } : card));
    const pruned = pruneTransactionsAndRelatedData({
        transactionGroups: params.transactionGroups,
        transactions: params.transactions,
        transactionTags: params.transactionTags,
        ledgerEntries: params.ledgerEntries,
        shouldRemoveGroup: (group) => group.sourceWalletId === params.walletId || group.destinationWalletId === params.walletId ||
            group.recurrenceRule?.sourceWalletId === params.walletId || group.recurrenceRule?.destinationWalletId === params.walletId,
        shouldRemoveTransaction: (transaction) =>
            transaction.sourceWalletId === params.walletId || transaction.destinationWalletId === params.walletId,
    });

    return {
        wallets: nextWallets,
        creditCards: nextCreditCards,
        transactionGroups: pruned.transactionGroups,
        transactions: pruned.transactions,
        transactionTags: pruned.transactionTags,
        ledgerEntries: pruned.ledgerEntries.filter((entry) => entry.walletId !== params.walletId),
    };
}

export function permanentlyDeleteCreditCardData(params: PermanentlyDeleteCreditCardParams) {
    const nextCreditCards = params.creditCards.filter((card) => card.id !== params.creditCardId);
    const removedInvoiceIds = new Set(
        params.creditCardInvoices
            .filter((invoice) => invoice.creditCardId === params.creditCardId)
            .map((invoice) => invoice.id),
    );
    const nextCreditCardInvoices = params.creditCardInvoices.filter((invoice) => invoice.creditCardId !== params.creditCardId);
    const pruned = pruneTransactionsAndRelatedData({
        transactionGroups: params.transactionGroups,
        transactions: params.transactions,
        transactionTags: params.transactionTags,
        ledgerEntries: params.ledgerEntries,
        shouldRemoveGroup: (group) => group.creditCardId === params.creditCardId || group.recurrenceRule?.creditCardId === params.creditCardId,
        shouldRemoveTransaction: (transaction) =>
            transaction.creditCardId === params.creditCardId ||
            (transaction.paymentForInvoiceId !== null &&
                transaction.paymentForInvoiceId !== undefined &&
                removedInvoiceIds.has(transaction.paymentForInvoiceId)) ||
            parseInvoicePaymentNote(transaction.notes)?.creditCardId === params.creditCardId,
    });

    return {
        creditCards: nextCreditCards,
        creditCardInvoices: nextCreditCardInvoices,
        transactionGroups: pruned.transactionGroups,
        transactions: pruned.transactions,
        transactionTags: pruned.transactionTags,
        ledgerEntries: pruned.ledgerEntries,
    };
}

export function permanentlyDeleteBeneficiaryData(params: PermanentlyDeleteBeneficiaryParams) {
    const nextBeneficiaries = params.beneficiaries.filter((beneficiary) => beneficiary.id !== params.beneficiaryId);
    const nextTransactionGroups = params.transactionGroups.map((group) => {
        if (group.beneficiaryId !== params.beneficiaryId) {
            return group;
        }

        return {
            ...group,
            beneficiaryId: params.fallbackBeneficiary.id,
            beneficiaryName: params.fallbackBeneficiary.name,
        };
    });
    const nextTransactions = params.transactions.map((transaction) =>
        transaction.beneficiaryId === params.beneficiaryId
            ? { ...transaction, beneficiaryId: params.fallbackBeneficiary.id }
            : transaction,
    );

    return {
        beneficiaries: nextBeneficiaries,
        transactionGroups: nextTransactionGroups,
        transactions: nextTransactions,
    };
}

export function permanentlyDeleteCategoryData(params: PermanentlyDeleteCategoryParams) {
    const affectedCategoryIds = collectCategoryDescendantIds(params.categories, params.categoryId);
    affectedCategoryIds.add(params.categoryId);

    const nextCategories = params.categories.filter((category) => !affectedCategoryIds.has(category.id));
    const nextTransactionGroups = params.transactionGroups.map((group) => {
        if (!group.categoryId || !affectedCategoryIds.has(group.categoryId)) {
            return group;
        }

        return {
            ...group,
            categoryId: params.fallbackCategory.id,
            categoryName: params.fallbackCategory.name,
            subcategoryName: null,
        };
    });
    const nextTransactions = params.transactions.map((transaction) =>
        transaction.categoryId && affectedCategoryIds.has(transaction.categoryId)
            ? { ...transaction, categoryId: params.fallbackCategory.id }
            : transaction,
    );
    const nextWishItems = params.wishItems.map((wishItem) =>
        affectedCategoryIds.has(wishItem.categoryId)
            ? { ...wishItem, categoryId: params.fallbackCategory.id }
            : wishItem,
    );

    return {
        categories: nextCategories,
        transactionGroups: nextTransactionGroups,
        transactions: nextTransactions,
        wishItems: nextWishItems,
    };
}

export function findUncategorizedRootCategory(categories: Category[], type: Category["type"]): Category | null {
    const targetName = normalizeComparisonText("Sem categoria");
    return (
        categories.find(
            (category) => category.type === type && category.parentId === null && normalizeComparisonText(category.name) === targetName,
        ) ?? null
    );
}

export function permanentlyDeleteTagData(params: PermanentlyDeleteTagParams) {
    const nextTags = params.tags.filter((tag) => tag.id !== params.tagId);
    const nextTransactionTags = params.transactionTags.filter((item) => item.tagId !== params.tagId);
    const nextTransactionGroups = params.transactionGroups.map((group) => {
        const rule = group.recurrenceRule;
        if (!rule || typeof rule !== "object" || !Array.isArray(rule.tagIds)) {
            return group;
        }

        const nextTagIds = rule.tagIds.filter((value): value is string => typeof value === "string" && value !== params.tagId);
        if (nextTagIds.length === rule.tagIds.length) {
            return group;
        }

        return {
            ...group,
            recurrenceRule: {
                ...rule,
                tagIds: nextTagIds,
            },
        };
    });

    return {
        tags: nextTags,
        transactionTags: nextTransactionTags,
        transactionGroups: nextTransactionGroups,
    };
}
