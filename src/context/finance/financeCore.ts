import { getDefaultCategoryIconName, normalizeCategoryIconName } from "../../lib/categoryIcons";
import { formatLocalDateInput, getLocalTodayDate, parseAppDate } from "../../lib/localDate";
import { normalizeWishItemPriority, type WishItemPriority } from "../../lib/wishlistPriority";
import { DEFAULT_CREDIT_CARD_ICON, DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "../../lib/walletVisual";

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
    categoryId: string | null;
    beneficiaryId: string | null;
    tagIds: string[];
    description: string;
    status: TransactionStatus;
    installmentNumber: number | null;
    invoiceId: string | null;
    paymentMethod: PaymentMethod;
    creditCardId: string | null;
    systemKind: TransactionSystemKind | null;
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
    id: string;
    groupId: string;
    installmentNumber: number | null;
    amount: number;
    scheduledDate: string;
    status: TransactionStatus;
    paidAt: string | null;
    invoiceId: string | null;
    notes: string | null;
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
    recurrenceRule: Record<string, unknown> | null;
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
    totalAmount: number;
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

export interface PlanningRevenueOverride {
    monthKey: string;
    amount: number;
    updatedAt: string;
}

export interface PlanningState {
    simulatedExpenses: PlanningSimulatedExpense[];
    simulatedIncomes: PlanningSimulatedIncome[];
    revenueOverrides: PlanningRevenueOverride[];
    disabledInheritedExpenseIds: string[];
    disabledIncomeIds: string[];
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
    recurrenceRule?: Record<string, unknown> | null;
    recurrenceEndDate?: string | null;
}

interface NormalizeFinanceResult {
    snapshot: FinanceSnapshot;
    changed: boolean;
}

interface NormalizeFinanceOptions {
    defaultBeneficiaryName?: string;
    defaultBeneficiaryAvatarImage?: string | null;
    sharedBeneficiaries?: Beneficiary[];
}

interface WalletInput extends Partial<Wallet> {
    id: string;
    startBalance?: unknown;
}

interface CreditCardInput extends Partial<CreditCard> {
    id: string;
}

interface CreditCardInvoiceInput extends Partial<CreditCardInvoice> {
    id: string;
}

interface PlanningSimulatedExpenseInput extends Partial<PlanningSimulatedExpense> {
    id?: string;
}

interface PlanningSimulatedIncomeInput extends Partial<PlanningSimulatedIncome> {
    id?: string;
}

type PlanningRevenueOverrideInput = Partial<PlanningRevenueOverride>;

interface BeneficiaryInput extends Partial<Beneficiary> {
    id: string;
}

interface CategoryInput extends Partial<Category> {
    id: string;
}

interface TagInput extends Partial<Tag> {
    id: string;
}

interface WishItemInput extends Partial<WishItem> {
    id: string;
}

const LEGACY_DEFAULT_WALLET_ID = "first_wallet";
const TRANSACTION_STATUSES = new Set<TransactionStatus>(["pending", "paid", "cancelled", "skipped"]);

export const DEFAULT_WALLET_ID = "default";
export const DEFAULT_BENEFICIARY_ID = "beneficiary-self";
export const DEFAULT_BENEFICIARY_NAME = "Eu";
export const DEFAULT_EXPENSE_CATEGORY_ID = "system-category-expense-uncategorized";
export const SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID = "system-category-expense-card-invoice";
export const DEFAULT_INCOME_CATEGORY_ID = "system-category-income-other";
export const INVOICE_PAYMENT_NOTE_PREFIX = "[prism-invoice-payment]";

export const DEFAULT_WALLET: Wallet = {
    id: DEFAULT_WALLET_ID,
    name: "Carteira Principal",
    icon: DEFAULT_WALLET_ICON,
    type: "checking",
    balance: 0,
    initialBalance: 0,
    currency: "BRL",
    color: DEFAULT_WALLET_COLOR,
    isActive: true,
    createdAt: new Date().toISOString(),
};

export const DEFAULT_PLANNING_STATE: PlanningState = {
    simulatedExpenses: [],
    simulatedIncomes: [],
    revenueOverrides: [],
    disabledInheritedExpenseIds: [],
    disabledIncomeIds: [],
};

interface SystemCategorySeed {
    id: string;
    parentId: string | null;
    name: string;
    type: CategoryType;
    icon: string;
    color: string | null;
}

const SYSTEM_CATEGORY_SEED: SystemCategorySeed[] = [
    { id: "system-category-expense-food", parentId: null, name: "Alimentação", type: "expense", icon: "utensils", color: "#EF4444" },
    { id: "system-category-expense-housing", parentId: null, name: "Moradia", type: "expense", icon: "house", color: "#F59E0B" },
    { id: "system-category-expense-transport", parentId: null, name: "Transporte", type: "expense", icon: "car", color: "#3B82F6" },
    { id: "system-category-expense-health", parentId: null, name: "Saúde", type: "expense", icon: "heart", color: "#10B981" },
    { id: "system-category-expense-leisure", parentId: null, name: "Lazer", type: "expense", icon: "music", color: "#8B5CF6" },
    { id: SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, parentId: null, name: "Fatura do Cartão", type: "expense", icon: "credit-card", color: "#06B6D4" },
    { id: DEFAULT_EXPENSE_CATEGORY_ID, parentId: null, name: "Sem categoria", type: "expense", icon: "tag", color: "#6B7280" },
    { id: "system-category-expense-food-restaurants", parentId: "system-category-expense-food", name: "Restaurantes", type: "expense", icon: "utensils-crossed", color: "#FB7185" },
    { id: "system-category-expense-food-market", parentId: "system-category-expense-food", name: "Supermercado", type: "expense", icon: "shopping-cart", color: "#F97316" },
    { id: "system-category-expense-food-delivery", parentId: "system-category-expense-food", name: "Delivery", type: "expense", icon: "bike", color: "#22C55E" },
    { id: "system-category-income-salary", parentId: null, name: "Salário", type: "income", icon: "briefcase", color: "#0EA5E9" },
    { id: "system-category-income-investments", parentId: null, name: "Investimentos", type: "income", icon: "chart-line", color: "#14B8A6" },
    { id: DEFAULT_INCOME_CATEGORY_ID, parentId: null, name: "Outras receitas", type: "income", icon: "coins", color: "#22C55E" },
];

const INVOICE_PAYMENT_CATEGORY_SEED = SYSTEM_CATEGORY_SEED.find((item) => item.id === SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID) as SystemCategorySeed;

interface InvoicePaymentNotePayload {
    invoiceId: string;
    creditCardId: string;
}

export function buildInvoicePaymentNote(payload: InvoicePaymentNotePayload): string {
    return `${INVOICE_PAYMENT_NOTE_PREFIX}|${payload.invoiceId}|${payload.creditCardId}`;
}

export function parseInvoicePaymentNote(note: string | null): InvoicePaymentNotePayload | null {
    if (!note || !note.startsWith(`${INVOICE_PAYMENT_NOTE_PREFIX}|`)) {
        return null;
    }

    const [, invoiceId = "", creditCardId = ""] = note.split("|");
    if (!invoiceId || !creditCardId) {
        return null;
    }

    return {
        invoiceId,
        creditCardId,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown, fallback: string | null): string | null {
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim();
    return normalized ? normalized : fallback;
}

function asNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function asSortOrder(value: unknown, fallback: number): number {
    const safeFallback = Number.isFinite(fallback) ? fallback : 0;
    const numeric = Math.round(asNumber(value, safeFallback));
    return Number.isFinite(numeric) ? Math.max(0, numeric) : Math.max(0, Math.round(safeFallback));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function asDayOfMonth(value: unknown, fallback: number): number {
    const numeric = Math.round(asNumber(value, fallback));
    if (!Number.isFinite(numeric)) {
        return Math.min(31, Math.max(1, fallback));
    }
    return Math.min(31, Math.max(1, numeric));
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asDateString(value: unknown, fallback: string): string {
    if (typeof value !== "string") {
        return fallback;
    }

    const parsed = parseAppDate(value);
    if (!parsed) {
        return fallback;
    }
    return formatLocalDateInput(parsed);
}

function asDateTimeString(value: unknown, fallback: string): string {
    const parsed = typeof value === "string" ? new Date(value) : new Date(NaN);
    if (Number.isNaN(parsed.getTime())) {
        return fallback;
    }
    return parsed.toISOString();
}

function asWalletType(value: unknown): WalletType {
    if (value === "checking" || value === "savings" || value === "cash" || value === "investment") {
        return value;
    }
    return "checking";
}

function asTransactionMode(value: unknown): TransactionMode {
    if (value === "single" || value === "installment" || value === "recurring") {
        return value;
    }
    return "single";
}

function asBeneficiaryType(value: unknown): BeneficiaryType {
    if (value === "person" || value === "cost_center" || value === "pet" || value === "other") {
        return value;
    }
    return "person";
}

function asCategoryType(value: unknown, fallback: CategoryType): CategoryType {
    if (value === "income" || value === "expense") {
        return value;
    }
    return fallback;
}

function asInvoiceStatus(value: unknown, fallback: InvoiceStatus = "open"): InvoiceStatus {
    if (value === "open" || value === "paid") {
        return value;
    }
    return fallback;
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
}

function compareBySortOrderNameAndId(
    a: Pick<Category | Beneficiary | Tag, "sortOrder" | "name" | "id">,
    b: Pick<Category | Beneficiary | Tag, "sortOrder" | "name" | "id">,
): number {
    if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
    }

    const nameComparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    if (nameComparison !== 0) {
        return nameComparison;
    }

    return a.id.localeCompare(b.id);
}

function getTodayDate(): string {
    return getLocalTodayDate();
}

function getNowIso(): string {
    return new Date().toISOString();
}

// Ledger timestamps represent when the wallet balance should move, not when the record was created.
export function resolveLedgerEntryDateIso(dateValue: string, fallbackIso: string): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return fallbackIso;
    }

    const localMidday = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 12, 0, 0, 0);
    return localMidday.toISOString();
}

function getTransactionLedgerEntryDateIso(transaction: Pick<StoredTransaction, "scheduledDate" | "paidAt" | "createdAt">): string {
    return resolveLedgerEntryDateIso(transaction.scheduledDate, transaction.paidAt ?? transaction.createdAt);
}

function asWalletId(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (isRecord(value) && typeof value.id === "string") {
        return value.id;
    }
    return DEFAULT_WALLET_ID;
}

function inferGroupType(type: unknown, signedValue: number): TransactionGroupType {
    if (type === "income") {
        return "income";
    }
    if (type === "expense" || type === "spending") {
        return "expense";
    }
    if (type === "transfer") {
        return "transfer";
    }
    return signedValue < 0 ? "expense" : "income";
}

function toTransactionType(type: TransactionGroupType): TransactionType {
    if (type === "expense") {
        return "spending";
    }
    return type;
}

function normalizeOptionalWalletId(walletId: string | null, walletIds: Set<string>): string | null {
    if (!walletId) {
        return null;
    }
    const normalized = normalizeWalletId(walletId);
    return walletIds.has(normalized) ? normalized : DEFAULT_WALLET_ID;
}

function createLedgerEntryId(transactionId: string, suffix?: string): string {
    return suffix ? `le-${transactionId}-${suffix}` : `le-${transactionId}`;
}

