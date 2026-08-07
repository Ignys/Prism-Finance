import type { Variants } from "framer-motion";
import { PLANNING_ENTRANCE_EASE } from "./planningEntranceMotion";

export const REPORTS_ENTRANCE_CONTAINER_VARIANTS: Variants = {
    hidden: {},
    visible: {
        transition: {
            delayChildren: 0.08,
            staggerChildren: 0.09,
        },
    },
};

export const REPORTS_ENTRANCE_GRID_VARIANTS: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
        },
    },
};

export const REPORTS_ENTRANCE_ITEM_VARIANTS: Variants = {
    hidden: {
        opacity: 0,
        y: 22,
        scale: 0.985,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.52,
            ease: PLANNING_ENTRANCE_EASE,
        },
    },
};

export const REPORT_CATEGORY_CONTENT_VARIANTS: Variants = {
    initial: (direction: number) => ({
        opacity: 0,
        x: direction * 42,
        y: 6,
        scale: 0.982,
    }),
    animate: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: {
            x: { type: "spring", stiffness: 320, damping: 32, mass: 0.72 },
            y: { duration: 0.34, ease: PLANNING_ENTRANCE_EASE },
            scale: { duration: 0.34, ease: PLANNING_ENTRANCE_EASE },
            opacity: { duration: 0.24, ease: "easeOut" },
        },
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction * -26,
        y: -3,
        scale: 0.99,
        transition: {
            duration: 0.2,
            ease: "easeIn",
        },
    }),
};
