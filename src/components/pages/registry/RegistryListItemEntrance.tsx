import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { getRegistryItemEntranceDelay, REGISTRY_ENTRANCE_EASE, REGISTRY_ITEM_ANIMATE, REGISTRY_ITEM_INITIAL } from "./registryMotion";

interface RegistryListItemEntranceProps {
    children: ReactNode;
    index: number;
    className?: string;
}

export function RegistryListItemEntrance({ children, index, className }: RegistryListItemEntranceProps) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={shouldReduceMotion ? false : REGISTRY_ITEM_INITIAL}
            animate={REGISTRY_ITEM_ANIMATE}
            transition={{
                delay: shouldReduceMotion ? 0 : getRegistryItemEntranceDelay(index),
                duration: 0.46,
                ease: REGISTRY_ENTRANCE_EASE,
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
