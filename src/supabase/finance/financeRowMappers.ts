import type {
    Beneficiary,
    BeneficiarySource,
    BeneficiaryType,
    Category,
    CategoryType,
    CreditCard,
    CreditCardInvoice,
    InvoiceStatus,
    LedgerEntry,
    PlanningState,
    StoredTransaction,
    Tag,
    TransactionGroup,
    TransactionGroupType,
    TransactionMode,
    TransactionStatus,
    TransactionTag,
    Wallet,
    WalletType,
    WishItem,
    WishItemPriority,
} from "../../context/financeTypes";
import type {
    BeneficiaryRow,
    CategoryRow,
    CreditCardInvoiceRow,
    CreditCardRow,
    FinancePreferenceRow,
    LedgerEntryRow,
    TagRow,
    TransactionGroupRow,
    TransactionRow,
    TransactionTagRow,
    WalletRow,
    WishItemRow,
} from "./financeTables";

function toNumber(value: number | string): number {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function toPreferenceRow(params: {
    userId: string;
    favoriteWalletId: string | null;
    favoriteCreditCardId: string | null;
    planning: PlanningState;
}): FinancePreferenceRow {
    return {
        user_id: params.userId,
        favorite_wallet_id: params.favoriteWalletId,
        favorite_credit_card_id: params.favoriteCreditCardId,
        planning: params.planning,
        updated_at: new Date().toISOString(),
    };
}

export function toWalletRow(userId: string, wallet: Wallet): WalletRow {
    return {
        user_id: userId,
        id: wallet.id,
        name: wallet.name,
        icon: wallet.icon,
        type: wallet.type,
        balance: wallet.balance,
        initial_balance: wallet.initialBalance,
        currency: wallet.currency,
        color: wallet.color,
        is_active: wallet.isActive,
        include_in_main_totals: wallet.includeInMainTotals,
        created_at: wallet.createdAt,
    };
}

export function fromWalletRow(row: WalletRow): Wallet {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        type: row.type as WalletType,
        balance: toNumber(row.balance),
        initialBalance: toNumber(row.initial_balance),
        currency: row.currency,
        color: row.color,
        isActive: row.is_active,
        includeInMainTotals: row.include_in_main_totals,
        createdAt: row.created_at,
    };
}

export function toCreditCardRow(userId: string, creditCard: CreditCard): CreditCardRow {
    return {
        user_id: userId,
        id: creditCard.id,
        name: creditCard.name,
        icon: creditCard.icon,
        color: creditCard.color,
        credit_limit: creditCard.limit,
        closing_day: creditCard.closingDay,
        due_day: creditCard.dueDay,
        bank_wallet_id: creditCard.bankWalletId,
        is_active: creditCard.isActive,
        created_at: creditCard.createdAt,
    };
}

export function fromCreditCardRow(row: CreditCardRow): CreditCard {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        limit: toNumber(row.credit_limit),
        closingDay: row.closing_day,
        dueDay: row.due_day,
        bankWalletId: row.bank_wallet_id,
        isActive: row.is_active,
        createdAt: row.created_at,
    };
}

export function toBeneficiaryRow(userId: string, beneficiary: Beneficiary): BeneficiaryRow {
    return {
        user_id: userId,
        id: beneficiary.id,
        family_id: beneficiary.familyId,
        source: beneficiary.source,
        is_self_profile: beneficiary.isSelfProfile,
        name: beneficiary.name,
        type: beneficiary.type,
        avatar_color: beneficiary.avatarColor,
        avatar_image: beneficiary.avatarImage,
        is_active: beneficiary.isActive,
        sort_order: beneficiary.sortOrder,
        created_at: beneficiary.createdAt,
    };
}

export function fromBeneficiaryRow(row: BeneficiaryRow): Beneficiary {
    return {
        id: row.id,
        userId: row.user_id,
        familyId: row.family_id,
        source: row.source as BeneficiarySource,
        isSelfProfile: row.is_self_profile,
        name: row.name,
        type: row.type as BeneficiaryType,
        avatarColor: row.avatar_color,
        avatarImage: row.avatar_image,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
    };
}

export function toCategoryRow(userId: string, category: Category): CategoryRow {
    return {
        user_id: userId,
        id: category.id,
        parent_id: category.parentId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        is_active: category.isActive,
        is_system: category.isSystem,
        sort_order: category.sortOrder,
        created_at: category.createdAt,
    };
}

export function fromCategoryRow(row: CategoryRow): Category {
    return {
        id: row.id,
        userId: row.user_id,
        parentId: row.parent_id,
        name: row.name,
        type: row.type as CategoryType,
        icon: row.icon,
        color: row.color,
        isActive: row.is_active,
        isSystem: row.is_system,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
    };
}

export function toTagRow(userId: string, tag: Tag): TagRow {
    return {
        user_id: userId,
        id: tag.id,
        name: tag.name,
        color: tag.color,
        is_active: tag.isActive,
        sort_order: tag.sortOrder,
        created_at: tag.createdAt,
    };
}

export function fromTagRow(row: TagRow): Tag {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        color: row.color,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
    };
}

export function toWishItemRow(userId: string, wishItem: WishItem): WishItemRow {
    return {
        user_id: userId,
        id: wishItem.id,
        value: wishItem.value,
        category_id: wishItem.categoryId,
        priority: wishItem.priority,
        description: wishItem.description,
        link: wishItem.link,
        image_url: wishItem.imageUrl,
        is_active: wishItem.isActive,
        created_at: wishItem.createdAt,
    };
}

