import { useEffect } from "react";
import { X } from "lucide-react";
import { formatCurrencyBRL } from "./transactionView";

export interface InstallmentPreviewRow {
    installmentNumber: number;
    cycleKey: string;
    monthLabel: string;
    amount: number;
    ignored: boolean;
}

export interface InstallmentPreviewData {
    rows: InstallmentPreviewRow[];
    installmentCount: number;
    ignoredInstallmentsCount: number;
    totalAmount: number;
    effectiveTotalAmount: number;
    startMonthLabel: string;
}

function formatPreviewCurrency(value: number): string {
    return `R$ ${formatCurrencyBRL(value)}`;
}

export function InstallmentPreviewModal({ data, onClose }: { data: InstallmentPreviewData; onClose: () => void }) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 py-6 text-white" role="dialog" aria-modal="true" aria-labelledby="installment-preview-title">
            <button type="button" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" aria-label="Fechar preview de parcelas" onMouseDown={onClose} />
            <div className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#151515] shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)]" onMouseDown={(event) => event.stopPropagation()}>
                <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
                    <div><p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Preview</p><h2 id="installment-preview-title" className="mt-1 text-lg font-semibold text-white">Parcelamento previsto</h2><p className="mt-1 text-sm text-white/55">Comecando em {data.startMonthLabel}, com {data.installmentCount} parcelas.</p></div>
                    <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white/70 transition-colors hover:border-white/[0.22] hover:text-white" aria-label="Fechar preview"><X size={15} /></button>
                </header>
                <div className="overflow-auto px-5 py-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Total parcelado</p><p className="mt-1 font-semibold text-white">{formatPreviewCurrency(data.totalAmount)}</p></div>
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/55">Entra nas faturas</p><p className="mt-1 font-semibold text-emerald-100">{formatPreviewCurrency(data.effectiveTotalAmount)}</p></div>
                        <div className="rounded-xl border border-slate-400/20 bg-slate-500/10 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-100/55">Ignoradas</p><p className="mt-1 font-semibold text-slate-100">{data.ignoredInstallmentsCount}</p></div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]"><div className="max-h-[42vh] overflow-auto"><table className="min-w-full divide-y divide-white/[0.06] text-sm">
                        <thead className="sticky top-0 bg-[#1b1b1b] text-[10px] uppercase tracking-[0.12em] text-white/45"><tr><th className="px-3 py-2 text-left font-medium">Parcela</th><th className="px-3 py-2 text-left font-medium">Mes</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="px-3 py-2 text-left font-medium">Status</th></tr></thead>
                        <tbody className="divide-y divide-white/[0.05] bg-black/10">{data.rows.map((row) => <tr key={`${row.cycleKey}-${row.installmentNumber}`} className={row.ignored ? "text-white/60" : "text-white/90"}><td className="whitespace-nowrap px-3 py-2">{row.installmentNumber}/{data.installmentCount}</td><td className="px-3 py-2"><div className="flex flex-col"><span>{row.monthLabel}</span><span className="text-[10px] uppercase tracking-[0.08em] text-white/35">{row.cycleKey}</span></div></td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatPreviewCurrency(row.amount)}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${row.ignored ? "border-slate-400/25 bg-slate-500/10 text-slate-200" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"}`}>{row.ignored ? "Ignorada" : "Entra na fatura"}</span></td></tr>)}</tbody>
                    </table></div></div>
                    <p className="mt-3 text-xs leading-5 text-white/45">Parcelas ignoradas mantem o valor original no historico, mas nao entram no total da fatura.</p>
                </div>
            </div>
        </div>
    );
}