function normalizeTextForComparison(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase();
}

function buildCategoryLookupKey(type: CategoryType, name: string, parentId: string | null): string {
    return `${type}::${parentId ?? "root"}::${normalizeTextForComparison(name)}`;
}

function buildBeneficiaryLookupKey(name: string): string {
    return normalizeTextForComparison(name);
}

function toCategoryTypeFromGroupType(type: TransactionGroupType): CategoryType {
    return type === "income" ? "income" : "expense";
}

function toDateInput(value: string): Date {
    const parsed = parseAppDate(value);
    if (parsed) {
        return parsed;
    }

    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
        return new Date();
    }

    return fallback;
}

function getMonthLength(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDayForMonth(year: number, monthIndex: number, day: number): number {
    return Math.min(getMonthLength(year, monthIndex), Math.max(1, Math.round(day)));
}

function formatYearMonth(year: number, monthIndex: number): string {
    return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function buildDateString(year: number, monthIndex: number, day: number): string {
    const safeDay = clampDayForMonth(year, monthIndex, day);
    return `${formatYearMonth(year, monthIndex)}-${String(safeDay).padStart(2, "0")}`;
}

function parseYearMonthKey(monthKey: string): { year: number; monthIndex: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return {
        year,
        monthIndex: month - 1,
    };
}

export function getMonthKeyFromDateValue(dateValue: string, referenceDate = new Date()): string {
    const parsedDate = parseAppDate(dateValue);
    if (!parsedDate) {
        return formatYearMonth(referenceDate.getFullYear(), referenceDate.getMonth());
    }

    return formatYearMonth(parsedDate.getFullYear(), parsedDate.getMonth());
}

export function resolveCreditCardInvoiceCycle(
    transactionDate: string,
    closingDay: number,
    dueDay: number,
): { cycleKey: string; closingDate: string; dueDate: string } {
    const parsedDate = toDateInput(transactionDate);
    const transactionYear = parsedDate.getFullYear();
    const transactionMonth = parsedDate.getMonth();
    const transactionDay = parsedDate.getDate();

    const safeClosingDay = asDayOfMonth(closingDay, 1);
    const safeDueDay = asDayOfMonth(dueDay, 1);

    const dueMonthOffset = safeClosingDay <= safeDueDay ? (transactionDay > safeClosingDay ? 1 : 0) : transactionDay > safeClosingDay ? 2 : 1;
    const cycleAnchor = new Date(transactionYear, transactionMonth + dueMonthOffset, 1);
    const cycleYear = cycleAnchor.getFullYear();
    const cycleMonth = cycleAnchor.getMonth();
    const closingAnchor = new Date(cycleYear, cycleMonth + (safeClosingDay <= safeDueDay ? 0 : -1), 1);

    return {
        cycleKey: formatYearMonth(cycleYear, cycleMonth),
        closingDate: buildDateString(closingAnchor.getFullYear(), closingAnchor.getMonth(), safeClosingDay),
        dueDate: buildDateString(cycleYear, cycleMonth, safeDueDay),
    };
}

export function resolveCreditCardInvoiceCycleFromCycleKey(
    cycleKey: string,
    closingDay: number,
    dueDay: number,
): { cycleKey: string; closingDate: string; dueDate: string } {
    const parsedMonth = parseYearMonthKey(cycleKey);
    if (!parsedMonth) {
        return resolveCreditCardInvoiceCycle(getLocalTodayDate(), closingDay, dueDay);
    }

    const safeClosingDay = asDayOfMonth(closingDay, 1);
    const safeDueDay = asDayOfMonth(dueDay, 1);
    const closingAnchor = new Date(parsedMonth.year, parsedMonth.monthIndex + (safeClosingDay <= safeDueDay ? 0 : -1), 1);

    return {
        cycleKey: formatYearMonth(parsedMonth.year, parsedMonth.monthIndex),
        closingDate: buildDateString(closingAnchor.getFullYear(), closingAnchor.getMonth(), safeClosingDay),
        dueDate: buildDateString(parsedMonth.year, parsedMonth.monthIndex, safeDueDay),
    };
}

export function parseCreditCardInvoiceId(invoiceId: string): { creditCardId: string; cycleKey: string } | null {
    const normalizedInvoiceId = invoiceId.trim();
    const match = /^invoice-(.+)-(\d{4}-\d{2})$/.exec(normalizedInvoiceId);
    if (!match) {
        return null;
    }

    const creditCardId = match[1]?.trim() ?? "";
    const cycleKey = match[2]?.trim() ?? "";
    if (!creditCardId || !parseYearMonthKey(cycleKey)) {
        return null;
    }

    return {
        creditCardId,
        cycleKey,
    };
}

export function resolveOpenCreditCardInvoiceCycle(
    closingDay: number,
    dueDay: number,
    referenceDate = new Date(),
): { cycleKey: string; closingDate: string; dueDate: string } {
    return resolveCreditCardInvoiceCycle(formatLocalDateInput(referenceDate), closingDay, dueDay);
}

export function getCreditCardInvoiceMonthKey(invoice: Pick<CreditCardInvoice, "dueDate">, referenceDate = new Date()): string {
    return getMonthKeyFromDateValue(invoice.dueDate, referenceDate);
}

export function buildCreditCardInvoiceId(creditCardId: string, cycleKey: string): string {
    return `invoice-${creditCardId}-${cycleKey}`;
}

export function resolveExpectedCreditCardInvoiceId(params: {
    creditCardId: string | null;
    transactionDate: string;
    closingDay: number;
    dueDay: number;
}): string | null {
    const creditCardId = asString(params.creditCardId, "");
    if (!creditCardId) {
        return null;
    }

    const cycle = resolveCreditCardInvoiceCycle(params.transactionDate, params.closingDay, params.dueDay);
    return buildCreditCardInvoiceId(creditCardId, cycle.cycleKey);
}

export interface CreditCardInvoiceAssignmentIssue {
    transactionId: string;
    creditCardId: string;
    currentInvoiceId: string | null;
    expectedInvoiceId: string;
    expectedCycleKey: string;
    expectedClosingDate: string;
    expectedDueDate: string;
}

export function findCreditCardInvoiceAssignmentIssues(params: {
    transactions: Pick<StoredTransaction, "id" | "groupId" | "scheduledDate" | "invoiceId" | "status">[];
    transactionGroups: Pick<TransactionGroup, "id" | "type" | "creditCardId">[];
    creditCards: Pick<CreditCard, "id" | "closingDay" | "dueDay">[];
}): CreditCardInvoiceAssignmentIssue[] {
    const groupById = new Map(params.transactionGroups.map((group) => [group.id, group]));
    const cardById = new Map(params.creditCards.map((card) => [card.id, card]));
    const issues: CreditCardInvoiceAssignmentIssue[] = [];

    params.transactions.forEach((transaction) => {
        if (transaction.status === "cancelled") {
            return;
        }

        const group = groupById.get(transaction.groupId);
        if (!group || group.type !== "expense" || !group.creditCardId) {
            return;
        }

        const creditCard = cardById.get(group.creditCardId);
        if (!creditCard) {
            return;
        }

        const expectedCycle = resolveCreditCardInvoiceCycle(transaction.scheduledDate, creditCard.closingDay, creditCard.dueDay);
        const expectedInvoiceId = buildCreditCardInvoiceId(creditCard.id, expectedCycle.cycleKey);
        if (transaction.invoiceId === expectedInvoiceId) {
            return;
        }

        issues.push({
            transactionId: transaction.id,
            creditCardId: creditCard.id,
            currentInvoiceId: transaction.invoiceId,
            expectedInvoiceId,
            expectedCycleKey: expectedCycle.cycleKey,
            expectedClosingDate: expectedCycle.closingDate,
            expectedDueDate: expectedCycle.dueDate,
        });
    });

    return issues;
}

export function calculateCreditCardInvoiceOpenAmount(invoice: CreditCardInvoice): number {
    return roundToCents(Math.max(0, invoice.totalAmount - invoice.paidAmount));
}

export function resolveCreditCardInvoiceStatus(params: {
    invoiceCycleKey: string;
    cardClosingDay: number;
    cardDueDay: number;
    totalAmount: number;
    paidAmount: number;
    referenceDate?: Date;
}): InvoiceStatus {
    const { totalAmount, paidAmount } = params;
    const safeTotalAmount = roundToCents(Math.max(0, totalAmount));
    const safePaidAmount = roundToCents(Math.min(safeTotalAmount, Math.max(0, paidAmount)));
    return safePaidAmount >= safeTotalAmount && safeTotalAmount > 0 ? "paid" : "open";
}

export function findDefaultCategoryId(groupType: TransactionGroupType, categories: Category[]): string {
    const desiredType = toCategoryTypeFromGroupType(groupType);
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const selectableCategories = desiredType === "expense" ? categories.filter((item) => item.id !== SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID) : categories;

    if (desiredType === "expense" && categoryById.has(DEFAULT_EXPENSE_CATEGORY_ID)) {
        return DEFAULT_EXPENSE_CATEGORY_ID;
    }

    if (desiredType === "income" && categoryById.has(DEFAULT_INCOME_CATEGORY_ID)) {
        return DEFAULT_INCOME_CATEGORY_ID;
    }

    const firstOfType = selectableCategories.find((item) => item.type === desiredType);
    if (firstOfType) {
        return firstOfType.id;
    }

    const firstCategory = selectableCategories[0] ?? categories[0];
    if (firstCategory) {
        return firstCategory.id;
    }

    return desiredType === "income" ? DEFAULT_INCOME_CATEGORY_ID : DEFAULT_EXPENSE_CATEGORY_ID;
}

export function normalizeTransactionStatus(status: unknown): TransactionStatus {
    if (typeof status === "boolean") {
        return status ? "paid" : "pending";
    }
    if (typeof status === "string" && TRANSACTION_STATUSES.has(status as TransactionStatus)) {
        return status as TransactionStatus;
    }
    return "pending";
}

export function normalizeWalletId(walletId: string): string {
    if (!walletId || walletId === LEGACY_DEFAULT_WALLET_ID) {
        return DEFAULT_WALLET_ID;
    }
    return walletId;
}

export function normalizeWallet(wallet: WalletInput): Wallet {
    const id = normalizeWalletId(wallet.id);
    const initialBalance = roundToCents(asNumber(wallet.initialBalance, asNumber(wallet.startBalance, 0)));
    const balance = roundToCents(asNumber(wallet.balance, initialBalance));

    return {
        id,
        name: asString(wallet.name, id === DEFAULT_WALLET_ID ? DEFAULT_WALLET.name : "Carteira"),
        icon: asString(wallet.icon, DEFAULT_WALLET.icon),
        type: asWalletType(wallet.type),
        balance,
        initialBalance,
        currency: asString(wallet.currency, "BRL").toUpperCase(),
        color: asString(wallet.color, DEFAULT_WALLET_COLOR),
        isActive: asBoolean(wallet.isActive, true),
        createdAt: asDateTimeString(wallet.createdAt, getNowIso()),
    };
}

export function normalizeCreditCard(card: CreditCardInput, walletIds: Set<string>): CreditCard {
    const normalizedBankWalletId = normalizeOptionalWalletId(asNullableString(card.bankWalletId, null), walletIds);
    const resolvedIcon = asString(card.icon, DEFAULT_CREDIT_CARD_ICON);
    return {
        id: asString(card.id, `credit-card-${Date.now()}`),
        name: asString(card.name, "Cartao"),
        icon: resolvedIcon === DEFAULT_WALLET_ICON ? DEFAULT_CREDIT_CARD_ICON : resolvedIcon,
        color: asString(card.color, DEFAULT_WALLET_COLOR),
        limit: roundToCents(Math.max(0, asNumber(card.limit, 0))),
        closingDay: asDayOfMonth(card.closingDay, 10),
        dueDay: asDayOfMonth(card.dueDay, 15),
        bankWalletId: normalizedBankWalletId,
        isActive: asBoolean(card.isActive, true),
        createdAt: asDateTimeString(card.createdAt, getNowIso()),
    };
}

export function normalizeCreditCardInvoice(invoice: CreditCardInvoiceInput, creditCardIds: Set<string>): CreditCardInvoice {
    const now = getNowIso();
    const creditCardId = asString(invoice.creditCardId, "");
    const cycleKey = asString(invoice.cycleKey, formatYearMonth(new Date().getFullYear(), new Date().getMonth()));
    const totalAmount = roundToCents(Math.max(0, asNumber(invoice.totalAmount, 0)));
    const paidAmount = roundToCents(Math.min(totalAmount, Math.max(0, asNumber(invoice.paidAmount, 0))));
    const inferredStatus: InvoiceStatus = paidAmount >= totalAmount && totalAmount > 0 ? "paid" : "open";
    const status = asInvoiceStatus(invoice.status, inferredStatus);
    const createdAt = asDateTimeString(invoice.createdAt, now);
    const updatedAt = asDateTimeString(invoice.updatedAt, now);

    const cycleMatch = /^(\d{4})-(\d{2})$/.exec(cycleKey);
    const cycleYear = cycleMatch ? Number(cycleMatch[1]) : new Date().getFullYear();
    const cycleMonth = cycleMatch ? Math.max(0, Math.min(11, Number(cycleMatch[2]) - 1)) : new Date().getMonth();

    const closingDate = asDateString(invoice.closingDate, buildDateString(cycleYear, cycleMonth, 10));
    const dueDate = asDateString(invoice.dueDate, buildDateString(cycleYear, cycleMonth, 15));

    return {
        id: asString(invoice.id, `invoice-${Date.now()}`),
        creditCardId: creditCardIds.has(creditCardId) ? creditCardId : "",
        cycleKey,
        closingDate,
        dueDate,
        totalAmount,
        paidAmount,
        status,
        paidAt: status === "paid" ? asDateTimeString(invoice.paidAt, updatedAt) : null,
        createdAt,
        updatedAt,
    };
}

export function normalizeBeneficiary(beneficiary: BeneficiaryInput): Beneficiary {
    return {
        id: asString(beneficiary.id, `beneficiary-${Date.now()}`),
        userId: asNullableString(beneficiary.userId, null),
        familyId: asNullableString(beneficiary.familyId, null),
        source: beneficiary.source === "family_shared" ? "family_shared" : "personal",
        isSelfProfile: asBoolean(beneficiary.isSelfProfile, false),
        name: asString(beneficiary.name, DEFAULT_BENEFICIARY_NAME),
        type: asBeneficiaryType(beneficiary.type),
        avatarColor: asNullableString(beneficiary.avatarColor, null),
        avatarImage: asNullableString(beneficiary.avatarImage, null),
        isActive: asBoolean(beneficiary.isActive, true),
        sortOrder: asSortOrder(beneficiary.sortOrder, 0),
        createdAt: asDateTimeString(beneficiary.createdAt, getNowIso()),
    };
}

export function normalizeCategory(category: CategoryInput): Category {
    const resolvedType = asCategoryType(category.type, "expense");
    return {
        id: asString(category.id, `category-${Date.now()}`),
        userId: asNullableString(category.userId, null),
        parentId: asNullableString(category.parentId, null),
        name: asString(category.name, "Sem categoria"),
        type: resolvedType,
        icon: normalizeCategoryIconName(asNullableString(category.icon, null), resolvedType),
        color: asNullableString(category.color, null),
        isActive: asBoolean(category.isActive, true),
        isSystem: asBoolean(category.isSystem, false),
        sortOrder: asSortOrder(category.sortOrder, 0),
        createdAt: asDateTimeString(category.createdAt, getNowIso()),
    };
}

export function normalizeTag(tag: TagInput): Tag {
    return {
        id: asString(tag.id, `tag-${Date.now()}`),
        userId: asNullableString(tag.userId, null),
        name: asString(tag.name, "Tag"),
        color: asNullableString(tag.color, null),
        isActive: asBoolean(tag.isActive, true),
        sortOrder: asSortOrder(tag.sortOrder, 0),
        createdAt: asDateTimeString(tag.createdAt, getNowIso()),
    };
}

export function normalizeWishItem(wishItem: WishItemInput): WishItem {
    return {
        id: asString(wishItem.id, `wish-${Date.now()}`),
        userId: asNullableString(wishItem.userId, null),
        value: roundToCents(Math.max(0, Math.abs(asNumber(wishItem.value, 0)))),
        categoryId: asString(wishItem.categoryId, "").trim(),
        priority: normalizeWishItemPriority(wishItem.priority),
        description: asString(wishItem.description, "Desejo").trim() || "Desejo",
        link: asNullableString(wishItem.link, null)?.trim() || null,
        isActive: asBoolean(wishItem.isActive, true),
        createdAt: asDateTimeString(wishItem.createdAt, getNowIso()),
    };
}

export function normalizeTransactionGroup(group: Partial<TransactionGroup> & { id: string }, walletIds: Set<string>): TransactionGroup {
    const sourceWalletId = normalizeOptionalWalletId(asNullableString(group.sourceWalletId, null), walletIds);
    const destinationWalletId = normalizeOptionalWalletId(asNullableString(group.destinationWalletId, null), walletIds);

    return {
        id: asString(group.id, `group-${Date.now()}`),
        userId: asNullableString(group.userId, null),
        beneficiaryId: asNullableString(group.beneficiaryId, null),
        beneficiaryName: asString(group.beneficiaryName, DEFAULT_BENEFICIARY_NAME),
        categoryId: asNullableString(group.categoryId, null),
        categoryName: asString(group.categoryName, "Sem categoria"),
        subcategoryName: asNullableString(group.subcategoryName, null),
        title: asString(group.title, "Transacao"),
        notes: asNullableString(group.notes, null),
        type: inferGroupType(group.type, asNumber(group.totalAmount, 0)),
        transactionMode: asTransactionMode(group.transactionMode),
        totalAmount: roundToCents(Math.abs(asNumber(group.totalAmount, 0))),
        installmentCount: Number.isInteger(group.installmentCount) ? Number(group.installmentCount) : null,
        recurrenceRule: isRecord(group.recurrenceRule) ? group.recurrenceRule : null,
        recurrenceEndDate: asNullableString(group.recurrenceEndDate, null),
        sourceWalletId,
        destinationWalletId,
        creditCardId: asNullableString(group.creditCardId, null),
        createdAt: asDateTimeString(group.createdAt, getNowIso()),
    };
}

export function normalizeStoredTransaction(transaction: Partial<StoredTransaction> & { id: string; groupId: string }): StoredTransaction {
    const now = getNowIso();
    const scheduledDate = asDateString(transaction.scheduledDate, getTodayDate());
    const status = normalizeTransactionStatus(transaction.status);
    const paidAt = status === "paid" ? asDateTimeString(transaction.paidAt, resolveLedgerEntryDateIso(scheduledDate, now)) : null;

    return {
        id: asString(transaction.id, `tx-${Date.now()}`),
        groupId: asString(transaction.groupId, `group-${Date.now()}`),
        installmentNumber: Number.isInteger(transaction.installmentNumber) ? Number(transaction.installmentNumber) : null,
        amount: roundToCents(Math.abs(asNumber(transaction.amount, 0))),
        scheduledDate,
        status,
        paidAt,
        invoiceId: asNullableString(transaction.invoiceId, null),
        notes: asNullableString(transaction.notes, null),
        createdAt: asDateTimeString(transaction.createdAt, now),
    };
}

export function normalizeLedgerEntry(entry: Partial<LedgerEntry> & { id: string; walletId: string }): LedgerEntry {
    return {
        id: asString(entry.id, `le-${Date.now()}`),
        walletId: normalizeWalletId(entry.walletId),
        transactionId: asNullableString(entry.transactionId, null),
        invoiceId: asNullableString(entry.invoiceId, null),
        amount: roundToCents(asNumber(entry.amount, 0)),
        balanceAfter: roundToCents(asNumber(entry.balanceAfter, 0)),
        description: asString(entry.description, "Lancamento"),
        createdAt: asDateTimeString(entry.createdAt, getNowIso()),
    };
}

function normalizePlanningMonthKey(value: unknown, fallback = getMonthKeyFromDateValue(getTodayDate())): string {
    if (typeof value !== "string") {
        return fallback;
    }

    const parsedMonth = parseYearMonthKey(value);
    if (!parsedMonth) {
        return fallback;
    }

    return formatYearMonth(parsedMonth.year, parsedMonth.monthIndex);
}

function normalizePlanningSimulatedExpense(input: PlanningSimulatedExpenseInput, index: number): PlanningSimulatedExpense {
    const now = getNowIso();

    return {
        id: asString(input.id, `planning-expense-${index}-${Date.now()}`),
        monthKey: normalizePlanningMonthKey(input.monthKey),
        description: asString(input.description, "Gasto simulado"),
        amount: roundToCents(Math.max(0, Math.abs(asNumber(input.amount, 0)))),
        createdAt: asDateTimeString(input.createdAt, now),
    };
}

function normalizePlanningSimulatedIncome(input: PlanningSimulatedIncomeInput, index: number): PlanningSimulatedIncome {
    const now = getNowIso();

    return {
        id: asString(input.id, `planning-income-${index}-${Date.now()}`),
        monthKey: normalizePlanningMonthKey(input.monthKey),
        description: asString(input.description, "Receita simulada"),
        amount: roundToCents(asNumber(input.amount, 0)),
        createdAt: asDateTimeString(input.createdAt, now),
    };
}

function normalizePlanningRevenueOverride(input: PlanningRevenueOverrideInput): PlanningRevenueOverride {
    return {
        monthKey: normalizePlanningMonthKey(input.monthKey),
        amount: roundToCents(Math.max(0, asNumber(input.amount, 0))),
        updatedAt: asDateTimeString(input.updatedAt, getNowIso()),
    };
}

export function normalizePlanningState(rawPlanning: unknown): PlanningState {
    if (!isRecord(rawPlanning)) {
        return DEFAULT_PLANNING_STATE;
    }

    const expensesById = new Map<string, PlanningSimulatedExpense>();
    asArray(rawPlanning.simulatedExpenses).forEach((rawExpense, index) => {
        if (!isRecord(rawExpense)) {
            return;
        }

        const expense = normalizePlanningSimulatedExpense(rawExpense, index);
        if (expense.amount <= 0) {
            return;
        }

        expensesById.set(expense.id, expense);
    });

    const overridesByMonth = new Map<string, PlanningRevenueOverride>();
    asArray(rawPlanning.revenueOverrides).forEach((rawOverride) => {
        if (!isRecord(rawOverride)) {
            return;
        }

        const revenueOverride = normalizePlanningRevenueOverride(rawOverride);
        overridesByMonth.set(revenueOverride.monthKey, revenueOverride);
    });

    const incomesById = new Map<string, PlanningSimulatedIncome>();
    asArray(rawPlanning.simulatedIncomes).forEach((rawIncome, index) => {
        if (!isRecord(rawIncome)) {
            return;
        }

        const income = normalizePlanningSimulatedIncome(rawIncome, index);
        if (Math.abs(income.amount) <= 0.009) {
            return;
        }

        incomesById.set(income.id, income);
    });

    return {
        simulatedExpenses: Array.from(expensesById.values()).sort((a, b) => {
            if (a.monthKey === b.monthKey) {
                return a.createdAt.localeCompare(b.createdAt);
            }
            return a.monthKey.localeCompare(b.monthKey);
        }),
        simulatedIncomes: Array.from(incomesById.values()).sort((a, b) => {
            if (a.monthKey === b.monthKey) {
                return a.createdAt.localeCompare(b.createdAt);
            }
            return a.monthKey.localeCompare(b.monthKey);
        }),
        revenueOverrides: Array.from(overridesByMonth.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
        disabledInheritedExpenseIds: Array.from(
            new Set(
                asArray(rawPlanning.disabledInheritedExpenseIds).filter(
                    (value): value is string => typeof value === "string" && value.trim().length > 0,
                ),
            ),
        ).sort((a, b) => a.localeCompare(b)),
        disabledIncomeIds: Array.from(
            new Set(
                asArray(rawPlanning.disabledIncomeIds).filter(
                    (value): value is string => typeof value === "string" && value.trim().length > 0,
                ),
            ),
        ).sort((a, b) => a.localeCompare(b)),
    };
}

export function applyLedgerToWallets(wallets: Wallet[], ledgerEntries: LedgerEntry[]): { wallets: Wallet[]; ledgerEntries: LedgerEntry[] } {
    const initialBalanceByWallet = new Map<string, number>();
    wallets.forEach((wallet) => {
        initialBalanceByWallet.set(wallet.id, roundToCents(wallet.initialBalance));
    });

    const sortedEntries = [...ledgerEntries].sort((a, b) => {
        if (a.createdAt === b.createdAt) {
            return a.id.localeCompare(b.id);
        }
        return a.createdAt.localeCompare(b.createdAt);
    });

    const normalizedLedger = sortedEntries.map((entry) => {
        const roundedAmount = roundToCents(entry.amount);
        const current = initialBalanceByWallet.get(entry.walletId);
        if (current === undefined) {
            return {
                ...entry,
                amount: roundedAmount,
                balanceAfter: roundToCents(entry.balanceAfter),
            };
        }

        const nextBalance = roundToCents(current + roundedAmount);
        initialBalanceByWallet.set(entry.walletId, nextBalance);

        return {
            ...entry,
            amount: roundedAmount,
            balanceAfter: nextBalance,
        };
    });

    const normalizedWallets = wallets.map((wallet) => {
        const balance = initialBalanceByWallet.get(wallet.id);
        return {
            ...wallet,
            balance: balance === undefined ? roundToCents(wallet.initialBalance) : roundToCents(balance),
        };
    });

    return {
        wallets: normalizedWallets,
        ledgerEntries: normalizedLedger,
    };
}

export function createLedgerEntriesForPaidTransaction(transaction: StoredTransaction, group: TransactionGroup): LedgerEntry[] {
    if (transaction.status !== "paid") {
        return [];
    }

    const createdAt = getTransactionLedgerEntryDateIso(transaction);
    const descriptionBase = group.title || "Transacao";

    if (group.type === "income") {
        const walletId = group.sourceWalletId ?? DEFAULT_WALLET_ID;
        return [
            {
                id: createLedgerEntryId(transaction.id),
                walletId,
                transactionId: transaction.id,
                invoiceId: null,
                amount: roundToCents(transaction.amount),
                balanceAfter: 0,
                description: `Receita: ${descriptionBase}`,
                createdAt,
            },
        ];
    }

    if (group.type === "expense") {
        if (group.creditCardId) {
            return [];
        }
        const walletId = group.sourceWalletId ?? DEFAULT_WALLET_ID;
        return [
            {
                id: createLedgerEntryId(transaction.id),
                walletId,
                transactionId: transaction.id,
                invoiceId: null,
                amount: roundToCents(-Math.abs(transaction.amount)),
                balanceAfter: 0,
                description: `Despesa: ${descriptionBase}`,
                createdAt,
            },
        ];
    }

    const entries: LedgerEntry[] = [];
    const sourceWalletId = group.sourceWalletId ?? DEFAULT_WALLET_ID;
    const destinationWalletId = group.destinationWalletId ?? null;

    entries.push({
        id: createLedgerEntryId(transaction.id, "source"),
        walletId: sourceWalletId,
        transactionId: transaction.id,
        invoiceId: null,
        amount: roundToCents(-Math.abs(transaction.amount)),
        balanceAfter: 0,
        description: `Transferencia enviada: ${descriptionBase}`,
        createdAt,
    });

    if (destinationWalletId && destinationWalletId !== sourceWalletId) {
        entries.push({
            id: createLedgerEntryId(transaction.id, "dest"),
            walletId: destinationWalletId,
            transactionId: transaction.id,
            invoiceId: null,
            amount: roundToCents(Math.abs(transaction.amount)),
            balanceAfter: 0,
            description: `Transferencia recebida: ${descriptionBase}`,
            createdAt,
        });
    }

    return entries;
}

function compareLedgerEntryRepairShape(a: LedgerEntry, b: LedgerEntry): number {
    if (a.walletId !== b.walletId) {
        return a.walletId.localeCompare(b.walletId);
    }

    if (a.amount !== b.amount) {
        return a.amount - b.amount;
    }

    if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
    }

    if (a.description !== b.description) {
        return a.description.localeCompare(b.description, "pt-BR", { sensitivity: "base" });
    }

    if ((a.invoiceId ?? "") !== (b.invoiceId ?? "")) {
        return (a.invoiceId ?? "").localeCompare(b.invoiceId ?? "");
    }

    return (a.transactionId ?? "").localeCompare(b.transactionId ?? "");
}

function canReuseTransactionLedgerEntries(existingEntries: LedgerEntry[], expectedEntries: LedgerEntry[]): boolean {
    if (existingEntries.length !== expectedEntries.length) {
        return false;
    }

    const sortedExisting = [...existingEntries].sort(compareLedgerEntryRepairShape);
    const sortedExpected = [...expectedEntries].sort(compareLedgerEntryRepairShape);

    return sortedExisting.every((entry, index) => {
        const expected = sortedExpected[index];
        return (
            entry.walletId === expected.walletId &&
            entry.transactionId === expected.transactionId &&
            entry.invoiceId === expected.invoiceId &&
            entry.amount === expected.amount &&
            entry.description === expected.description &&
            entry.createdAt === expected.createdAt
        );
    });
}

export function calculateFinanceSummary(transactionGroups: TransactionGroup[], transactions: StoredTransaction[]): Pick<FinanceSnapshot, "despesas" | "receitas"> {
    const groupById = new Map(transactionGroups?.map((group) => [group.id, group]));

    const totals = transactions.reduce(
        (acc, transaction) => {
            if (transaction.status === "cancelled" || transaction.status === "skipped") {
                return acc;
            }

            const group = groupById.get(transaction.groupId);
            if (!group) {
                if (transaction.invoiceId) {
                    return acc;
                }
                acc.despesas += Math.abs(transaction.amount);
                return acc;
            }

            if (group.type === "income") {
                acc.receitas += Math.abs(transaction.amount);
            } else if (group.type === "expense") {
                if (group.creditCardId || transaction.invoiceId) {
                    return acc;
                }
                acc.despesas += Math.abs(transaction.amount);
            }

            return acc;
        },
        { despesas: 0, receitas: 0 },
    );

    return {
        despesas: roundToCents(totals.despesas),
        receitas: roundToCents(totals.receitas),
    };
}

export function calculateTotalBalance(wallets: Wallet[]): number {
    return roundToCents(wallets.reduce((sum, wallet) => sum + wallet.balance, 0));
}

export function toTransactionList(
    transactions: StoredTransaction[],
    transactionGroups: TransactionGroup[],
    categories: Category[],
    beneficiaries: Beneficiary[],
    tags: Tag[],
    transactionTags: TransactionTag[],
): TransactionListItem[] {
    const groupsById = new Map(transactionGroups?.map((group) => [group.id, group]));
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const beneficiariesById = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary]));
    const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

    const tagIdsByTransactionId = new Map<string, string[]>();
    transactionTags.forEach((link) => {
        const list = tagIdsByTransactionId.get(link.transactionId);
        if (list) {
            list.push(link.tagId);
        } else {
            tagIdsByTransactionId.set(link.transactionId, [link.tagId]);
        }
    });

    return transactions.map((transaction) => {
        const group = groupsById.get(transaction.groupId);
        const groupType = group?.type ?? "expense";
        const fallbackCategoryType = toCategoryTypeFromGroupType(groupType);
        const category = group?.categoryId ? categoriesById.get(group.categoryId) : null;
        const parentCategory = category?.parentId ? categoriesById.get(category.parentId) : null;
        const beneficiary = group?.beneficiaryId ? beneficiariesById.get(group.beneficiaryId) : null;

        const tagIds = Array.from(new Set(tagIdsByTransactionId.get(transaction.id) ?? [])).filter((tagId) => tagsById.has(tagId));
        const resolvedTags = tagIds
            .map((tagId) => tagsById.get(tagId))
            .filter((tag): tag is Tag => Boolean(tag));

        const fallbackPrincipal = group?.categoryName?.trim() || "Sem categoria";
        const fallbackSub = group?.subcategoryName?.trim() || null;
        const fallbackLabel = fallbackSub ? `${fallbackPrincipal} / ${fallbackSub}` : fallbackPrincipal;

        const resolvedCategory: ResolvedTransactionCategory = category
            ? {
                  id: category.id,
                  label: parentCategory ? `${parentCategory.name} / ${category.name}` : category.name,
                  parentLabel: parentCategory?.name ?? null,
                  icon: normalizeCategoryIconName(category.icon, category.type),
                  color: category.color,
                  type: category.type,
              }
            : {
                  id: null,
                  label: fallbackLabel,
                  parentLabel: fallbackSub ? fallbackPrincipal : null,
                  icon: normalizeCategoryIconName(null, null),
                  color: null,
                  type: fallbackCategoryType,
              };

        const systemKind = parseInvoicePaymentNote(transaction.notes) ? "invoice_payment" : null;
        const transactionEntity: TransactionEntity = {
            id: transaction.id,
            groupId: transaction.groupId,
            type: toTransactionType(groupType),
            value: roundToCents(transaction.amount),
            date: transaction.scheduledDate,
            inWallet: group?.sourceWalletId ?? DEFAULT_WALLET_ID,
            categoryId: resolvedCategory.id,
            beneficiaryId: group?.beneficiaryId ?? null,
            tagIds,
            description: group?.title ?? "Transacao",
            status: transaction.status,
            installmentNumber: transaction.installmentNumber,
            invoiceId: transaction.invoiceId,
            paymentMethod: group?.creditCardId ? "credit_card" : "wallet",
            creditCardId: group?.creditCardId ?? null,
            systemKind,
            meta: {
                criado_em: transaction.createdAt,
                atualizado_em: transaction.paidAt,
            },
        };

        return {
            ...transactionEntity,
            category: resolvedCategory,
            beneficiary: beneficiary?.name ?? group?.beneficiaryName ?? DEFAULT_BENEFICIARY_NAME,
            tags: resolvedTags,
        };
    });
}