export function fromWishItemRow(row: WishItemRow): WishItem {
    return {
        id: row.id,
        userId: row.user_id,
        value: toNumber(row.value),
        categoryId: row.category_id,
        priority: row.priority as WishItemPriority,
        description: row.description,
        link: row.link,
        imageUrl: row.image_url,
        isActive: row.is_active,
        createdAt: row.created_at,
    };
}

export function toTransactionGroupRow(userId: string, group: TransactionGroup): TransactionGroupRow {
    return {
        user_id: userId,
        id: group.id,
        beneficiary_id: group.beneficiaryId,
        beneficiary_name: group.beneficiaryName,
        category_id: group.categoryId,
        category_name: group.categoryName,
        subcategory_name: group.subcategoryName,
        title: group.title,
        notes: group.notes,
        type: group.type,
        transaction_mode: group.transactionMode,
        total_amount: group.totalAmount,
        installment_count: group.installmentCount,
        recurrence_rule: group.recurrenceRule,
        recurrence_end_date: group.recurrenceEndDate,
        source_wallet_id: group.sourceWalletId,
        destination_wallet_id: group.destinationWalletId,
        credit_card_id: group.creditCardId,
        created_at: group.createdAt,
    };
}

export function fromTransactionGroupRow(row: TransactionGroupRow): TransactionGroup {
    return {
        id: row.id,
        userId: row.user_id,
        beneficiaryId: row.beneficiary_id,
        beneficiaryName: row.beneficiary_name,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subcategoryName: row.subcategory_name,
        title: row.title,
        notes: row.notes,
        type: row.type as TransactionGroupType,
        transactionMode: row.transaction_mode as TransactionMode,
        totalAmount: toNumber(row.total_amount),
        installmentCount: row.installment_count,
        recurrenceRule: toNullableRecord(row.recurrence_rule),
        recurrenceEndDate: row.recurrence_end_date,
        sourceWalletId: row.source_wallet_id,
        destinationWalletId: row.destination_wallet_id,
        creditCardId: row.credit_card_id,
        createdAt: row.created_at,
    };
}

export function toCreditCardInvoiceRow(userId: string, invoice: CreditCardInvoice): CreditCardInvoiceRow {
    return {
        user_id: userId,
        id: invoice.id,
        credit_card_id: invoice.creditCardId,
        cycle_key: invoice.cycleKey,
        closing_date: invoice.closingDate,
        due_date: invoice.dueDate,
        total_amount: invoice.totalAmount,
        paid_amount: invoice.paidAmount,
        status: invoice.status,
        paid_at: invoice.paidAt,
        created_at: invoice.createdAt,
        updated_at: invoice.updatedAt,
    };
}

export function fromCreditCardInvoiceRow(row: CreditCardInvoiceRow): CreditCardInvoice {
    return {
        id: row.id,
        creditCardId: row.credit_card_id,
        cycleKey: row.cycle_key,
        closingDate: row.closing_date,
        dueDate: row.due_date,
        totalAmount: toNumber(row.total_amount),
        paidAmount: toNumber(row.paid_amount),
        status: row.status as InvoiceStatus,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function toTransactionRow(userId: string, transaction: StoredTransaction): TransactionRow {
    return {
        user_id: userId,
        id: transaction.id,
        group_id: transaction.groupId,
        installment_number: transaction.installmentNumber,
        amount: transaction.amount,
        scheduled_date: transaction.scheduledDate,
        status: transaction.status,
        paid_at: transaction.paidAt,
        invoice_id: transaction.invoiceId,
        notes: transaction.notes,
        title: transaction.title,
        category_id: transaction.categoryId,
        beneficiary_id: transaction.beneficiaryId,
        source_wallet_id: transaction.sourceWalletId,
        destination_wallet_id: transaction.destinationWalletId,
        credit_card_id: transaction.creditCardId,
        created_at: transaction.createdAt,
    };
}

export function fromTransactionRow(row: TransactionRow): StoredTransaction {
    return {
        id: row.id,
        groupId: row.group_id,
        installmentNumber: row.installment_number,
        amount: toNumber(row.amount),
        scheduledDate: row.scheduled_date,
        status: row.status as TransactionStatus,
        paidAt: row.paid_at,
        invoiceId: row.invoice_id,
        notes: row.notes,
        title: row.title,
        categoryId: row.category_id,
        beneficiaryId: row.beneficiary_id,
        sourceWalletId: row.source_wallet_id,
        destinationWalletId: row.destination_wallet_id,
        creditCardId: row.credit_card_id,
        createdAt: row.created_at,
    };
}

export function toLedgerEntryRow(userId: string, entry: LedgerEntry): LedgerEntryRow {
    return {
        user_id: userId,
        id: entry.id,
        wallet_id: entry.walletId,
        transaction_id: entry.transactionId,
        invoice_id: entry.invoiceId,
        amount: entry.amount,
        balance_after: entry.balanceAfter,
        description: entry.description,
        created_at: entry.createdAt,
    };
}

export function fromLedgerEntryRow(row: LedgerEntryRow): LedgerEntry {
    return {
        id: row.id,
        walletId: row.wallet_id,
        transactionId: row.transaction_id,
        invoiceId: row.invoice_id,
        amount: toNumber(row.amount),
        balanceAfter: toNumber(row.balance_after),
        description: row.description,
        createdAt: row.created_at,
    };
}

export function toTransactionTagRow(userId: string, link: TransactionTag): TransactionTagRow {
    return {
        user_id: userId,
        transaction_id: link.transactionId,
        tag_id: link.tagId,
    };
}

export function fromTransactionTagRow(row: TransactionTagRow): TransactionTag {
    return {
        transactionId: row.transaction_id,
        tagId: row.tag_id,
    };
}
