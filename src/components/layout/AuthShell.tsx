import { useEffect, useState, type ReactNode } from "react";
import { usePage } from "../../context/PageContext";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";
import { AppSidebar } from "./AppSidebar";

interface AuthShellProps {
    children: ReactNode;
    mainClassName?: string;
}

export function AuthShell({ children, mainClassName = "text-white" }: AuthShellProps) {
    const { currentPage } = usePage();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [currentPage]);

    return (
        <>
            <DisplayModal />
            <div className="min-h-screen bg-[#0e0e10] text-white">
                <div className="flex min-h-screen">
                    <AppSidebar isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />

                    <div className="flex min-w-0 flex-1 flex-col">
                        <Header onOpenSidebar={() => setIsMobileSidebarOpen(true)} />
                        <main className={["min-w-0 flex-1 px-3 pb-4 pt-2 sm:px-4 overflow-y-auto max-h-215 elegant-scrollbar", mainClassName].join(" ")}>{children}</main>
                    </div>
                </div>
            </div>
        </>
    );
}