export function createFinanceSnapshot(
    wallets: Wallet[],
    creditCards: CreditCard[],
    creditCardInvoices: CreditCardInvoice[],
    favoriteCreditCardId: string | null,
    transactionGroups: TransactionGroup[],
    transactions: StoredTransaction[],
    ledgerEntries: LedgerEntry[],
    beneficiaries: Beneficiary[] = [],
    categories: Category[] = [],
    tags: Tag[] = [],
    wishItems: WishItem[] = [],
    transactionTags: TransactionTag[] = [],
    planning: PlanningState = DEFAULT_PLANNING_STATE,
): FinanceSnapshot {
    const withLedgerApplied = applyLedgerToWallets(wallets, ledgerEntries);
    const summary = calculateFinanceSummary(transactionGroups, transactions);

    return {
        despesas: summary.despesas,
        receitas: summary.receitas,
        wallets: withLedgerApplied.wallets,
        creditCards,
        creditCardInvoices,
        favoriteCreditCardId,
        transactionGroups,
        transactions,
        ledgerEntries: withLedgerApplied.ledgerEntries,
        beneficiaries,
        categories,
        tags,
        wishItems,
        transactionTags,
        planning: normalizePlanningState(planning),
    };
}

function buildSeedCategories(now: string): Category[] {
    return SYSTEM_CATEGORY_SEED.map((item, index) =>
        normalizeCategory({
            id: item.id,
            userId: null,
            parentId: item.parentId,
            name: item.name,
            type: item.type,
            icon: item.icon,
            color: item.color,
            isActive: true,
            isSystem: false,
            sortOrder: index,
            createdAt: now,
        }),
    );
}

