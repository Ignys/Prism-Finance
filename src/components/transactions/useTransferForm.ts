import { useEffect, useMemo, useState } from "react";
import {
    DEFAULT_WALLET_ID,
    type Transaction,
    type TransactionStatus,
    useFinanceActions,
    useFinanceFavoriteWallet,
    useFinanceTags,
    useFinanceWallets,
} from "../../context/FinanceContext";
import { createId } from "../../context/finance/helpers";
import { getLocalDateFromOffset, getLocalTodayDate, parseDateOnlyToLocalDate } from "../../lib/localDate";
import { extractCurrencyDigits, formatCurrencyFromDigits, parseCurrencyDigitsToNumber } from "../../lib/currencyMask";

export interface TransferFormPrefill {
    initialDate?: string;
    initialAmount?: number;
    initialSourceWalletId?: string;
    initialDestinationWalletId?: string | null;
    initialDescription?: string;
    initialTagIds?: string[];
    initialStatus?: TransactionStatus;
}

interface UseTransferFormOptions {
    prefill?: TransferFormPrefill;
    transaction?: Transaction | null;
}

function formatAmountInputFromValue(value: number): string {
    const cents = Math.max(0, Math.round(Math.abs(value) * 100));
    return formatCurrencyFromDigits(String(cents));
}

function resolveInitialDate(prefillDate?: string): string {
    const normalizedPrefillDate = prefillDate?.trim() ?? "";
    if (!normalizedPrefillDate) {
        return getLocalTodayDate();
    }

    return parseDateOnlyToLocalDate(normalizedPrefillDate) ? normalizedPrefillDate : getLocalTodayDate();
}

export function useTransferForm({ prefill, transaction }: UseTransferFormOptions = {}) {
    const wallets = useFinanceWallets();
    const tags = useFinanceTags();
    const favoriteWalletId = useFinanceFavoriteWallet();
    const { addTransaction, updateTransaction } = useFinanceActions();
    const isEditing = Boolean(transaction);

    const sourceWallets = useMemo(() => {
        const keepWalletIds = new Set([transaction?.inWallet, transaction?.destinationWalletId].filter((walletId): walletId is string => Boolean(walletId)));
        const activeWallets = wallets.filter((wallet) => wallet.isActive || keepWalletIds.has(wallet.id));
        return activeWallets.length > 0 ? activeWallets : wallets;
    }, [transaction?.destinationWalletId, transaction?.inWallet, wallets]);

    const [amountInput, setAmountInputState] = useState(() => transaction ? formatAmountInputFromValue(transaction.value) : typeof prefill?.initialAmount === "number" ? formatAmountInputFromValue(prefill.initialAmount) : "R$ 0,00");
    const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? prefill?.initialStatus ?? "paid");
    const [sourceWalletId, setSourceWalletId] = useState(() => transaction?.inWallet ?? prefill?.initialSourceWalletId ?? favoriteWalletId ?? DEFAULT_WALLET_ID);
    const [destinationWalletId, setDestinationWalletId] = useState<string | null>(transaction?.destinationWalletId ?? prefill?.initialDestinationWalletId ?? null);
    const [date, setDate] = useState(() => transaction?.date ?? resolveInitialDate(prefill?.initialDate));
    const [description, setDescription] = useState(transaction?.description ?? prefill?.initialDescription ?? "");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(transaction?.tagIds ?? prefill?.initialTagIds ?? []);
    const [draftTransactionId] = useState(() => createId("tx"));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const amountValue = useMemo(() => parseCurrencyDigitsToNumber(extractCurrencyDigits(amountInput)), [amountInput]);

    useEffect(() => {
        if (!transaction) {
            return;
        }

        setAmountInputState(formatAmountInputFromValue(transaction.value));
        setStatus(transaction.status);
        setSourceWalletId(transaction.inWallet);
        setDestinationWalletId(transaction.destinationWalletId ?? null);
        setDate(transaction.date);
        setDescription(transaction.description ?? "");
        setSelectedTagIds(transaction.tagIds ?? []);
        setErrorMessage(null);
    }, [transaction]);

    useEffect(() => {
        const fallbackWalletId =
            sourceWallets.find((wallet) => wallet.id === favoriteWalletId)?.id ??
            sourceWallets[0]?.id ??
            wallets.find((wallet) => wallet.id === favoriteWalletId)?.id ??
            wallets[0]?.id ??
            DEFAULT_WALLET_ID;

        if (!sourceWallets.some((wallet) => wallet.id === sourceWalletId)) {
            setSourceWalletId(fallbackWalletId);
        }
    }, [favoriteWalletId, sourceWalletId, sourceWallets, wallets]);

    useEffect(() => {
        if (!destinationWalletId) {
            return;
        }

        const hasDestination = sourceWallets.some((wallet) => wallet.id === destinationWalletId);
        if (!hasDestination || destinationWalletId === sourceWalletId) {
            setDestinationWalletId(null);
        }
    }, [destinationWalletId, sourceWalletId, sourceWallets]);

    const setAmountInput = (value: string) => {
        const digits = extractCurrencyDigits(value);
        setAmountInputState(formatCurrencyFromDigits(digits));
        setErrorMessage(null);
    };

    const setDateOffset = (offsetInDays: number) => {
        setDate(getLocalDateFromOffset(offsetInDays));
    };

    const submit = async () => {
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setErrorMessage("Informe um valor maior que zero.");
            return false;
        }

        if (!sourceWallets.some((wallet) => wallet.id === sourceWalletId)) {
            setErrorMessage("Selecione a carteira de origem.");
            return false;
        }

        if (destinationWalletId && destinationWalletId === sourceWalletId) {
            setErrorMessage("A carteira de destino deve ser diferente da origem.");
            return false;
        }

        const trimmedDescription = description.trim();

        const draft = {
            id: transaction ? undefined : draftTransactionId,
            type: "transfer" as const,
            value: amountValue,
            date: date || getLocalTodayDate(),
            inWallet: sourceWalletId,
            destinationWalletId,
            paymentMethod: "wallet" as const,
            creditCardId: null,
            categoryId: null,
            beneficiaryId: null,
            tagIds: selectedTagIds,
            description: trimmedDescription || "Transferencia",
            status,
            notes: trimmedDescription || undefined,
            transactionMode: "single" as const,
            installmentCount: null,
            recurrenceRule: null,
            recurrenceEndDate: null,
        };

        if (transaction) {
            await updateTransaction({
                transaction,
                draft,
                scope: "single",
            });
        } else {
            await addTransaction(draft);
        }

        return true;
    };

    return {
        isEditing,
        transactionId: transaction?.id ?? draftTransactionId,
        amountInput,
        amountValue,
        status,
        sourceWalletId,
        destinationWalletId,
        date,
        description,
        selectedTagIds,
        errorMessage,
        sourceWallets,
        tags,
        setAmountInput,
        setStatus,
        setSourceWalletId,
        setDestinationWalletId,
        setDate,
        setDateOffset,
        setDescription,
        setSelectedTagIds,
        submit,
    };
}
