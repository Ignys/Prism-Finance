import { lazy, Suspense } from "react";
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
    label: string;
    modalType?: ModalType;
}[] = [
    { label: "Saldo atual", amountKey: "balance", isBalance: true },
    { label: "Receitas do mês", amountKey: "receitas", modalType: "income" },
    { label: "Despesas do mês", amountKey: "despesas", modalType: "spending" },
    { label: "Faturas abertas", amountKey: "pendingInvoices", modalType: "card_spending" },
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
            {METRIC_ITEMS.map(({ label, amountKey, modalType, isBalance }, index) => {
                const amount = amounts[amountKey];
                const amountColor = isBalance ? (amount >= 0 ? "text-emerald-300" : "text-red-400") : "text-white/85";

                return (
                    <div key={label} className="contents">
                        {index > 0 ? <div className="mx-0.5 h-5 w-px bg-white/[0.06]" /> : null}
                        {!isBalance ? (
                            <div className="group relative flex cursor-pointer items-center gap-2 rounded-[9px] border border-transparent px-3 py-1.5 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.05] sm:px-5">
                                <div className="flex flex-col transition-opacity duration-150 group-hover:opacity-0">
                                    <span className={METRIC_LABEL_CLASS}>{label}</span>
                                    <span className={`whitespace-nowrap text-[15px] font-normal ${amountColor}`} style={{ fontFamily: "'Azeret Mono', monospace" }}>
                                        R$ {amount.toFixed(2)}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => modalType && openModal(renderLazyModal(modalType))}
                                    title={`Adicionar ${label}`}
                                    className={[
                                        "absolute inset-0 flex w-full cursor-pointer items-center justify-center gap-[5px] rounded-[9px]",
                                        "border-none bg-white/[0.08] text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70",
                                        "opacity-0 backdrop-blur-sm transition-opacity duration-[180ms] group-hover:opacity-100",
                                    ].join(" ")}
                                >
                                    Adicionar
                                </button>
                            </div>
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