function buildInvoicePaymentCategory(now: string): Category {
    return normalizeCategory({
        id: INVOICE_PAYMENT_CATEGORY_SEED.id,
        userId: null,
        parentId: INVOICE_PAYMENT_CATEGORY_SEED.parentId,
        name: INVOICE_PAYMENT_CATEGORY_SEED.name,
        type: INVOICE_PAYMENT_CATEGORY_SEED.type,
        icon: INVOICE_PAYMENT_CATEGORY_SEED.icon,
        color: INVOICE_PAYMENT_CATEGORY_SEED.color,
        isActive: true,
        isSystem: false,
        sortOrder: 0,
        createdAt: now,
    });
}

function normalizeSeedCategoryFlags(categoriesById: Map<string, Category>, now: string): boolean {
    let changed = false;

    if (categoriesById.size === 0) {
        buildSeedCategories(now).forEach((category) => {
            categoriesById.set(category.id, category);
        });
        return true;
    }

    categoriesById.forEach((category) => {
        if (!category.isSystem) {
            return;
        }

        categoriesById.set(category.id, {
            ...category,
            isSystem: false,
        });
        changed = true;
    });

    const invoicePaymentCategory = categoriesById.get(SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID);
    if (!invoicePaymentCategory) {
        categoriesById.set(SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, buildInvoicePaymentCategory(now));
        changed = true;
        return changed;
    }

    const needsInvoiceRepair =
        invoicePaymentCategory.type !== "expense" ||
        invoicePaymentCategory.parentId !== null ||
        !invoicePaymentCategory.isActive ||
        invoicePaymentCategory.isSystem;

    if (needsInvoiceRepair) {
        categoriesById.set(SYSTEM_EXPENSE_CARD_INVOICE_CATEGORY_ID, {
            ...invoicePaymentCategory,
            type: "expense",
            parentId: null,
            isActive: true,
            isSystem: false,
        });
        changed = true;
    }

    return changed;
}

