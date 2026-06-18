import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, HardDriveDownload, History, ShieldAlert } from "lucide-react";
import { useFinance } from "../../../context/FinanceContext";
import type { FinanceSnapshot } from "../../../context/FinanceContext";
import { buildFinanceBackupFile, downloadFinanceBackupFile, listLocalFinanceBackups, parseFinanceBackupFile, type FinanceBackupFile, type LocalFinanceBackupRecord } from "../../../lib/financeBackup";
import { CreditCardInvoiceCsvImportCard } from "./CreditCardInvoiceCsvImportCard";
import { CsvTransactionImportCard } from "./CsvTransactionImportCard";

const IMPORT_CONFIRMATION_TEXT = "IMPORTAR";

function formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Data indisponivel";
    }

    return parsed.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function SnapshotStats({ finance }: { finance: FinanceSnapshot }) {
    const items = useMemo(
        () => [
            { label: "Carteiras", value: finance.wallets.length },
            { label: "Cartoes", value: finance.creditCards.length },
            { label: "Faturas", value: finance.creditCardInvoices.length },
            { label: "Grupos", value: finance.transactionGroups.length },
            { label: "Transacoes", value: finance.transactions.length },
            { label: "Lancamentos", value: finance.ledgerEntries.length },
            { label: "Beneficiarios", value: finance.beneficiaries.length },
            { label: "Categorias", value: finance.categories.length },
            { label: "Tags", value: finance.tags.length },
            { label: "Desejos", value: finance.wishItems.length },
            { label: "Vinculos de tags", value: finance.transactionTags.length },
        ],
        [finance],
    );

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                </div>
            ))}
        </div>
    );
}

