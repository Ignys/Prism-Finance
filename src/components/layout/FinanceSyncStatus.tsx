import { RefreshCw } from "lucide-react";
import { useFinanceSync } from "../../context/FinanceContext";

interface FinanceSyncStatusProps {
    compactAtLaptop?: boolean;
}

export function FinanceSyncStatus({ compactAtLaptop = false }: FinanceSyncStatusProps) {
    const sync = useFinanceSync();
    const isSynced = sync.status === "synced" && sync.pendingCount === 0;
    const label = isSynced ? "Dados sincronizados" : sync.status === "error" ? "Sincronização pendente" : "Sincronizando dados...";
    const dotClassName = isSynced ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]" : "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.45)]";
    const responsiveLabelClassName = compactAtLaptop ? "laptop:max-w-0 laptop:opacity-0 desktop:max-w-44 desktop:opacity-100" : "";

    return (
        <div
            className={[
                "mb-2 flex flex-col gap-1.5 px-2",
                compactAtLaptop ? "laptop:items-center laptop:px-0 desktop:items-stretch desktop:px-2" : "",
            ].join(" ")}
        >
            <div
                className={[
                    "flex min-w-0 items-center gap-2 transition-[gap] duration-300 ease-out",
                    compactAtLaptop ? "laptop:gap-0 desktop:gap-2" : "",
                ].join(" ")}
                title={compactAtLaptop ? label : undefined}
            >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClassName} ${sync.status === "syncing" ? "animate-pulse" : ""}`} />
                <span
                    className={[
                        "max-w-44 min-w-0 truncate whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-white/70",
                        "transition-[max-width,opacity] duration-300 ease-out",
                        responsiveLabelClassName,
                    ].join(" ")}
                >
                    {label}
                </span>
            </div>

            {sync.status === "error" ? (
                <button
                    type="button"
                    onClick={sync.retrySync}
                    aria-label="Tentar sincronizar novamente"
                    title={compactAtLaptop ? "Tentar sincronizar novamente" : undefined}
                    className={[
                        "inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-200 transition-colors hover:text-orange-100",
                        compactAtLaptop ? "laptop:h-8 laptop:w-8 laptop:justify-center laptop:gap-0 desktop:h-auto desktop:w-auto desktop:justify-start desktop:gap-1.5" : "",
                    ].join(" ")}
                >
                    <RefreshCw className="shrink-0" size={12} />
                    <span
                        className={[
                            "max-w-28 overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-300 ease-out",
                            compactAtLaptop ? "laptop:max-w-0 laptop:opacity-0 desktop:max-w-28 desktop:opacity-100" : "",
                        ].join(" ")}
                    >
                        Tentar agora
                    </span>
                </button>
            ) : null}
        </div>
    );
}
