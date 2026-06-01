import { useEffect, useState } from "react";
import { Hexagon, PanelLeftClose, type LucideIcon } from "lucide-react";
import { type AppPage, usePage } from "../../context/PageContext";
import { normalizeNavigationPage } from "./appNavigation";
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

    return (
        <aside>
            <section className="p-2 w-[240px] h-full min-h-[calc(100vh)] bg-zinc-950/70">
                <div className="sticky top-4 flex flex-col gap-1 ">
                    <div className="pt-1.5 pb-2 px-2.5 flex gap-2 items-center transition duration-75 ease-in-out  text-white font-medium">
                        <Hexagon size={25} />
                        <h1 className="uppercase">Prism</h1>
                    </div>
                    <Divider/>
                    <NavSection />

                </div>
            </section>
        </aside>
    );
}

function Divider() {
    return (
        <div className="px-2 w-full my-1">
            <div className="w-full bg-zinc-500/20 h-px"></div>
        </div>
    );
}
