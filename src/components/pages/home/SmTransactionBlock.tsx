import { useModal } from "../../../context/ModalContext";
import { type Transaction, useFinanceCreditCards, useFinanceWallets } from "../../../context/FinanceContext";
import { getCategoryIconComponent } from "../../../lib/categoryIcons";
import { getTransactionCategoryDisplayLabel } from "../../../lib/transactionCategory";
import { WalletAvatar } from "../../common/WalletAvatar";
import { EditTransaction } from "../../modal/EditTransaction";
import { formatCurrencyBRL, getTransactionTypeMeta, resolveTransactionWallet } from "../../transactions/transactionView";

const FALLBACK_COLOR = "#737373";

export function MiniTransactionBlock({ transaction, showSign = true }: { transaction: Transaction; showSign?: boolean }) {
    const { openModal } = useModal();
    const wallets = useFinanceWallets();
    const creditCards = useFinanceCreditCards();
    const wallet = resolveTransactionWallet(wallets, transaction.inWallet);
    const creditCard = transaction.creditCardId ? creditCards.find((card) => card.id === transaction.creditCardId) : null;
    const paymentSource = transaction.paymentMethod === "credit_card" && creditCard ? creditCard : wallet;

    const typeMeta = getTransactionTypeMeta(transaction.type);
    const color = transaction.category.color ?? FALLBACK_COLOR;
    const CategoryIcon = getCategoryIconComponent(transaction.category.icon, transaction.category.type);
    const sign = !showSign ? "" : transaction.type === "income" ? "+" : transaction.type === "spending" ? "−" : "";

    return (
        <button
            type="button"
            onClick={() => openModal(<EditTransaction transaction={transaction} />)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
            >
                <CategoryIcon size={18} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{transaction.description || "Sem descrição"}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
                    <WalletAvatar wallet={paymentSource} className="h-4 w-4 shrink-0 rounded" iconSize={10} />
                    <span className="truncate">{paymentSource.name}</span>
                    <span className="h-3 w-px shrink-0 bg-white/10" />
                    <span className="truncate">{getTransactionCategoryDisplayLabel(transaction.category)}</span>
                </span>
            </span>

            <span className={`shrink-0 text-sm font-semibold tabular-nums ${typeMeta.amountColorClass}`}>
                {sign && `${sign} `}R$ {formatCurrencyBRL(transaction.value)}
            </span>
        </button>
    );
}
