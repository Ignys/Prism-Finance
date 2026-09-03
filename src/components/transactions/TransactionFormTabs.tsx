import { motion } from "framer-motion";

export type TransactionFormTab = "simple" | "advanced";

interface TransactionFormTabsProps {
    activeTab: TransactionFormTab;
    onChange: (tab: TransactionFormTab) => void;
}

const TAB_OPTIONS = [
    { value: "simple" as const, label: "Simples" },
    { value: "advanced" as const, label: "Avançado" },
];

export function TransactionFormTabs({ activeTab, onChange }: TransactionFormTabsProps) {
    return (
        <div className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.035] p-0.5 shadow-[0_14px_32px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl" role="tablist" aria-label="Seções da transação">
            {TAB_OPTIONS.map(({ value, label }) => {
                const isActive = activeTab === value;

                return (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(value)}
                        className="relative isolate inline-flex h-6 min-w-24 items-center justify-center rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                        {isActive ? (
                            <motion.span
                                layoutId="transaction-modal-active-tab"
                                className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[0_10px_24px_-16px_rgba(255,255,255,0.55)]"
                                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                            />
                        ) : null}
                        <motion.span
                            className="relative z-10"
                            animate={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.52)" }}
                            whileHover={{ color: "rgba(255,255,255,0.8)" }}
                            transition={{ duration: 0.18 }}
                        >
                            {label}
                        </motion.span>
                    </button>
                );
            })}
        </div>
    );
}
