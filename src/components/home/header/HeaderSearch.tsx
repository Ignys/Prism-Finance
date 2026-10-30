import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useFinanceTransactions, useFinanceWallets } from "../../../context/FinanceContext";
import { getMonthKeyFromDateValue } from "../../../context/financeTypes";
import { normalizeComparisonText } from "../../../context/finance/helpers";
import { usePage } from "../../../context/PageContext";
import { getTransactionSearchSource } from "../../pages/transactions/transactionsPageShared";

const MAX_RESULTS = 6;
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function HeaderSearch() {
    const transactions = useFinanceTransactions();
    const wallets = useFinanceWallets();
    const { goToPage } = usePage();
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                inputRef.current?.focus();
            }
        }

        function handleClickOutside(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("keydown", handleShortcut);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("keydown", handleShortcut);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const results = useMemo(() => {
        const normalizedQuery = normalizeComparisonText(query.trim());
        if (!normalizedQuery) {
            return [];
        }

        const walletNameById = new Map(wallets.map((wallet) => [wallet.id, wallet.name]));
        // ponytail: compras no cartão ficam fora (vivem na página de faturas); incluir quando a busca souber abrir a fatura.
        return transactions
            .filter((transaction) => transaction.paymentMethod !== "credit_card")
            .filter((transaction) => {
                const walletName = walletNameById.get(transaction.inWallet) ?? "";
                const destinationWalletName = transaction.destinationWalletId ? (walletNameById.get(transaction.destinationWalletId) ?? "") : "";
                return normalizeComparisonText(getTransactionSearchSource(transaction, walletName, destinationWalletName)).includes(normalizedQuery);
            })
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, MAX_RESULTS);
    }, [query, transactions, wallets]);

    function openResult(index: number) {
        const transaction = results[index];
        if (!transaction) {
            return;
        }

        goToPage("transactions", {
            page: "transactions",
            tab: transaction.type === "income" ? "income" : transaction.type === "transfer" ? "transfer" : "spending",
            selectedMonth: getMonthKeyFromDateValue(transaction.date),
            targetTransactionId: transaction.id,
        });
        setQuery("");
        setIsOpen(false);
        inputRef.current?.blur();
    }

    function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter") {
            openResult(activeIndex);
        } else if (event.key === "Escape") {
            setIsOpen(false);
            inputRef.current?.blur();
        }
    }

    const showResults = isOpen && query.trim().length > 0;

    return (
        <div ref={containerRef} className="relative w-full max-w-[460px]">
            <label className="group flex h-10 items-center gap-2.5 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3 transition-colors hover:bg-white/[0.05] focus-within:border-white/[0.18] focus-within:bg-white/[0.06]">
                <Search size={16} className="shrink-0 text-white/40 group-focus-within:text-white/70" />
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar transações"
                    aria-label="Buscar transações"
                    aria-expanded={showResults}
                    aria-controls="header-search-results"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:hidden"
                />
                <kbd className="hidden shrink-0 rounded-md border border-white/[0.1] px-1.5 py-0.5 font-sans text-[11px] text-white/40 sm:inline">Ctrl K</kbd>
            </label>

            {showResults ? (
                <div
                    id="header-search-results"
                    role="listbox"
                    className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-white/[0.1] bg-neutral-950 p-1 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.85)]"
                >
                    {results.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-white/45">Nenhuma transação encontrada para “{query.trim()}”.</p>
                    ) : (
                        results.map((transaction, index) => (
                            <button
                                key={transaction.id}
                                type="button"
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => openResult(index)}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-white/[0.08]" : ""}`}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-white/90">{transaction.description || transaction.category.label}</span>
                                    <span className="block truncate text-xs text-white/40">
                                        {transaction.category.label}, {dateFormatter.format(new Date(`${transaction.date}T00:00:00`))}
                                    </span>
                                </span>
                                <span
                                    className={`shrink-0 text-[13px] ${transaction.type === "income" ? "text-emerald-300" : "text-white/75"}`}
                                    style={{ fontFamily: "'Azeret Mono', monospace", fontVariantNumeric: "tabular-nums" }}
                                >
                                    {transaction.type === "income" ? "+" : transaction.type === "spending" ? "−" : ""}
                                    {currencyFormatter.format(transaction.value)}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}