function findCategoryByName(categoriesById: Map<string, Category>, type: CategoryType, name: string, parentId: string | null): Category | null {
    const lookup = buildCategoryLookupKey(type, name, parentId);

    for (const category of categoriesById.values()) {
        const key = buildCategoryLookupKey(category.type, category.name, category.parentId);
        if (key === lookup) {
            return category;
        }
    }

    return null;
}

function findOrCreateCategory(
    params: {
        categoriesById: Map<string, Category>;
        userId: string | null;
        type: CategoryType;
        name: string;
        parentId: string | null;
        now: string;
    },
): { category: Category; created: boolean } {
    const existing = findCategoryByName(params.categoriesById, params.type, params.name, params.parentId);
    if (existing) {
        return { category: existing, created: false };
    }

    const id = `category-${params.type}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const created = normalizeCategory({
        id,
        userId: params.userId,
        parentId: params.parentId,
        name: params.name,
        type: params.type,
        icon: getDefaultCategoryIconName(params.type),
        color: null,
        isActive: true,
        isSystem: false,
        sortOrder: Math.max(
            0,
            ...Array.from(params.categoriesById.values())
                .filter((item) => item.type === params.type && item.parentId === params.parentId)
                .map((item) => item.sortOrder),
        ) + 1,
        createdAt: params.now,
    });

    params.categoriesById.set(created.id, created);
    return { category: created, created: true };
}

function ensureDefaultBeneficiary(
    beneficiariesById: Map<string, Beneficiary>,
    userId: string | null,
    now: string,
    defaultName: string,
    defaultAvatarImage: string | null,
): boolean {
    const nextSortOrder = Math.max(0, ...Array.from(beneficiariesById.values()).map((item) => item.sortOrder)) + 1;
    const existingById = beneficiariesById.get(DEFAULT_BENEFICIARY_ID);
    if (existingById) {
        const normalizedExisting = normalizeBeneficiary({
            ...existingById,
            id: DEFAULT_BENEFICIARY_ID,
            userId,
            familyId: null,
            source: "personal",
            isSelfProfile: true,
            name: defaultName,
            type: "person",
            avatarImage: defaultAvatarImage,
            avatarColor: existingById.avatarColor ?? "#4B5563",
            isActive: true,
            sortOrder: existingById.sortOrder,
            createdAt: existingById.createdAt,
        });
        const changed =
            existingById.name !== normalizedExisting.name ||
            existingById.avatarImage !== normalizedExisting.avatarImage ||
            existingById.userId !== normalizedExisting.userId ||
            existingById.familyId !== normalizedExisting.familyId ||
            existingById.source !== normalizedExisting.source ||
            existingById.isSelfProfile !== normalizedExisting.isSelfProfile ||
            existingById.isActive !== normalizedExisting.isActive;
        beneficiariesById.set(DEFAULT_BENEFICIARY_ID, normalizedExisting);
        return changed;
    }

    const existingByName = Array.from(beneficiariesById.values()).find(
        (item) => buildBeneficiaryLookupKey(item.name) === buildBeneficiaryLookupKey(DEFAULT_BENEFICIARY_NAME),
    );

    if (existingByName) {
        const normalizedExisting = normalizeBeneficiary({
            ...existingByName,
            userId,
            familyId: null,
            source: "personal",
            isSelfProfile: true,
            name: defaultName,
            type: "person",
            avatarImage: defaultAvatarImage,
            avatarColor: existingByName.avatarColor ?? "#4B5563",
            isActive: true,
            createdAt: existingByName.createdAt,
        });
        const changed =
            existingByName.name !== normalizedExisting.name ||
            existingByName.avatarImage !== normalizedExisting.avatarImage ||
            existingByName.userId !== normalizedExisting.userId ||
            existingByName.familyId !== normalizedExisting.familyId ||
            existingByName.source !== normalizedExisting.source ||
            existingByName.isSelfProfile !== normalizedExisting.isSelfProfile ||
            existingByName.isActive !== normalizedExisting.isActive;
        beneficiariesById.set(existingByName.id, normalizedExisting);
        return changed;
    }

    beneficiariesById.set(
        DEFAULT_BENEFICIARY_ID,
        normalizeBeneficiary({
            id: DEFAULT_BENEFICIARY_ID,
            userId,
            familyId: null,
            source: "personal",
            isSelfProfile: true,
            name: defaultName,
            type: "person",
            avatarColor: "#4B5563",
            avatarImage: defaultAvatarImage,
            isActive: true,
            sortOrder: nextSortOrder,
            createdAt: now,
        }),
    );

    return true;
}

function findOrCreateBeneficiary(
    beneficiariesById: Map<string, Beneficiary>,
    name: string,
    userId: string | null,
    now: string,
): { beneficiary: Beneficiary; created: boolean } {
    const lookup = buildBeneficiaryLookupKey(name);

    for (const item of beneficiariesById.values()) {
        if (buildBeneficiaryLookupKey(item.name) === lookup) {
            return { beneficiary: item, created: false };
        }
    }

    const id = `beneficiary-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const created = normalizeBeneficiary({
        id,
        userId,
        name,
        type: "person",
        avatarColor: null,
        avatarImage: null,
        isActive: true,
        sortOrder: Math.max(0, ...Array.from(beneficiariesById.values()).map((item) => item.sortOrder)) + 1,
        createdAt: now,
    });

    beneficiariesById.set(created.id, created);
    return { beneficiary: created, created: true };
}

function normalizeAndCleanTransactionTags(raw: unknown, transactionIds: Set<string>, tagIds: Set<string>): { links: TransactionTag[]; changed: boolean } {
    let changed = false;
    const normalized: TransactionTag[] = [];
    const keys = new Set<string>();

    const rawLinks = asArray(raw);
    if (!Array.isArray(raw)) {
        changed = true;
    }

    rawLinks.forEach((item) => {
        if (!isRecord(item)) {
            changed = true;
            return;
        }

        const transactionId = asNullableString(item.transactionId, null);
        const tagId = asNullableString(item.tagId, null);
        if (!transactionId || !tagId) {
            changed = true;
            return;
        }

        if (!transactionIds.has(transactionId) || !tagIds.has(tagId)) {
            changed = true;
            return;
        }

        const key = `${transactionId}::${tagId}`;
        if (keys.has(key)) {
            changed = true;
            return;
        }

        keys.add(key);
        normalized.push({ transactionId, tagId });
    });

    return { links: normalized, changed };
}

