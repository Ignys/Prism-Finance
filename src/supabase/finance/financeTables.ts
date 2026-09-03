export const FINANCE_TABLES = {
    preferences: "finance_preferences",
    wallets: "wallets",
    creditCards: "credit_cards",
    beneficiaries: "beneficiaries",
    categories: "categories",
    tags: "tags",
    wishItems: "wish_items",
    transactionGroups: "transaction_groups",
    creditCardInvoices: "credit_card_invoices",
    transactions: "transactions",
    ledgerEntries: "ledger_entries",
    transactionTags: "transaction_tags",
    syncState: "finance_sync_state",
} as const;

export interface FinancePreferenceRow {
    user_id: string;
    favorite_wallet_id: string | null;
    favorite_credit_card_id: string | null;
    planning: unknown;
    updated_at?: string;
}

export interface FinanceSyncStateRow {
    user_id: string;
    revision: number | string;
    updated_at: string;
    updated_by: string | null;
}

export interface WalletRow {
    user_id: string;
    id: string;
    name: string;
    icon: string;
    type: string;
    balance: number | string;
    initial_balance: number | string;
    currency: string;
    color: string;
    is_active: boolean;
    include_in_main_totals: boolean;
    created_at: string;
}

export interface CreditCardRow {
    user_id: string;
    id: string;
    name: string;
    icon: string;
    color: string;
    credit_limit: number | string;
    closing_day: number;
    due_day: number;
    bank_wallet_id: string | null;
    is_active: boolean;
    created_at: string;
}

export interface BeneficiaryRow {
    user_id: string;
    id: string;
    family_id: string | null;
    source: string;
    is_self_profile: boolean;
    name: string;
    type: string;
    avatar_color: string | null;
    avatar_image: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface CategoryRow {
    user_id: string;
    id: string;
    parent_id: string | null;
    name: string;
    type: string;
    icon: string;
    color: string | null;
    is_active: boolean;
    is_system: boolean;
    sort_order: number;
    created_at: string;
}

export interface TagRow {
    user_id: string;
    id: string;
    name: string;
    color: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface WishItemRow {
    user_id: string;
    id: string;
    value: number | string;
    category_id: string;
    priority: number | string;
    description: string;
    link: string | null;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface TransactionGroupRow {
    user_id: string;
    id: string;
    beneficiary_id: string | null;
    beneficiary_name: string;
    category_id: string | null;
    category_name: string;
    subcategory_name: string | null;
    title: string;
    notes: string | null;
    type: string;
    transaction_mode: string;
    total_amount: number | string;
    installment_count: number | null;
    recurrence_rule: Record<string, unknown> | null;
    recurrence_end_date: string | null;
    source_wallet_id: string | null;
    destination_wallet_id: string | null;
    credit_card_id: string | null;
    created_at: string;
}

export interface CreditCardInvoiceRow {
    user_id: string;
    id: string;
    credit_card_id: string;
    cycle_key: string;
    closing_date: string;
    due_date: string;
    total_amount: number | string;
    paid_amount: number | string;
    status: string;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface TransactionRow {
    user_id: string;
    id: string;
    group_id: string;
    installment_number: number | null;
    amount: number | string;
    scheduled_date: string;
    status: string;
    paid_at: string | null;
    invoice_id: string | null;
    payment_for_invoice_id?: string | null;
    notes: string | null;
    title: string | null;
    category_id: string | null;
    beneficiary_id: string | null;
    source_wallet_id: string | null;
    destination_wallet_id: string | null;
    credit_card_id: string | null;
    created_at: string;
}

export interface LedgerEntryRow {
    user_id: string;
    id: string;
    wallet_id: string;
    transaction_id: string | null;
    invoice_id: string | null;
    amount: number | string;
    balance_after: number | string;
    description: string;
    created_at: string;
}

export interface TransactionTagRow {
    user_id: string;
    transaction_id: string;
    tag_id: string;
}
