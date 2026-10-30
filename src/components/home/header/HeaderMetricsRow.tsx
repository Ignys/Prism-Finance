import { lazy, Suspense } from "react";
import { Plus } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import { ModalSkeleton } from "../../loading/CompactSkeletons";

const AddIncome = lazy(() => import("../../modal/AddIncome").then((module) => ({ default: module.AddIncome })));
const AddSpending = lazy(() => import("../../modal/AddSpending").then((module) => ({ default: module.AddSpending })));
const AddCardSpending = lazy(() => import("../../modal/AddCardSpending").then((module) => ({ default: module.AddCardSpending })));

interface HeaderMetricAmounts {
    balance: number;
    despesas: number;
    pendingInvoices: number;
    receitas: number;
}

interface HeaderMetricsRowProps {
    amounts: HeaderMetricAmounts;
}

type ModalType = "income" | "spending" | "card_spending";

const METRIC_ITEMS: {
    amountKey: keyof HeaderMetricAmounts;
    isBalance?: boolean;
    actionLabel?: string;
    actionClass?: string;
    label: string;
    modalType?: ModalType;
}[] = [
    { label: "Saldo atual", amountKey: "balance", isBalance: true },
    { label: "Receitas do mês", amountKey: "receitas", modalType: "income", actionLabel: "Adicionar receita", actionClass: "bg-emerald-300 text-emerald-950" },
    { label: "Despesas do mês", amountKey: "despesas", modalType: "spending", actionLabel: "Adicionar despesa", actionClass: "bg-rose-300 text-rose-950" },
    { label: "Faturas abertas", amountKey: "pendingInvoices", modalType: "card_spending", actionLabel: "Adicionar compra no cartão", actionClass: "bg-violet-300 text-violet-950" },
];

function renderLazyModal(modalType: ModalType) {
    return (
        <Suspense fallback={<ModalSkeleton />}>
            {modalType === "income" ? <AddIncome /> : modalType === "spending" ? <AddSpending /> : <AddCardSpending />}
        </Suspense>
    );
}

export function HeaderMetricsRow({ amounts }: HeaderMetricsRowProps) {
    const { openModal } = useModal();

    const METRIC_LABEL_CLASS = "whitespace-nowrap text-start text-[12px] font-light uppercase tracking-[0.09em] text-white/40"



    return (
        <div className="flex min-w-max items-center gap-0.5">
            {METRIC_ITEMS.map(({ label, amountKey, modalType, isBalance, actionLabel, actionClass }, index) => {
                const amount = amounts[amountKey];
                const amountColor = isBalance ? (amount >= 0 ? "text-emerald-300" : "text-red-400") : "text-white/85";

                return (
                    <div key={label} className="contents">
                        {index > 0 ? <div className="mx-0.5 h-5 w-px bg-white/[0.06]" /> : null}
                        {!isBalance ? (
                            <button
                                type="button"
                                onClick={() => modalType && openModal(renderLazyModal(modalType))}
                                title={actionLabel}
                                aria-label={`${actionLabel} (${label}: R$ ${amount.toFixed(2)})`}
                                className="group flex cursor-pointer items-center rounded-[9px] border border-transparent px-3 py-1.5 text-left outline-none transition-colors duration-300 hover:bg-white/[0.04] focus-visible:border-white/[0.15] focus-visible:bg-white/[0.04] sm:px-5"
                            >
                                <div className="flex flex-col">
                                    <span className={`${METRIC_LABEL_CLASS} transition-colors duration-300 group-hover:text-white/60`}>{label}</span>
                                    <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                        R$ {amount.toFixed(2)}
                                    </span>
                                </div>

                                {/* Abre a largura de 0fr para 1fr: o botão desliza sem empurrar o layout de forma brusca. */}
                                <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] motion-reduce:transition-none">
                                    <span className="overflow-hidden">
                                        <span
                                            aria-hidden
                                            className={`ml-3 inline-flex h-7 w-7 scale-50 items-center justify-center rounded-full opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 group-active:scale-90 motion-reduce:transition-none ${actionClass}`}
                                        >
                                            <Plus size={16} strokeWidth={2.5} />
                                        </span>
                                    </span>
                                </span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 rounded-[9px] border border-transparent py-1.5 pl-1 pr-3 sm:pl-2 sm:pr-5">
                                <div className="flex flex-col">
                                    <span className={METRIC_LABEL_CLASS}>{label}</span>
                                    <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                        R$ {amount.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
