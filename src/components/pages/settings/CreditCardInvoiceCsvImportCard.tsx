import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, FileSpreadsheet, FileUp, ShieldAlert } from "lucide-react";
import { useFinance } from "../../../context/FinanceContext";
import {
    buildCreditCardInvoiceImportSnapshot,
    parseCreditCardInvoiceCsv,
    type CreditCardInvoiceCsvImportResult,
} from "../../../lib/creditCardInvoiceCsvImport";
import { buildFinanceBackupFile, downloadFinanceBackupFile } from "../../../lib/financeBackup";

const INVOICE_CSV_IMPORT_CONFIRMATION_TEXT = "IMPORTAR FATURA";

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function formatDate(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
        return value;
    }
    return `${day}/${month}/${year}`;
}

function getDefaultCreditCardId(cardIds: Set<string>, favoriteCreditCardId: string | null): string {
    if (favoriteCreditCardId && cardIds.has(favoriteCreditCardId)) {
        return favoriteCreditCardId;
    }

    return cardIds.values().next().value ?? "";
}

function ImportPreviewStats({ preview }: { preview: CreditCardInvoiceCsvImportResult }) {
    const items = [
        { label: "Compras unicas", value: preview.summary.singleCount.toString() },
        { label: "Series parceladas", value: preview.summary.installmentSeriesCount.toString() },
        { label: "Encargos", value: preview.summary.feeCount.toString() },
        { label: "Parcelas ignoradas", value: preview.summary.ignoredInstallmentsCount.toString() },
        { label: "Total importado", value: formatCurrency(preview.summary.totalAmount) },
        { label: "Linhas ignoradas", value: (preview.ignoredRows.length + preview.skippedRows.length).toString() },
    ];

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
            ))}
        </div>
    );
}