function resolveGroupEntityLinks(
    groupsById: Map<string, TransactionGroup>,
    categoriesById: Map<string, Category>,
    beneficiariesById: Map<string, Beneficiary>,
    userId: string | null,
    now: string,
): boolean {
    let changed = false;

    const categoryExists = (categoryId: string | null): boolean => {
        if (!categoryId) {
            return false;
        }
        return categoriesById.has(categoryId);
    };

    const beneficiaryExists = (beneficiaryId: string | null): boolean => {
        if (!beneficiaryId) {
            return false;
        }
        return beneficiariesById.has(beneficiaryId);
    };

    for (const [groupId, rawGroup] of groupsById.entries()) {
        const group = { ...rawGroup };
        const categoryType = toCategoryTypeFromGroupType(group.type);

        if (!categoryExists(group.categoryId)) {
            const principalName = group.categoryName || "Sem categoria";
            const subName = group.subcategoryName;

            const rootCategory = findOrCreateCategory({
                categoriesById,
                userId: group.userId ?? userId,
                type: categoryType,
                name: principalName,
                parentId: null,
                now,
            });

            if (rootCategory.created) {
                changed = true;
            }

            let finalCategory = rootCategory.category;

            if (subName) {
                const childCategory = findOrCreateCategory({
                    categoriesById,
                    userId: group.userId ?? userId,
                    type: categoryType,
                    name: subName,
                    parentId: rootCategory.category.id,
                    now,
                });

                if (childCategory.created) {
                    changed = true;
                }

                finalCategory = childCategory.category;
            }

            group.categoryId = finalCategory.id;
            const parent = finalCategory.parentId ? categoriesById.get(finalCategory.parentId) : null;
            group.categoryName = parent?.name ?? finalCategory.name;
            group.subcategoryName = parent ? finalCategory.name : null;
            changed = true;
        }

        const category = group.categoryId ? categoriesById.get(group.categoryId) : null;
        if (!category) {
            const fallbackCategoryId = findDefaultCategoryId(group.type, Array.from(categoriesById.values()));
            const fallbackCategory = categoriesById.get(fallbackCategoryId);
            if (fallbackCategory) {
                group.categoryId = fallbackCategory.id;
                group.categoryName = fallbackCategory.name;
                group.subcategoryName = null;
                changed = true;
            }
        } else {
            const parent = category.parentId ? categoriesById.get(category.parentId) : null;
            const expectedCategoryName = parent?.name ?? category.name;
            const expectedSub = parent ? category.name : null;
            if (group.categoryName !== expectedCategoryName || group.subcategoryName !== expectedSub) {
                group.categoryName = expectedCategoryName;
                group.subcategoryName = expectedSub;
                changed = true;
            }
        }

        if (!beneficiaryExists(group.beneficiaryId)) {
            const beneficiaryName = group.beneficiaryName || DEFAULT_BENEFICIARY_NAME;
            const beneficiaryResult = findOrCreateBeneficiary(beneficiariesById, beneficiaryName, group.userId ?? userId, now);
            if (beneficiaryResult.created) {
                changed = true;
            }
            group.beneficiaryId = beneficiaryResult.beneficiary.id;
            group.beneficiaryName = beneficiaryResult.beneficiary.name;
            changed = true;
        } else {
            const beneficiary = group.beneficiaryId ? beneficiariesById.get(group.beneficiaryId) : null;
            if (beneficiary && group.beneficiaryName !== beneficiary.name) {
                group.beneficiaryName = beneficiary.name;
                changed = true;
            }
        }

        groupsById.set(groupId, group);
    }

    return changed;
}

