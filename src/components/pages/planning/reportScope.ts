import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReportScope } from "./planningReportsUtils";

export type ReportScopeKind = "empty" | "wallet" | "wallets" | "card" | "cards" | "combined";

const STORAGE_KEY = "prism.reports.scope";
const WALLETS_PARAM = "carteiras";
const CARDS_PARAM = "cartoes";

export function getReportScopeKind({ walletIds, creditCardIds }: ReportScope): ReportScopeKind {
    if (walletIds.length > 0 && creditCardIds.length > 0) return "combined";
    if (walletIds.length > 0) return walletIds.length === 1 ? "wallet" : "wallets";
    if (creditCardIds.length > 0) return creditCardIds.length === 1 ? "card" : "cards";
    return "empty";
}

function readStoredScope(): ReportScope | null {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
        if (!parsed || typeof parsed !== "object") return null;
        const { walletIds, creditCardIds } = parsed as Record<string, unknown>;
        const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string");
        return isIdList(walletIds) && isIdList(creditCardIds) ? { walletIds, creditCardIds } : null;
    } catch {
        return null;
    }
}

function readParam(params: URLSearchParams, name: string): string[] {
    return (params.get(name) ?? "").split(",").filter(Boolean);
}

/**
 * Seleção de contas do relatório: link com parâmetros > última escolha salva > todas as contas.
 * Uma escolha salva que não bate com nenhuma conta atual (outro usuário no mesmo navegador) vale como primeira visita.
 */
export function useReportScope(allWalletIds: string[], allCreditCardIds: string[]): [ReportScope, (scope: ReportScope) => void] {
    const [searchParams, setSearchParams] = useSearchParams();
    const [stored, setStored] = useState(readStoredScope);
    const requested = useMemo(
        () =>
            searchParams.has(WALLETS_PARAM) || searchParams.has(CARDS_PARAM)
                ? { walletIds: readParam(searchParams, WALLETS_PARAM), creditCardIds: readParam(searchParams, CARDS_PARAM) }
                : stored,
        [searchParams, stored],
    );

    const scope = useMemo(() => {
        const walletIds = allWalletIds.filter((id) => requested?.walletIds.includes(id));
        const creditCardIds = allCreditCardIds.filter((id) => requested?.creditCardIds.includes(id));
        const requestedSomething = requested !== null && requested.walletIds.length + requested.creditCardIds.length > 0;
        const matchedNothing = walletIds.length + creditCardIds.length === 0;
        return requested === null || (requestedSomething && matchedNothing) ? { walletIds: allWalletIds, creditCardIds: allCreditCardIds } : { walletIds, creditCardIds };
    }, [allCreditCardIds, allWalletIds, requested]);

    const setScope = useCallback(
        (next: ReportScope) => {
            setStored(next);
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Sem armazenamento local a escolha vale só para esta visita.
            }
            setSearchParams(
                (params) => {
                    params.set(WALLETS_PARAM, next.walletIds.join(","));
                    params.set(CARDS_PARAM, next.creditCardIds.join(","));
                    return params;
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    return [scope, setScope];
}
