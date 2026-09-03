import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { TransactionFormTab } from "./TransactionFormTabs";

interface AnimatedTransactionFormPanelProps {
    activeTab: TransactionFormTab;
    children: ReactNode;
}

export function AnimatedTransactionFormPanel({ activeTab, children }: AnimatedTransactionFormPanelProps) {
    const shouldReduceMotion = useReducedMotion();
    const direction = activeTab === "advanced" ? 1 : -1;

    return (
        <div className="relative h-full min-h-0 overflow-hidden">
            <AnimatePresence initial={false} mode="wait" custom={direction}>
                <motion.div
                    key={activeTab}
                    custom={direction}
                    initial={shouldReduceMotion ? false : { opacity: 0, x: direction * 36, y: 4, scale: 0.99 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: direction * -24, y: -2, scale: 0.995 }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : {
                                  x: { type: "spring", stiffness: 340, damping: 34, mass: 0.72 },
                                  y: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                                  scale: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                                  opacity: { duration: 0.2, ease: "easeOut" },
                              }
                    }
                    className="elegant-scrollbar absolute inset-0 overflow-y-auto pr-1"
                    role="tabpanel"
                    aria-label={activeTab === "simple" ? "Dados simples" : "Opções avançadas"}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