export function normalizeFinanceSnapshot(rawFinance: unknown, userId: string | null = null, options: NormalizeFinanceOptions = {}): NormalizeFinanceResult {
    let changed = false;
    const now = getNowIso();
    const today = getTodayDate();
    const defaultBeneficiaryName = options.defaultBeneficiaryName?.trim() || DEFAULT_BENEFICIARY_NAME;
    const defaultBeneficiaryAvatarImage = asNullableString(options.defaultBeneficiaryAvatarImage, null);

    const financeRecord = isRecord(rawFinance) ? rawFinance : {};
    if (!isRecord(rawFinance)) {
        changed = true;
    }

    const walletsRaw = asArray(financeRecord.wallets);
    if (!Array.isArray(financeRecord.wallets)) {
        changed = true;
    }

    const walletsById = new Map<string, Wallet>();
    walletsRaw.forEach((rawWallet) => {
        if (!isRecord(rawWallet) || typeof rawWallet.id !== "string") {
            changed = true;
            return;
        }

        const normalizedWallet = normalizeWallet({
            id: rawWallet.id,
            name: asString(rawWallet.name, "Carteira"),
            icon: asString(rawWallet.icon, DEFAULT_WALLET.icon),
            type: rawWallet.type as WalletType | undefined,
            balance: asNumber(rawWallet.balance, asNumber(rawWallet.initialBalance, asNumber(rawWallet.startBalance, 0))),
            initialBalance: asNumber(rawWallet.initialBalance, asNumber(rawWallet.startBalance, 0)),
            currency: asString(rawWallet.currency, "BRL"),
            color: asString(rawWallet.color, DEFAULT_WALLET_COLOR),
            isActive: asBoolean(rawWallet.isActive, true),
            createdAt: asDateTimeString(rawWallet.createdAt, now),
        });

        if (walletsById.has(normalizedWallet.id)) {
            changed = true;
            return;
        }

        walletsById.set(normalizedWallet.id, normalizedWallet);
    });

    if (!walletsById.has(DEFAULT_WALLET_ID)) {
        walletsById.set(DEFAULT_WALLET_ID, DEFAULT_WALLET);
        changed = true;
    }

    const normalizedWallets = Array.from(walletsById.values()).sort((a, b) => {
        if (a.id === DEFAULT_WALLET_ID) {
            return -1;
        }
        if (b.id === DEFAULT_WALLET_ID) {
            return 1;
        }
        return a.createdAt.localeCompare(b.createdAt);
    });

    const walletIds = new Set(normalizedWallets.map((wallet) => wallet.id));

    const creditCardsRaw = asArray(financeRecord.creditCards);
    if (!Array.isArray(financeRecord.creditCards)) {
        changed = true;
    }

    const creditCardsById = new Map<string, CreditCard>();
    creditCardsRaw.forEach((rawCard) => {
        if (!isRecord(rawCard) || typeof rawCard.id !== "string") {
            changed = true;
            return;
        }

        const normalizedCard = normalizeCreditCard(
            {
                id: rawCard.id,
                name: asString(rawCard.name, "Cartao"),
                icon: asString(rawCard.icon, DEFAULT_CREDIT_CARD_ICON),
                color: asString(rawCard.color, DEFAULT_WALLET_COLOR),
                limit: asNumber(rawCard.limit, 0),
                closingDay: asDayOfMonth(rawCard.closingDay, 10),
                dueDay: asDayOfMonth(rawCard.dueDay, 15),
                bankWalletId: asNullableString(rawCard.bankWalletId, null),
                isActive: asBoolean(rawCard.isActive, true),
                createdAt: asDateTimeString(rawCard.createdAt, now),
            },
            walletIds,
        );

        if (creditCardsById.has(normalizedCard.id)) {
            changed = true;
            return;
        }

        creditCardsById.set(normalizedCard.id, normalizedCard);
    });

    const normalizedCreditCards = Array.from(creditCardsById.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const creditCardIds = new Set(normalizedCreditCards.map((card) => card.id));

    const rawFavoriteCreditCardId = asNullableString(financeRecord.favoriteCreditCardId, null);
    const normalizedFavoriteCreditCardId =
        rawFavoriteCreditCardId && creditCardIds.has(rawFavoriteCreditCardId)
            ? rawFavoriteCreditCardId
            : normalizedCreditCards[0]?.id ?? null;
    if (rawFavoriteCreditCardId !== normalizedFavoriteCreditCardId) {
        changed = true;
    }

    const creditCardInvoicesRaw = asArray(financeRecord.creditCardInvoices);
    if (!Array.isArray(financeRecord.creditCardInvoices)) {
        changed = true;
    }

    const creditCardInvoicesById = new Map<string, CreditCardInvoice>();
    creditCardInvoicesRaw.forEach((rawInvoice) => {
        if (!isRecord(rawInvoice) || typeof rawInvoice.id !== "string") {
            changed = true;
            return;
        }

        const normalizedInvoice = normalizeCreditCardInvoice(
            {
                id: rawInvoice.id,
                creditCardId: asString(rawInvoice.creditCardId, ""),
                cycleKey: asString(rawInvoice.cycleKey, ""),
                closingDate: asDateString(rawInvoice.closingDate, today),
                dueDate: asDateString(rawInvoice.dueDate, today),
                totalAmount: asNumber(rawInvoice.totalAmount, 0),
                paidAmount: asNumber(rawInvoice.paidAmount, 0),
                status: asInvoiceStatus(rawInvoice.status),
                paidAt: asNullableString(rawInvoice.paidAt, null),
                createdAt: asDateTimeString(rawInvoice.createdAt, now),
                updatedAt: asDateTimeString(rawInvoice.updatedAt, now),
            },
            creditCardIds,
        );

        if (!normalizedInvoice.creditCardId) {
            changed = true;
            return;
        }

        if (creditCardInvoicesById.has(normalizedInvoice.id)) {
            changed = true;
            return;
        }

        creditCardInvoicesById.set(normalizedInvoice.id, normalizedInvoice);
    });

    const categoriesRaw = asArray(financeRecord.categories);
    if (!Array.isArray(financeRecord.categories)) {
        changed = true;
    }

    const categoriesById = new Map<string, Category>();
    categoriesRaw.forEach((rawCategory, index) => {
        if (!isRecord(rawCategory) || typeof rawCategory.id !== "string") {
            changed = true;
            return;
        }

        const rawIcon = asNullableString(rawCategory.icon, null);
        const normalizedRawIcon = rawIcon ?? undefined;
        const rawCategorySortOrder = rawCategory.sortOrder;
        const hasCategorySortOrder = Number.isFinite(asNumber(rawCategorySortOrder, Number.NaN));
        const rawCategoryIsActive = rawCategory.isActive;
        const hasCategoryIsActive = typeof rawCategoryIsActive === "boolean";
        const normalizedCategory = normalizeCategory({
            id: rawCategory.id,
            userId: asNullableString(rawCategory.userId, userId),
            parentId: asNullableString(rawCategory.parentId, null),
            name: asString(rawCategory.name, "Sem categoria"),
            type: asCategoryType(rawCategory.type, "expense"),
            icon: normalizedRawIcon,
            color: asNullableString(rawCategory.color, null),
            isActive: hasCategoryIsActive ? rawCategoryIsActive : true,
            isSystem: asBoolean(rawCategory.isSystem, false),
            sortOrder: hasCategorySortOrder ? asNumber(rawCategorySortOrder, index) : index,
            createdAt: asDateTimeString(rawCategory.createdAt, now),
        });

        if (rawIcon !== normalizedCategory.icon) {
            changed = true;
        }
        if (!hasCategorySortOrder || !hasCategoryIsActive) {
            changed = true;
        }

        if (categoriesById.has(normalizedCategory.id)) {
            changed = true;
            return;
        }

        categoriesById.set(normalizedCategory.id, normalizedCategory);
    });

    if (normalizeSeedCategoryFlags(categoriesById, now)) {
        changed = true;
    }

    const beneficiariesRaw = asArray(financeRecord.beneficiaries);
    if (!Array.isArray(financeRecord.beneficiaries)) {
        changed = true;
    }

    const beneficiariesById = new Map<string, Beneficiary>();
    beneficiariesRaw.forEach((rawBeneficiary, index) => {
        if (!isRecord(rawBeneficiary) || typeof rawBeneficiary.id !== "string") {
            changed = true;
            return;
        }

        const rawAvatarImage = asNullableString(rawBeneficiary.avatarImage, null);
        const rawBeneficiarySortOrder = rawBeneficiary.sortOrder;
        const hasBeneficiarySortOrder = Number.isFinite(asNumber(rawBeneficiarySortOrder, Number.NaN));
        const normalizedBeneficiary = normalizeBeneficiary({
            id: rawBeneficiary.id,
            userId: asNullableString(rawBeneficiary.userId, userId),
            familyId: asNullableString(rawBeneficiary.familyId, null),
            source: rawBeneficiary.source === "family_shared" ? "family_shared" : "personal",
            isSelfProfile: asBoolean(rawBeneficiary.isSelfProfile, false),
            name: asString(rawBeneficiary.name, DEFAULT_BENEFICIARY_NAME),
            type: asBeneficiaryType(rawBeneficiary.type),
            avatarColor: asNullableString(rawBeneficiary.avatarColor, null),
            avatarImage: rawAvatarImage,
            isActive: asBoolean(rawBeneficiary.isActive, true),
            sortOrder: hasBeneficiarySortOrder ? asNumber(rawBeneficiarySortOrder, index) : index,
            createdAt: asDateTimeString(rawBeneficiary.createdAt, now),
        });

        if (rawAvatarImage !== normalizedBeneficiary.avatarImage) {
            changed = true;
        }
        if (!hasBeneficiarySortOrder) {
            changed = true;
        }

        if (beneficiariesById.has(normalizedBeneficiary.id)) {
            changed = true;
            return;
        }

        beneficiariesById.set(normalizedBeneficiary.id, normalizedBeneficiary);
    });

    const sharedBeneficiaries = Array.isArray(options.sharedBeneficiaries) ? options.sharedBeneficiaries : [];
    sharedBeneficiaries.forEach((sharedBeneficiary) => {
        const normalizedSharedBeneficiary = normalizeBeneficiary({
            ...sharedBeneficiary,
            source: "family_shared",
            isSelfProfile: sharedBeneficiary.isSelfProfile ?? true,
            isActive: true,
        });

        const existingBeneficiary = beneficiariesById.get(normalizedSharedBeneficiary.id);
        if (!existingBeneficiary || existingBeneficiary.source !== normalizedSharedBeneficiary.source) {
            beneficiariesById.set(normalizedSharedBeneficiary.id, normalizedSharedBeneficiary);
        }
    });

    if (ensureDefaultBeneficiary(beneficiariesById, userId, now, defaultBeneficiaryName, defaultBeneficiaryAvatarImage)) {
        changed = true;
    }

    const tagsRaw = asArray(financeRecord.tags);
    if (!Array.isArray(financeRecord.tags)) {
        changed = true;
    }

    const tagsById = new Map<string, Tag>();
    tagsRaw.forEach((rawTag, index) => {
        if (!isRecord(rawTag) || typeof rawTag.id !== "string") {
            changed = true;
            return;
        }

        const rawTagSortOrder = rawTag.sortOrder;
        const hasTagSortOrder = Number.isFinite(asNumber(rawTagSortOrder, Number.NaN));
        const rawTagIsActive = rawTag.isActive;
        const hasTagIsActive = typeof rawTagIsActive === "boolean";
        const normalizedTag = normalizeTag({
            id: rawTag.id,
            userId: asNullableString(rawTag.userId, userId),
            name: asString(rawTag.name, "Tag"),
            color: asNullableString(rawTag.color, null),
            isActive: hasTagIsActive ? rawTagIsActive : true,
            sortOrder: hasTagSortOrder ? asNumber(rawTagSortOrder, index) : index,
            createdAt: asDateTimeString(rawTag.createdAt, now),
        });
        if (!hasTagSortOrder || !hasTagIsActive) {
            changed = true;
        }

        if (tagsById.has(normalizedTag.id)) {
            changed = true;
            return;
        }

        tagsById.set(normalizedTag.id, normalizedTag);
    });

    const wishItemsRaw = asArray(financeRecord.wishItems);
    if (!Array.isArray(financeRecord.wishItems)) {
        changed = true;
    }

    const wishItemsById = new Map<string, WishItem>();
    wishItemsRaw.forEach((rawWishItem) => {
        if (!isRecord(rawWishItem) || typeof rawWishItem.id !== "string") {
            changed = true;
            return;
        }

        const normalizedWishItem = normalizeWishItem({
            id: rawWishItem.id,
            userId: asNullableString(rawWishItem.userId, userId),
            value: asNumber(rawWishItem.value, 0),
            categoryId: asString(rawWishItem.categoryId, ""),
            priority: rawWishItem.priority,
            description: asString(rawWishItem.description, "Desejo"),
            link: asNullableString(rawWishItem.link, null),
            isActive: asBoolean(rawWishItem.isActive, true),
            createdAt: asDateTimeString(rawWishItem.createdAt, now),
        });

        if (!normalizedWishItem.categoryId || normalizedWishItem.value <= 0 || !normalizedWishItem.description) {
            changed = true;
            return;
        }

        if (wishItemsById.has(normalizedWishItem.id)) {
            changed = true;
            return;
        }

        wishItemsById.set(normalizedWishItem.id, normalizedWishItem);
    });

    const groupsRaw = asArray(financeRecord.transactionGroups);
    if (!Array.isArray(financeRecord.transactionGroups)) {
        changed = true;
    }

    const groupsById = new Map<string, TransactionGroup>();
    groupsRaw.forEach((rawGroup) => {
        if (!isRecord(rawGroup) || typeof rawGroup.id !== "string") {
            changed = true;
            return;
        }

        let normalizedGroup = normalizeTransactionGroup(
            {
                id: rawGroup.id,
                userId: asNullableString(rawGroup.userId, userId),
                beneficiaryId: asNullableString(rawGroup.beneficiaryId, null),
                beneficiaryName: asString(rawGroup.beneficiaryName, DEFAULT_BENEFICIARY_NAME),
                categoryId: asNullableString(rawGroup.categoryId, null),
                categoryName: asString(rawGroup.categoryName, "Sem categoria"),
                subcategoryName: asNullableString(rawGroup.subcategoryName, null),
                title: asString(rawGroup.title, "Transacao"),
                notes: asNullableString(rawGroup.notes, null),
                type: inferGroupType(rawGroup.type, asNumber(rawGroup.totalAmount, 0)),
                transactionMode: asTransactionMode(rawGroup.transactionMode),
                totalAmount: Math.abs(asNumber(rawGroup.totalAmount, 0)),
                installmentCount: asNumber(rawGroup.installmentCount, NaN),
                recurrenceRule: isRecord(rawGroup.recurrenceRule) ? rawGroup.recurrenceRule : null,
                recurrenceEndDate: asNullableString(rawGroup.recurrenceEndDate, null),
                sourceWalletId: asNullableString(rawGroup.sourceWalletId, null),
                destinationWalletId: asNullableString(rawGroup.destinationWalletId, null),
                creditCardId: asNullableString(rawGroup.creditCardId, null),
                createdAt: asDateTimeString(rawGroup.createdAt, now),
            },
            walletIds,
        );

        if (normalizedGroup.creditCardId && !creditCardIds.has(normalizedGroup.creditCardId)) {
            normalizedGroup = {
                ...normalizedGroup,
                creditCardId: null,
            };
            changed = true;
        }

        if (groupsById.has(normalizedGroup.id)) {
            changed = true;
            return;
        }

        groupsById.set(normalizedGroup.id, normalizedGroup);
    });

    const transactionsRaw = asArray(financeRecord.transactions);
    if (!Array.isArray(financeRecord.transactions)) {
        changed = true;
    }

    const normalizedTransactions: StoredTransaction[] = [];
    const legacyLedgerEntries: LedgerEntry[] = [];

    transactionsRaw.forEach((rawTransaction, index) => {
        if (!isRecord(rawTransaction)) {
            changed = true;
            return;
        }

        const hasNewShape = typeof rawTransaction.groupId === "string";

        if (hasNewShape) {
            let normalizedTransaction = normalizeStoredTransaction({
                id: asString(rawTransaction.id, `tx-${index}-${Date.now()}`),
                groupId: asString(rawTransaction.groupId, `group-${index}-${Date.now()}`),
                installmentNumber: asNumber(rawTransaction.installmentNumber, NaN),
                amount: asNumber(rawTransaction.amount, asNumber(rawTransaction.value, 0)),
                scheduledDate: asDateString(rawTransaction.scheduledDate ?? rawTransaction.date, today),
                status: normalizeTransactionStatus(rawTransaction.status),
                paidAt: asNullableString(rawTransaction.paidAt, null),
                invoiceId: asNullableString(rawTransaction.invoiceId, null),
                notes: asNullableString(rawTransaction.notes, null),
                createdAt: asDateTimeString(rawTransaction.createdAt, now),
            });

            if (!groupsById.has(normalizedTransaction.groupId)) {
                changed = true;
                const fallbackType = inferGroupType(rawTransaction.type, asNumber(rawTransaction.amount, 0));
                const fallbackWalletId = normalizeWalletId(asWalletId(rawTransaction.inWallet));

                groupsById.set(
                    normalizedTransaction.groupId,
                    normalizeTransactionGroup(
                        {
                            id: normalizedTransaction.groupId,
                            userId,
                            beneficiaryId: null,
                            beneficiaryName: asString(rawTransaction.beneficiary, DEFAULT_BENEFICIARY_NAME),
                            categoryId: asNullableString(rawTransaction.categoryId, null),
                            categoryName: isRecord(rawTransaction.category) ? asString(rawTransaction.category.principal, "Sem categoria") : "Sem categoria",
                            subcategoryName: isRecord(rawTransaction.category) ? asNullableString(rawTransaction.category.sub, null) : null,
                            title: asString(rawTransaction.description, "Transacao"),
                            notes: asNullableString(rawTransaction.notes, null),
                            type: fallbackType,
                            transactionMode: "single",
                            totalAmount: Math.abs(asNumber(rawTransaction.amount, 0)),
                            installmentCount: null,
                            recurrenceRule: null,
                            recurrenceEndDate: null,
                            sourceWalletId: fallbackWalletId,
                            destinationWalletId: null,
                            creditCardId: null,
                            createdAt: normalizedTransaction.createdAt,
                        },
                        walletIds,
                    ),
                );
            }

            const normalizedGroup = groupsById.get(normalizedTransaction.groupId);
            if (!normalizedGroup?.creditCardId && normalizedTransaction.invoiceId) {
                normalizedTransaction = normalizeStoredTransaction({
                    ...normalizedTransaction,
                    invoiceId: null,
                });
                changed = true;
            }

            normalizedTransactions.push(normalizedTransaction);
            return;
        }

        changed = true;

        const signedValue = asNumber(rawTransaction.value, 0);
        const amount = Math.abs(signedValue);
        const groupType = inferGroupType(rawTransaction.type, signedValue);
        const walletId = normalizeWalletId(asWalletId(rawTransaction.inWallet));
        const date = asDateString(rawTransaction.date, today);
        const createdAt = isRecord(rawTransaction.meta) ? asDateTimeString(rawTransaction.meta.criado_em, now) : now;
        const paidAtFromMeta = isRecord(rawTransaction.meta) ? asNullableString(rawTransaction.meta.atualizado_em, null) : null;
        const transactionId = asString(rawTransaction.id, `legacy-tx-${index}-${Date.now()}`);
        const groupId = asString(rawTransaction.groupId, `legacy-group-${transactionId}`);
        const status = normalizeTransactionStatus(rawTransaction.status);

        const legacyTransaction = normalizeStoredTransaction({
            id: transactionId,
            groupId,
            installmentNumber: null,
            amount,
            scheduledDate: date,
            status,
            paidAt: paidAtFromMeta,
            invoiceId: null,
            notes: asNullableString(rawTransaction.description, null),
            createdAt,
        });

        const categoryPrincipal = isRecord(rawTransaction.category) ? asString(rawTransaction.category.principal, "Sem categoria") : "Sem categoria";
        const categorySub = isRecord(rawTransaction.category) ? asNullableString(rawTransaction.category.sub, null) : null;
        const title = asString(rawTransaction.description, categoryPrincipal);

        if (!groupsById.has(groupId)) {
            groupsById.set(
                groupId,
                normalizeTransactionGroup(
                    {
                        id: groupId,
                        userId,
                        beneficiaryId: null,
                        beneficiaryName: asString(rawTransaction.beneficiary, DEFAULT_BENEFICIARY_NAME),
                        categoryId: null,
                        categoryName: categoryPrincipal,
                        subcategoryName: categorySub,
                        title,
                        notes: asNullableString(rawTransaction.description, null),
                        type: groupType,
                        transactionMode: "single",
                        totalAmount: amount,
                        installmentCount: null,
                        recurrenceRule: null,
                        recurrenceEndDate: null,
                        sourceWalletId: walletId,
                        destinationWalletId: null,
                        creditCardId: null,
                        createdAt,
                    },
                    walletIds,
                ),
            );
        }

        normalizedTransactions.push(legacyTransaction);

        if (legacyTransaction.status === "paid") {
            const group = groupsById.get(groupId);
            if (group) {
                legacyLedgerEntries.push(...createLedgerEntriesForPaidTransaction(legacyTransaction, group));
            }
        }
    });

    if (resolveGroupEntityLinks(groupsById, categoriesById, beneficiariesById, userId, now)) {
        changed = true;
    }

    const ledgerRaw = asArray(financeRecord.ledgerEntries);
    if (!Array.isArray(financeRecord.ledgerEntries)) {
        changed = true;
    }

    const ledgerEntries: LedgerEntry[] = [];
    ledgerRaw.forEach((rawEntry, index) => {
        if (!isRecord(rawEntry)) {
            changed = true;
            return;
        }

        const walletId = normalizeWalletId(asString(rawEntry.walletId, DEFAULT_WALLET_ID));
        if (!walletIds.has(walletId)) {
            changed = true;
        }

        ledgerEntries.push(
            normalizeLedgerEntry({
                id: asString(rawEntry.id, `le-${index}-${Date.now()}`),
                walletId,
                transactionId: asNullableString(rawEntry.transactionId, null),
                invoiceId: asNullableString(rawEntry.invoiceId, null),
                amount: asNumber(rawEntry.amount, 0),
                balanceAfter: asNumber(rawEntry.balanceAfter, 0),
                description: asString(rawEntry.description, "Lancamento"),
                createdAt: asDateTimeString(rawEntry.createdAt, now),
            }),
        );
    });

    const allLedgerEntries = [...ledgerEntries, ...legacyLedgerEntries];
    const transactionById = new Map(normalizedTransactions.map((transaction) => [transaction.id, transaction]));
    const groupById = new Map(groupsById);
    const existingLedgerByTransaction = new Map<string, LedgerEntry[]>();
    const cleanedLedgerEntries: LedgerEntry[] = [];

    allLedgerEntries.forEach((entry) => {
        if (!entry.transactionId) {
            cleanedLedgerEntries.push(entry);
            return;
        }

        const transaction = transactionById.get(entry.transactionId);
        if (!transaction) {
            cleanedLedgerEntries.push(entry);
            return;
        }

        if (transaction.status !== "paid") {
            changed = true;
            return;
        }

        const existing = existingLedgerByTransaction.get(transaction.id);
        if (existing) {
            existing.push(entry);
        } else {
            existingLedgerByTransaction.set(transaction.id, [entry]);
        }
    });

    normalizedTransactions.forEach((transaction) => {
        const existingEntries = existingLedgerByTransaction.get(transaction.id) ?? [];

        if (transaction.status !== "paid") {
            return;
        }

        const group = groupById.get(transaction.groupId);
        if (!group) {
            cleanedLedgerEntries.push(...existingEntries);
            return;
        }

        const expectedEntries = createLedgerEntriesForPaidTransaction(transaction, group);
        if (existingEntries.length < 1) {
            changed = true;
            cleanedLedgerEntries.push(...expectedEntries);
            return;
        }

        if (canReuseTransactionLedgerEntries(existingEntries, expectedEntries)) {
            cleanedLedgerEntries.push(...existingEntries);
            return;
        }

        changed = true;
        cleanedLedgerEntries.push(...expectedEntries);
    });

    const normalizedGroups = Array.from(groupsById.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const sortedTransactions = [...normalizedTransactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const groupsByIdForInvoices = new Map(normalizedGroups.map((group) => [group.id, group]));
    const existingInvoicesById = new Map(Array.from(creditCardInvoicesById.values()).map((invoice) => [invoice.id, invoice]));
    const invoiceMetaById = new Map<
        string,
        {
            creditCardId: string;
            cycleKey: string;
            closingDate: string;
            dueDate: string;
            createdAt: string;
        }
    >();
    const invoiceTotalsById = new Map<string, number>();

    const transactionsWithResolvedInvoices = sortedTransactions.map((transaction) => {
        const group = groupsByIdForInvoices.get(transaction.groupId);
        const creditCardId = group?.creditCardId ?? null;

        if (!creditCardId) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return normalizeStoredTransaction({
                ...transaction,
                invoiceId: null,
            });
        }

        const creditCard = creditCardsById.get(creditCardId);
        if (!creditCard) {
            if (!transaction.invoiceId) {
                return transaction;
            }

            changed = true;
            return normalizeStoredTransaction({
                ...transaction,
                invoiceId: null,
            });
        }

        const requestedInvoiceId = transaction.invoiceId?.trim() ?? "";
        const parsedRequestedInvoice = requestedInvoiceId ? parseCreditCardInvoiceId(requestedInvoiceId) : null;
        const hasExplicitCycle = Boolean(parsedRequestedInvoice && parsedRequestedInvoice.creditCardId === creditCard.id);
        const resolvedCycle =
            hasExplicitCycle && parsedRequestedInvoice
                ? resolveCreditCardInvoiceCycleFromCycleKey(parsedRequestedInvoice.cycleKey, creditCard.closingDay, creditCard.dueDay)
                : resolveCreditCardInvoiceCycle(transaction.scheduledDate, creditCard.closingDay, creditCard.dueDay);
        const resolvedInvoiceId = hasExplicitCycle && requestedInvoiceId ? requestedInvoiceId : buildCreditCardInvoiceId(creditCard.id, resolvedCycle.cycleKey);
        const existingInvoice = existingInvoicesById.get(resolvedInvoiceId);

        invoiceMetaById.set(resolvedInvoiceId, {
            creditCardId: creditCard.id,
            cycleKey: existingInvoice?.cycleKey ?? resolvedCycle.cycleKey,
            closingDate: resolvedCycle.closingDate,
            dueDate: resolvedCycle.dueDate,
            createdAt: existingInvoice?.createdAt ?? transaction.createdAt,
        });

        if (transaction.status !== "cancelled" && transaction.status !== "skipped") {
            invoiceTotalsById.set(resolvedInvoiceId, roundToCents((invoiceTotalsById.get(resolvedInvoiceId) ?? 0) + Math.abs(transaction.amount)));
        }

        if (transaction.invoiceId === resolvedInvoiceId) {
            return transaction;
        }

        changed = true;
        return normalizeStoredTransaction({
            ...transaction,
            invoiceId: resolvedInvoiceId,
        });
    });

    const normalizedCreditCardInvoices = Array.from(invoiceMetaById.entries())
        .map(([invoiceId, meta]) => {
            const existing = existingInvoicesById.get(invoiceId);
            const totalAmount = roundToCents(invoiceTotalsById.get(invoiceId) ?? 0);
            const paidAmount = roundToCents(Math.min(totalAmount, Math.max(0, existing?.paidAmount ?? 0)));
            const creditCard = creditCardsById.get(meta.creditCardId);
            const status: InvoiceStatus = creditCard
                ? resolveCreditCardInvoiceStatus({
                      invoiceCycleKey: meta.cycleKey,
                      cardClosingDay: creditCard.closingDay,
                      cardDueDay: creditCard.dueDay,
                      totalAmount,
                      paidAmount,
                  })
                : paidAmount >= totalAmount && totalAmount > 0
                  ? "paid"
                  : "open";
            const paidAt = status === "paid" ? existing?.paidAt ?? now : null;

            const invoice = normalizeCreditCardInvoice(
                {
                    id: invoiceId,
                    creditCardId: meta.creditCardId,
                    cycleKey: meta.cycleKey,
                    closingDate: meta.closingDate,
                    dueDate: meta.dueDate,
                    totalAmount,
                    paidAmount,
                    status,
                    paidAt,
                    createdAt: existing?.createdAt ?? meta.createdAt,
                    updatedAt: now,
                },
                creditCardIds,
            );

            if (
                !existing ||
                existing.totalAmount !== invoice.totalAmount ||
                existing.paidAmount !== invoice.paidAmount ||
                existing.status !== invoice.status ||
                existing.creditCardId !== invoice.creditCardId ||
                existing.cycleKey !== invoice.cycleKey ||
                existing.closingDate !== invoice.closingDate ||
                existing.dueDate !== invoice.dueDate ||
                existing.paidAt !== invoice.paidAt
            ) {
                changed = true;
            }

            return invoice;
        })
        .sort((a, b) => {
            if (a.dueDate === b.dueDate) {
                return a.id.localeCompare(b.id);
            }
            return a.dueDate.localeCompare(b.dueDate);
        });

    if (existingInvoicesById.size !== normalizedCreditCardInvoices.length) {
        changed = true;
    }

    const transactionIds = new Set(transactionsWithResolvedInvoices.map((item) => item.id));
    const tagIds = new Set(tagsById.keys());

    const cleanedTransactionTags = normalizeAndCleanTransactionTags(financeRecord.transactionTags, transactionIds, tagIds);
    if (cleanedTransactionTags.changed) {
        changed = true;
    }

    const normalizedCategories = Array.from(categoriesById.values()).sort((a, b) => {
        if (a.type !== b.type) {
            return a.type.localeCompare(b.type);
        }

        if (a.parentId === b.parentId) {
            return compareBySortOrderNameAndId(a, b);
        }

        if (a.parentId === null) {
            return -1;
        }
        if (b.parentId === null) {
            return 1;
        }

        return a.parentId.localeCompare(b.parentId);
    });

    const normalizedBeneficiaries = Array.from(beneficiariesById.values()).sort(compareBySortOrderNameAndId);
    const normalizedTags = Array.from(tagsById.values()).sort(compareBySortOrderNameAndId);
    const normalizedWishItems = Array.from(wishItemsById.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

    return {
        snapshot: createFinanceSnapshot(
            normalizedWallets,
            normalizedCreditCards,
            normalizedCreditCardInvoices,
            normalizedFavoriteCreditCardId,
            normalizedGroups,
            transactionsWithResolvedInvoices,
            cleanedLedgerEntries,
            normalizedBeneficiaries,
            normalizedCategories,
            normalizedTags,
            normalizedWishItems,
            cleanedTransactionTags.links,
            normalizePlanningState(financeRecord.planning),
        ),
        changed,
    };
}