export function DataSettingsTab() {
    const { user, profile, finance, favoriteWalletId, loading, updateFinance, setFavoriteWallet } = useFinance();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingImport, setPendingImport] = useState<FinanceBackupFile | LocalFinanceBackupRecord | null>(null);
    const [importConfirmation, setImportConfirmation] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
    const [localBackups, setLocalBackups] = useState<LocalFinanceBackupRecord[]>(() => (user ? listLocalFinanceBackups(user.uid) : []));

    const refreshLocalBackups = () => {
        if (!user) {
            setLocalBackups([]);
            return;
        }

        setLocalBackups(listLocalFinanceBackups(user.uid));
    };

    useEffect(() => {
        if (!user) {
            setLocalBackups([]);
            return;
        }

        setLocalBackups(listLocalFinanceBackups(user.uid));
    }, [user]);

    const handleExportCurrent = () => {
        if (!user || !finance) {
            setFeedback({
                type: "error",
                message: "Os dados ainda nao estao prontos para exportacao.",
            });
            return;
        }

        const backup = buildFinanceBackupFile({
            uid: user.uid,
            email: user.email ?? null,
            displayName: profile?.displayName ?? user.displayName ?? null,
            favoriteWalletId,
            finance,
        });

        downloadFinanceBackupFile(backup, "prism-backup");
        setFeedback({
            type: "success",
            message: "Backup exportado com sucesso.",
        });
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            const parsed = parseFinanceBackupFile(JSON.parse(text));
            setPendingImport(parsed);
            setImportConfirmation("");
            setFeedback({
                type: "success",
                message: "Backup carregado. Revise os dados antes de importar.",
            });
        } catch (error) {
            setPendingImport(null);
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel ler esse arquivo de backup.",
            });
        } finally {
            event.target.value = "";
        }
    };

    const queueLocalBackupForImport = (backup: LocalFinanceBackupRecord) => {
        setPendingImport(backup);
        setImportConfirmation("");
        setFeedback({
            type: "success",
            message: "Snapshot local selecionado. Revise os dados antes de restaurar.",
        });
    };

    const handleConfirmImport = async () => {
        if (!user || !finance || !pendingImport || isImporting) {
            return;
        }

        if (importConfirmation.trim().toUpperCase() !== IMPORT_CONFIRMATION_TEXT) {
            setFeedback({
                type: "error",
                message: `Digite ${IMPORT_CONFIRMATION_TEXT} para confirmar a importacao.`,
            });
            return;
        }

        setIsImporting(true);
        setFeedback(null);

        try {
            const rollbackBackup = buildFinanceBackupFile({
                uid: user.uid,
                email: user.email ?? null,
                displayName: profile?.displayName ?? user.displayName ?? null,
                favoriteWalletId,
                finance,
            });
            downloadFinanceBackupFile(rollbackBackup, "prism-backup-pre-import");

            await updateFinance(pendingImport.finance);
            if (pendingImport.preferences.favoriteWalletId) {
                await setFavoriteWallet(pendingImport.preferences.favoriteWalletId);
            }

            setPendingImport(null);
            setImportConfirmation("");
            refreshLocalBackups();
            setFeedback({
                type: "success",
                message: "Backup importado com sucesso. O estado anterior tambem foi exportado antes da restauracao.",
            });
        } catch (error) {
            console.error("Failed to import finance backup:", error);
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel importar esse backup agora.",
            });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <section className="space-y-4">
            <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 text-white">
                            <HardDriveDownload size={18} />
                            <h2 className="text-lg font-semibold">Backups e importacao</h2>
                        </div>
                        <p className="mt-2 text-sm text-white/55">
                            Exporte um snapshot completo dos seus dados, restaure um backup manual e reaproveite snapshots locais recentes
                            gerados pelo proprio app.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportCurrent}
                        disabled={!finance || loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download size={16} />
                        Exportar backup atual
                    </button>
                </div>

                {feedback ? (
                    <div
                        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                            feedback.type === "error"
                                ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
                                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                        }`}
                    >
                        {feedback.message}
                    </div>
                ) : null}

                {finance ? (
                    <div className="mt-4">
                        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/40">Snapshot atual</p>
                        <SnapshotStats finance={finance} />
                    </div>
                ) : null}
            </article>

            <CsvTransactionImportCard />

            <CreditCardInvoiceCsvImportCard />

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
                    <div className="flex items-center gap-2 text-white">
                        <FileUp size={18} />
                        <h3 className="text-lg font-semibold">Importar arquivo</h3>
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                        A importacao substitui o snapshot financeiro atual. Antes de aplicar, o app exporta automaticamente um backup de rollback.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm text-white transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
                        >
                            <FileUp size={16} />
                            Escolher backup JSON
                        </button>
                    </div>

                    {pendingImport ? (
                        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
                            <div className="flex items-start gap-3">
                                <ShieldAlert size={18} className="mt-0.5 text-amber-100" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-amber-100">Backup pronto para importacao</p>
                                    <p className="mt-1 text-sm text-amber-50/80">
                                        Exportado em {formatDateTime(pendingImport.exportedAt)} por {pendingImport.source.displayName || pendingImport.source.email || "usuario desconhecido"}.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <SnapshotStats finance={pendingImport.finance} />
                            </div>

                            <label className="mt-4 block text-sm text-white/78">
                                <span className="mb-2 block">
                                    Digite <strong>{IMPORT_CONFIRMATION_TEXT}</strong> para confirmar
                                </span>
                                <input
                                    type="text"
                                    value={importConfirmation}
                                    onChange={(event) => setImportConfirmation(event.target.value)}
                                    className="w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-white outline-none transition-colors focus:border-amber-200/40"
                                    placeholder={IMPORT_CONFIRMATION_TEXT}
                                />
                            </label>

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handleConfirmImport}
                                    disabled={isImporting || loading}
                                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-50 transition-colors hover:border-amber-300/45 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <FileUp size={16} />
                                    {isImporting ? "Importando..." : "Importar backup"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingImport(null);
                                        setImportConfirmation("");
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm text-white transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : null}
                </article>

                <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
                    <div className="flex items-center gap-2 text-white">
                        <History size={18} />
                        <h3 className="text-lg font-semibold">Snapshots locais recentes</h3>
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                        Estes backups ficam salvos no navegador atual e servem como rede de seguranca adicional para restauracoes rapidas.
                    </p>

                    <div className="mt-4 space-y-3">
                        {localBackups.length < 1 ? (
                            <div className="rounded-xl border border-dashed border-white/[0.12] px-4 py-6 text-sm text-white/45">
                                Nenhum snapshot local encontrado para esta conta neste navegador ainda.
                            </div>
                        ) : (
                            localBackups.map((backup) => (
                                <div key={backup.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-white">{formatDateTime(backup.storedAt)}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">{backup.trigger}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => queueLocalBackupForImport(backup)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/12 px-3 py-1.5 text-xs font-medium text-amber-50 transition-colors hover:border-amber-300/40 hover:bg-amber-400/18"
                                            >
                                                Restaurar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => downloadFinanceBackupFile(backup, "prism-backup-local")}
                                                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs text-white transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
                                            >
                                                Baixar
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <SnapshotStats finance={backup.finance} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </article>
            </section>
        </section>
    );
}
