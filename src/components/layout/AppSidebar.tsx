import { useEffect } from "react";
import { Hexagon, X } from "lucide-react";
import { FinanceSyncStatus } from "./FinanceSyncStatus";
import { NavSection } from "./NavSection";

interface AppSidebarProps {
    isMobileOpen: boolean;
    onCloseMobile: () => void;
}

export function AppSidebar({ isMobileOpen, onCloseMobile }: AppSidebarProps) {
    useEffect(() => {
        if (!isMobileOpen) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onCloseMobile();
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMobileOpen, onCloseMobile]);

    if (isMobileOpen) {
        return (
            <aside
                className={`${isMobileOpen ? "pointer-events-auto" : "pointer-events-none"} fixed inset-0 z-40 lg:pointer-events-auto lg:sticky lg:top-0 lg:z-auto lg:block lg:h-screen lg:w-[240px] lg:shrink-0`}
            >
                <button
                    type="button"
                    aria-label="Fechar menu lateral"
                    onClick={onCloseMobile}
                    className={`absolute inset-0 bg-black/60 transition-opacity lg:hidden ${isMobileOpen ? "opacity-100" : "opacity-0"}`}
                />
                <section
                    className={[
                        "relative h-full min-h-screen w-[min(82vw,240px)] bg-zinc-950/95 p-2 shadow-2xl transition-transform duration-200 lg:w-[240px] lg:translate-x-0 lg:bg-zinc-950/70 lg:shadow-none",
                        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    ].join(" ")}
                >
                    <div className="sticky top-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1.5 text-white transition duration-75 ease-in-out">
                            <div className="flex items-center gap-2 font-medium">
                                <Hexagon size={25} />
                                <h1 className="uppercase">Prism</h1>
                            </div>
                            <button
                                type="button"
                                onClick={onCloseMobile}
                                aria-label="Fechar menu lateral"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white lg:hidden"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <Divider />
                        <NavSection />
                        <FinanceSyncStatus />
                    </div>
                </section>
            </aside>
        );
    } else if (!isMobileOpen) {
        return (
            <aside>
                <section className="p-2 w-[240px] h-full min-h-[calc(100vh)] bg-zinc-950/70">
                    <div className="sticky top-4 flex flex-col justify-between gap-1 h-full">
                        <div className="lex flex-col gap-1 mt-2">
                            <div className="pt-1.5 pb-2 px-2.5 flex gap-2 items-center transition duration-75 ease-in-out  text-white font-medium">
                                <Hexagon size={25} />
                                <h1 className="uppercase">Prism</h1>
                            </div>
                            <Divider />
                            <NavSection />
                        </div>
                        <div>
                            <FinanceSyncStatus />
                        </div>
                    </div>
                </section>
            </aside>
        );
    }
}

function Divider() {
    return (
        <div className="px-2 w-full my-1">
            <div className="w-full bg-zinc-500/20 h-px"></div>
        </div>
    );
}