function InvoiceTotalsPreview({ preview }: { preview: CreditCardInvoiceCsvImportResult }) {
    return (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">Totais por fatura</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {preview.summary.totalsByInvoice.map((invoice) => (
                    <div key={invoice.cycleKey} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                        <p className="text-sm font-medium text-white">{formatDate(invoice.invoiceDate)}</p>
                        <p className="mt-1 text-xs text-white/50">
                            {invoice.count} lancamentos - {formatCurrency(invoice.amount)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CreditCardInvoiceCsvImportCard() {
    const { user, profile, finance, favoriteWalletId, favoriteCreditCardId, creditCards, loading, updateFinance } = useFinance();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const activeCreditCards = useMemo(() => creditCards.filter((card) => card.isActive), [creditCards]);
    const activeCreditCardIds = useMemo(() => new Set(activeCreditCards.map((card) => card.id)), [activeCreditCards]);
    const [selectedCreditCardId, setSelectedCreditCardId] = useState(() => getDefaultCreditCardId(activeCreditCardIds, favoriteCreditCardId));
    const [preview, setPreview] = useState<CreditCardInvoiceCsvImportResult | null>(null);
    const [confirmation, setConfirmation] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

    const selectedCreditCard = useMemo(
        () => activeCreditCards.find((card) => card.id === selectedCreditCardId) ?? null,
        [activeCreditCards, selectedCreditCardId],
    );
    const canImport =
        Boolean(user && finance && preview && preview.rows.length > 0 && selectedCreditCard) &&
        confirmation.trim().toUpperCase() === INVOICE_CSV_IMPORT_CONFIRMATION_TEXT &&
        !loading &&
        !isImporting;

    useEffect(() => {
        if (selectedCreditCardId && activeCreditCardIds.has(selectedCreditCardId)) {
            return;
        }

        setSelectedCreditCardId(getDefaultCreditCardId(activeCreditCardIds, favoriteCreditCardId));
    }, [activeCreditCardIds, favoriteCreditCardId, selectedCreditCardId]);

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
            const parsed = parseCreditCardInvoiceCsv(text);
            const nextCreditCardId =
                selectedCreditCardId && activeCreditCardIds.has(selectedCreditCardId)
                    ? selectedCreditCardId
                    : getDefaultCreditCardId(activeCreditCardIds, favoriteCreditCardId);

            setSelectedCreditCardId(nextCreditCardId);
            setPreview(parsed);
            setConfirmation("");
            setFeedback({
                type: parsed.rows.length > 0 ? "success" : "error",
                message:
                    parsed.rows.length > 0
                        ? "CSV de faturas carregado. Revise o resumo antes de importar."
                        : "Nenhuma despesa ou encargo valido foi encontrado nesse CSV.",
            });
        } catch (error) {
            resetPreview();
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel ler esse CSV de faturas.",
            });
        } finally {
            event.target.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (!user || !finance || !preview || !selectedCreditCard || isImporting) {
            return;
        }

        if (confirmation.trim().toUpperCase() !== INVOICE_CSV_IMPORT_CONFIRMATION_TEXT) {
            setFeedback({
                type: "error",
                message: `Digite ${INVOICE_CSV_IMPORT_CONFIRMATION_TEXT} para confirmar a importacao.`,
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
            downloadFinanceBackupFile(rollbackBackup, "prism-backup-pre-import-faturas-csv");

            const result = buildCreditCardInvoiceImportSnapshot({
                finance,
                parsed: preview,
                creditCard: selectedCreditCard,
                userId: user.uid,
            });
            await updateFinance(result.finance);

            setFeedback({
                type: "success",
                message: `${result.createdTransactions} lancamentos de fatura importados em ${result.createdGroups} grupos. O estado anterior tambem foi exportado antes da importacao.`,
            });
            resetPreview();
        } catch (error) {
            console.error("Failed to import credit card invoice CSV:", error);
            setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Nao foi possivel importar esse CSV de faturas agora.",
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
                        <CreditCard size={18} />
                        <h3 className="text-lg font-semibold">Importar faturas CSV</h3>
                    </div>
                    <p className="mt-2 text-sm text-white/55">
                        Importe despesas e encargos de faturas, mantendo compras parceladas como uma unica serie e usando a coluna Fatura para vincular cada parcela.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!finance || loading || activeCreditCards.length < 1}
                        className="inline-flex items-center gap-2 rounded-xl border border-violet-300/35 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:border-violet-300/55 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileSpreadsheet size={16} />
                        Importar faturas CSV
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
                <div className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-400/10 p-4">
                    <div className="flex items-start gap-3">
                        <ShieldAlert size={18} className="mt-0.5 text-violet-100" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-violet-100">CSV de faturas pronto para importacao</p>
                            <p className="mt-1 text-sm text-violet-50/80">
                                Escolha o cartao e confirme para registrar as despesas nas faturas correspondentes.
                            </p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <ImportPreviewStats preview={preview} />
                        <InvoiceTotalsPreview preview={preview} />
                    </div>

                    {preview.skippedRows.length > 0 || preview.ignoredRows.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50/85">
                            <p className="font-medium text-amber-100">Linhas nao importadas</p>
                            <ul className="mt-2 space-y-1">
                                {[...preview.skippedRows, ...preview.ignoredRows].slice(0, 6).map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                            {preview.skippedRows.length + preview.ignoredRows.length > 6 ? (
                                <p className="mt-2">Mais {preview.skippedRows.length + preview.ignoredRows.length - 6} linhas nao foram importadas.</p>
                            ) : null}
                        </div>
                    ) : null}

                    <label className="mt-4 block text-sm text-white/78">
                        <span className="mb-2 block">Cartao de destino</span>
                        <select
                            value={selectedCreditCardId}
                            onChange={(event) => setSelectedCreditCardId(event.target.value)}
                            className="w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-white outline-none transition-colors focus:border-violet-200/40"
                        >
                            {activeCreditCards.map((card) => (
                                <option key={card.id} value={card.id} className="bg-[#101010] text-white">
                                    {card.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="mt-4 block text-sm text-white/78">
                        <span className="mb-2 block">
                            Digite <strong>{INVOICE_CSV_IMPORT_CONFIRMATION_TEXT}</strong> para confirmar
                        </span>
                        <input
                            type="text"
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                            className="w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-white outline-none transition-colors focus:border-violet-200/40"
                            placeholder={INVOICE_CSV_IMPORT_CONFIRMATION_TEXT}
                        />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            disabled={!canImport}
                            className="inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-400/15 px-4 py-2 text-sm font-medium text-violet-50 transition-colors hover:border-violet-300/45 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FileUp size={16} />
                            {isImporting ? "Importando..." : "Confirmar importacao de faturas"}
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
