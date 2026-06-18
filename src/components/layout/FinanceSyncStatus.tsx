import { RefreshCw } from "lucide-react";
import { useFinanceSync } from "../../context/FinanceContext";

export function FinanceSyncStatus() {
    const sync = useFinanceSync();
    const isSynced = sync.status === "synced" && sync.pendingCount === 0;
    const label = isSynced ? "Dados sincronizados" : sync.status === "error" ? "Sincronização pendente" : "Sincronizando dados...";
    const dotClassName = isSynced ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]" : "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.45)]";

    return (
        <div className="flex items-center px-2 mb-2">
            <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClassName} ${sync.status === "syncing" ? "animate-pulse" : ""}`} />
                <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">{label}</span>
            </div>

            {sync.status === "error" ? (
                <button
                    type="button"
                    onClick={sync.retrySync}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-200 transition-colors hover:text-orange-100"
                >
                    <RefreshCw size={12} />
                    Tentar agora
                </button>
            ) : null}
        </div>
    );
}
