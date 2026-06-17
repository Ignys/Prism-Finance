import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileUp, ShieldAlert } from "lucide-react";
import { useFinance } from "../../../context/FinanceContext";
import {
    buildBankStatementTransactionDrafts,
    parseBankStatementCsv,
    type BankStatementCsvImportResult,
} from "../../../lib/bankStatementCsvImport";
import { buildFinanceBackupFile, downloadFinanceBackupFile } from "../../../lib/financeBackup";

const CSV_IMPORT_CONFIRMATION_TEXT = "IMPORTAR CSV";

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function getDefaultWalletId(walletIds: Set<string>, favoriteWalletId: string): string {
    if (favoriteWalletId && walletIds.has(favoriteWalletId)) {
        return favoriteWalletId;
    }

    return walletIds.values().next().value ?? "";
}

function ImportPreviewStats({ preview }: { preview: BankStatementCsvImportResult }) {
    const items = [
        { label: "Transacoes", value: preview.transactions.length.toString() },
        { label: "Entradas", value: `${preview.summary.incomeCount} / ${formatCurrency(preview.summary.incomeTotal)}` },
        { label: "Saidas", value: `${preview.summary.spendingCount} / ${formatCurrency(preview.summary.spendingTotal)}` },
        { label: "Ignoradas", value: preview.skippedRows.length.toString() },
    ];

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
            ))}
        </div>
    );
}

export function CsvTransactionImportCard() {
    const { user, profile, finance, favoriteWalletId, wallets, loading, addTransaction } = useFinance();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const availableWallets = useMemo(() => wallets.filter((wallet) => wallet.isActive), [wallets]);
    const availableWalletIds = useMemo(() => new Set(availableWallets.map((wallet) => wallet.id)), [availableWallets]);
    const [selectedWalletId, setSelectedWalletId] = useState(() => getDefaultWalletId(availableWalletIds, favoriteWalletId));
    const [preview, setPreview] = useState<BankStatementCsvImportResult | null>(null);
    const [confirmation, setConfirmation] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
    const canImport =
        Boolean(user && finance && preview && preview.transactions.length > 0 && selectedWalletId) &&
        confirmation.trim().toUpperCase() === CSV_IMPORT_CONFIRMATION_TEXT &&
        !loading &&
        !isImporting;

    useEffect(() => {
        if (selectedWalletId && availableWalletIds.has(selectedWalletId)) {
            return;
        }

        setSelectedWalletId(getDefaultWalletId(availableWalletIds, favoriteWalletId));
    }, [availableWalletIds, favoriteWalletId, selectedWalletId]);

    const resetPreview = () => {
        setPreview(null);
        setConfirmation("");
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            const parsed = parseBankStatementCsv(text);
            const nextWalletId =
                selectedWalletId && availableWalletIds.has(selectedWalletId)
                    ? selectedWalletId
                    : getDefaultWalletId(availableWalletIds, favoriteWalletId);
            setSelectedWalletId(nextWalletId);
            setPreview(parsed);
            setConfirmation("");
            setFeedback({
                type: parsed.transactions.length > 0 ? "success" : "error",
                message:
                    parsed.transactions.length > 0
                        ? "CSV carregado. Revise o resumo antes de importar."
                        : "Nenhuma transacao valida foi encontrada nesse CSV.",
            });
        } catch (error) {
            resetPreview();
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel ler esse CSV.",
            });
        } finally {
            event.target.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (!user || !finance || !preview || !selectedWalletId || isImporting) {
            return;
        }

        if (confirmation.trim().toUpperCase() !== CSV_IMPORT_CONFIRMATION_TEXT) {
            setFeedback({
                type: "error",
                message: `Digite ${CSV_IMPORT_CONFIRMATION_TEXT} para confirmar a importacao.`,
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
            downloadFinanceBackupFile(rollbackBackup, "prism-backup-pre-import-csv");

            const drafts = buildBankStatementTransactionDrafts(preview.transactions, selectedWalletId);
            for (const draft of drafts) {
                await addTransaction(draft);
            }

            setFeedback({
                type: "success",
                message: `${drafts.length} transacoes importadas com sucesso. O estado anterior tambem foi exportado antes da importacao.`,
            });
            resetPreview();
        } catch (error) {
            console.error("Failed to import bank statement CSV:", error);
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel importar esse CSV agora.",
            });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <article className="rounded-lg border border-white/[0.08] bg-[#101010] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-white">
                        <FileSpreadsheet size={18} />
                        <h3 className="text-lg font-semibold">Importar extrato CSV</h3>
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                        Registre transacoes a partir de um extrato com data, titulo, descricao, entrada e saida. A importacao adiciona lancamentos ao estado atual.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!finance || loading || availableWallets.length < 1}
                        className="inline-flex items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition-colors hover:border-sky-300/55 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileUp size={16} />
                        Importar extrato CSV
                    </button>
                </div>
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

            {preview ? (
                <div className="mt-5 rounded-2xl border border-sky-300/25 bg-sky-400/10 p-4">
                    <div className="flex items-start gap-3">
                        <ShieldAlert size={18} className="mt-0.5 text-sky-100" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-sky-100">CSV pronto para importacao</p>
                            <p className="mt-1 text-sm text-sky-50/80">
                                Escolha a carteira e confirme para registrar as transacoes como pagas.
                            </p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <ImportPreviewStats preview={preview} />
                    </div>

                    {preview.skippedRows.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50/85">
                            <p className="font-medium text-amber-100">Linhas ignoradas</p>
                            <ul className="mt-2 space-y-1">
                                {preview.skippedRows.slice(0, 5).map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                            {preview.skippedRows.length > 5 ? <p className="mt-2">Mais {preview.skippedRows.length - 5} linhas foram ignoradas.</p> : null}
                        </div>
                    ) : null}

                    <label className="mt-4 block text-sm text-white/78">
                        <span className="mb-2 block">Carteira de destino</span>
                        <select
                            value={selectedWalletId}
                            onChange={(event) => setSelectedWalletId(event.target.value)}
                            className="w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-white outline-none transition-colors focus:border-sky-200/40"
                        >
                            {availableWallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.id} className="bg-[#101010] text-white">
                                    {wallet.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="mt-4 block text-sm text-white/78">
                        <span className="mb-2 block">
                            Digite <strong>{CSV_IMPORT_CONFIRMATION_TEXT}</strong> para confirmar
                        </span>
                        <input
                            type="text"
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                            className="w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-white outline-none transition-colors focus:border-sky-200/40"
                            placeholder={CSV_IMPORT_CONFIRMATION_TEXT}
                        />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            disabled={!canImport}
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-300/30 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-50 transition-colors hover:border-sky-300/45 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FileUp size={16} />
                            {isImporting ? "Importando..." : "Confirmar importacao CSV"}
                        </button>
                        <button
                            type="button"
                            onClick={resetPreview}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm text-white transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : null}
        </article>
    );
}
