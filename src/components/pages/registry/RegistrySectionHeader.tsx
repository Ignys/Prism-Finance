import { motion, useReducedMotion } from "framer-motion";
import { REGISTRY_ENTRANCE_EASE } from "./registryMotion";
import { RegistrySectionActions } from "./RegistrySectionActions";

interface RegistrySectionHeaderProps {
    title: string;
    visibleCount: number;
    isShowingInactive: boolean;
    showLabel: string;
    hideLabel: string;
    createLabel: string;
    onToggleInactive: () => void;
    onCreate: () => void;
}

export function RegistrySectionHeader({
    title,
    visibleCount,
    isShowingInactive,
    showLabel,
    hideLabel,
    createLabel,
    onToggleInactive,
    onCreate,
}: RegistrySectionHeaderProps) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, ease: REGISTRY_ENTRANCE_EASE }}
            className="mb-3 ml-1 mt-2 flex flex-wrap items-center justify-between gap-3"
        >
            <div className="flex items-center gap-2">
                <p className="text-lg uppercase tracking-[0.07em] text-white/80">{title}</p>
                <motion.span
                    key={visibleCount}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.72 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: REGISTRY_ENTRANCE_EASE }}
                    className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-white/60"
                >
                    {visibleCount}
                </motion.span>
            </div>
            <RegistrySectionActions
                isShowingInactive={isShowingInactive}
                showLabel={showLabel}
                hideLabel={hideLabel}
                createLabel={createLabel}
                onToggleInactive={onToggleInactive}
                onCreate={onCreate}
            />
        </motion.div>
    );
}
