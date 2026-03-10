import type { ReactNode } from "react";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";

interface AuthShellProps {
    children: ReactNode;
    mainClassName?: string;
}

export function AuthShell({ children, mainClassName = "justify-center text-center text-white" }: AuthShellProps) {
    return (
        <>
            <DisplayModal />
            <main className={mainClassName}>
                <Header />
                {children}
            </main>
        </>
    );
}
