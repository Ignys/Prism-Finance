import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { SidebarContent } from "./SidebarContent";

interface AppSidebarProps {
    isMobileOpen: boolean;
    onCloseMobile: () => void;
}

export function AppSidebar({ isMobileOpen, onCloseMobile }: AppSidebarProps) {
    useEffect(() => {
        if (!isMobileOpen) {
            return undefined;
        }

        const laptopMediaQuery = window.matchMedia("(min-width: 1200px)");

        if (laptopMediaQuery.matches) {
            onCloseMobile();
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onCloseMobile();
            }
        }

        function handleLaptopBreakpoint(event: MediaQueryListEvent) {
            if (event.matches) {
                onCloseMobile();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        laptopMediaQuery.addEventListener("change", handleLaptopBreakpoint);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
            laptopMediaQuery.removeEventListener("change", handleLaptopBreakpoint);
        };
    }, [isMobileOpen, onCloseMobile]);

    return (
        <>
            <AnimatePresence>
                {isMobileOpen ? (
                    <motion.aside initial="closed" animate="open" exit="closed" className="fixed inset-0 z-40 laptop:hidden">
                        <motion.button
                            type="button"
                            aria-label="Fechar menu lateral"
                            onClick={onCloseMobile}
                            variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.section
                            variants={{ closed: { x: "-100%" }, open: { x: 0 } }}
                            transition={{ type: "spring", stiffness: 360, damping: 34 }}
                            className="relative h-dvh w-[min(82vw,240px)] bg-zinc-950/95 p-2 shadow-2xl"
                        >
                            <SidebarContent variant="mobile" onClose={onCloseMobile} />
                        </motion.section>
                    </motion.aside>
                ) : null}
            </AnimatePresence>

            <aside className="hidden shrink-0 transition-[width] duration-300 ease-out laptop:block laptop:w-[72px] desktop:w-[240px]">
                <section className="elegant-scrollbar fixed inset-y-0 left-0 z-30 h-dvh overflow-y-auto bg-zinc-950/70 p-2 transition-[width] duration-300 ease-out laptop:w-[72px] desktop:w-[240px]">
                    <SidebarContent variant="responsive" />
                </section>
            </aside>
        </>
    );
}
