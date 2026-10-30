import { createElement, useMemo, type ReactNode } from "react";
import { CreditCard, FileText, PiggyBank, Settings, Tag, TrendingUp, UserRound, Wallet } from "lucide-react";
import {
    useFinanceBeneficiaries,
    useFinanceCategories,
    useFinanceCreditCardInvoices,
    useFinanceCreditCards,
    useFinancePlanning,
    useFinanceTags,
    useFinanceTransactionGroups,
    useFinanceTransactions,
    useFinanceWallets,
    useFinanceWishItems,
} from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { type AppPage, type PageNavigationIntent } from "../../../context/PageContext";
import { APP_NAVIGATION_ITEMS, REGISTRY_NAVIGATION_SUBITEMS, TRANSACTION_NAVIGATION_SUBITEMS } from "../../layout/appNavigation";
import { buildBudgetRuleOptions, createBudgetRuleResolver, getBudgetDisplayName } from "../../pages/budgets/budgetRuleOptions";
import { getTransactionSearchSource } from "../../pages/transactions/transactionsPageShared";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { normalizeWalletColor } from "../../../lib/walletVisual";
import { BeneficiaryAvatar } from "../BeneficiaryAvatar";
import { WalletAvatar } from "../WalletAvatar";

export interface CommandItem {
    id: string;
    group: string;
    label: string;
    hint: string;
    keywords: string;
    icon: ReactNode;
    /** Cor própria do item (categoria, tag, cartão); sem ela, a cor do grupo. */
    color?: string;
    /** Avatar pronto (carteira, cartão, beneficiário) que substitui o quadro do ícone. */
    media?: ReactNode;
    amount?: { value: number; tone: "income" | "spending" | "neutral" };
    /** `path` vence `page` quando o destino é uma subpágina sem AppPage própria (ex.: /budgets/:id). */
    target: { page: AppPage; intent?: PageNavigationIntent; path?: string };
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

const icon = (component: typeof Wallet) => createElement(component, { size: 16, strokeWidth: 2 });
const formatMonth = (monthKey: string) => monthFormatter.format(new Date(`${monthKey}-01T00:00:00`));
const categoryIcon = (name: string | null | undefined, type: Parameters<typeof getCategoryIconComponent>[1]) => createElement(getCategoryIconComponent(name, type), { size: 16, strokeWidth: 2 });

/** Índice de tudo que a paleta encontra. Só monta quando a paleta está aberta. */
export function useCommandItems(enabled: boolean): CommandItem[] {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const invoices = useFinanceCreditCardInvoices();
    const categories = useFinanceCategories();
    const beneficiaries = useFinanceBeneficiaries();
    const tags = useFinanceTags();
    const wishItems = useFinanceWishItems();
    const planning = useFinancePlanning();
    const groups = useFinanceTransactionGroups();

    return useMemo(() => {
        if (!enabled) {
            return [];
        }

        const walletName = new Map(wallets.map((wallet) => [wallet.id, wallet.name]));
        const cardName = new Map(creditCards.map((card) => [card.id, card.name]));
        const cardColor = new Map(creditCards.map((card) => [card.id, normalizeWalletColor(card.color)]));
        const categoryById = new Map(categories.map((category) => [category.id, category]));
        const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
        const items: CommandItem[] = [];

        for (const nav of APP_NAVIGATION_ITEMS) {
            items.push({ id: `page:${nav.page}`, group: "Páginas", label: nav.label, hint: "Página", keywords: nav.description, icon: nav.icon, target: { page: nav.page } });
        }
        for (const [parent, subitems] of [["Transações", TRANSACTION_NAVIGATION_SUBITEMS], ["Cadastros", REGISTRY_NAVIGATION_SUBITEMS]] as const) {
            for (const sub of subitems) {
                items.push({ id: `page:${sub.id}`, group: "Páginas", label: sub.label, hint: `Página em ${parent}`, keywords: parent, icon: sub.marker, target: { page: sub.id as AppPage } });
            }
        }
        items.push({ id: "page:settings", group: "Páginas", label: "Configurações", hint: "Página", keywords: "perfil conta família preferências", icon: icon(Settings), target: { page: "settings" } });

        for (const wallet of wallets) {
            items.push({ id: `wallet:${wallet.id}`, group: "Carteiras", label: wallet.name, hint: "Carteira", keywords: "carteira conta", icon: icon(Wallet), media: createElement(WalletAvatar, { wallet, className: "size-8 rounded-[10px]", iconSize: 15 }), amount: { value: wallet.balance, tone: "neutral" }, target: { page: "wallets" } });
        }

        const currentMonth = getMonthKeyFromDateValue(new Date().toISOString().slice(0, 10));
        for (const card of creditCards) {
            items.push({
                id: `card:${card.id}`,
                group: "Cartões",
                label: card.name,
                hint: "Cartão",
                keywords: "cartão crédito",
                icon: icon(CreditCard),
                media: createElement(WalletAvatar, { wallet: card, className: "size-8 rounded-[10px]", iconSize: 15 }),
                amount: { value: card.limit, tone: "neutral" },
                target: { page: "statement", intent: { page: "statement", selectedCardId: card.id, selectedMonth: currentMonth } },
            });
        }

        for (const invoice of [...invoices].sort((a, b) => b.dueDate.localeCompare(a.dueDate))) {
            const name = cardName.get(invoice.creditCardId) ?? "Cartão";
            const month = formatMonth(invoice.dueDate.slice(0, 7));
            items.push({
                id: `invoice:${invoice.id}`,
                group: "Faturas",
                label: `Fatura ${name}, ${month}`,
                hint: "Fatura",
                keywords: `fatura ${invoice.status} ${invoice.dueDate}`,
                icon: icon(FileText),
                color: cardColor.get(invoice.creditCardId),
                amount: { value: invoice.totalAmount, tone: "spending" },
                target: { page: "statement", intent: { page: "statement", selectedCardId: invoice.creditCardId, selectedMonth: invoice.dueDate.slice(0, 7) } },
            });
        }

        const { labelOf } = createBudgetRuleResolver(buildBudgetRuleOptions({ categories, groups, tags, beneficiaries, wallets, creditCards }));
        for (const budget of planning.budgets) {
            items.push({ id: `budget:${budget.id}`, group: "Orçamentos", label: getBudgetDisplayName(budget, labelOf), hint: "Orçamento", keywords: "orçamento teto limite", icon: icon(PiggyBank), amount: { value: budget.amount, tone: "neutral" }, target: { page: "budgets", path: `/budgets/${budget.id}` } });
        }

        const projections = [
            ...planning.simulatedExpenses.map((entry) => ({ ...entry, kind: "Projeção de despesa", tone: "spending" as const })),
            ...planning.simulatedIncomes.map((entry) => ({ ...entry, kind: "Projeção de receita", tone: "income" as const })),
        ];
        for (const entry of projections) {
            items.push({ id: `projection:${entry.id}`, group: "Projeções", label: entry.description, hint: entry.kind, keywords: "projeção simulação planejamento", icon: icon(TrendingUp), amount: { value: entry.amount, tone: entry.tone }, target: { page: "planning" } });
        }

        for (const item of wishItems) {
            items.push({ id: `wish:${item.id}`, group: "Lista de desejos", label: item.description, hint: "Desejo", keywords: "desejo wishlist", icon: categoryIcon(categoryById.get(item.categoryId)?.icon, "expense"), color: categoryById.get(item.categoryId)?.color ?? undefined, amount: { value: item.value, tone: "neutral" }, target: { page: "wishlist" } });
        }

        for (const category of categories) {
            items.push({ id: `category:${category.id}`, group: "Categorias", label: category.name, hint: "Categoria", keywords: "categoria", icon: categoryIcon(category.icon, category.type), color: category.color ?? undefined, target: { page: "categories" } });
        }
        for (const beneficiary of beneficiaries) {
            items.push({ id: `beneficiary:${beneficiary.id}`, group: "Beneficiários", label: beneficiary.name, hint: "Beneficiário", keywords: "beneficiário pessoa", icon: icon(UserRound), media: createElement(BeneficiaryAvatar, { beneficiary, className: "size-8 rounded-[10px]" }), target: { page: "beneficiaries" } });
        }
        for (const tag of tags) {
            items.push({ id: `tag:${tag.id}`, group: "Tags", label: tag.name, hint: "Tag", keywords: "tag etiqueta", icon: icon(Tag), color: tag.color ?? undefined, target: { page: "tags" } });
        }

        for (const transaction of [...transactions].sort((a, b) => b.date.localeCompare(a.date))) {
            const wallet = walletName.get(transaction.inWallet) ?? "";
            const destination = transaction.destinationWalletId ? (walletName.get(transaction.destinationWalletId) ?? "") : "";
            const invoice = transaction.invoiceId ? invoiceById.get(transaction.invoiceId) : undefined;
            // Compra no cartão abre a fatura onde ela caiu; o resto abre na aba de transações.
            const target: CommandItem["target"] =
                transaction.paymentMethod === "credit_card" && transaction.creditCardId
                    ? { page: "statement", intent: { page: "statement", selectedCardId: transaction.creditCardId, selectedMonth: invoice ? invoice.dueDate.slice(0, 7) : getMonthKeyFromDateValue(transaction.date) } }
                    : {
                          page: "transactions",
                          intent: { page: "transactions", tab: transaction.type, selectedMonth: getMonthKeyFromDateValue(transaction.date), targetTransactionId: transaction.id },
                      };
            items.push({
                id: `transaction:${transaction.id}`,
                group: "Transações",
                label: transaction.description || transaction.category.label,
                hint: "Transação",
                keywords: getTransactionSearchSource(transaction, wallet, destination),
                icon: categoryIcon(transaction.category.icon, transaction.category.type),
                color: transaction.category.color ?? undefined,
                amount: { value: transaction.value, tone: transaction.type === "income" ? "income" : transaction.type === "spending" ? "spending" : "neutral" },
                target,
            });
        }

        return items;
    }, [enabled, transactions, wallets, creditCards, invoices, categories, beneficiaries, tags, wishItems, planning, groups]);
}
