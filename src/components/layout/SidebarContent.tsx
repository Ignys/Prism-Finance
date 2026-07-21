import { Hexagon, X } from "lucide-react";
import { FinanceSyncStatus } from "./FinanceSyncStatus";
import { NavSection } from "./NavSection";

type SidebarContentVariant = "mobile" | "responsive";

interface SidebarContentProps {
    variant: SidebarContentVariant;
    onClose?: () => void;
}

export function SidebarContent({ variant, onClose }: SidebarContentProps) {
    const isResponsive = variant === "responsive";

    return (
        <div className="flex h-full flex-col justify-between gap-1">
            <div className="mt-2 flex flex-col gap-1">
                <div
                    className={[
                        "flex min-h-10 items-center gap-2 px-2.5 pb-2 pt-1.5 font-medium text-white",
                        isResponsive ? "laptop:justify-center laptop:px-0 desktop:justify-start desktop:px-2.5" : "justify-between",
                    ].join(" ")}
                >
                    <div
                        className={[
                            "flex min-w-0 items-center gap-2 transition-[gap] duration-300 ease-out",
                            isResponsive ? "laptop:gap-0 desktop:gap-2" : "",
                        ].join(" ")}
                    >
                        <Hexagon className="shrink-0" size={25} />
                        <h1
                            className={[
                                "max-w-28 overflow-hidden whitespace-nowrap uppercase opacity-100 transition-[max-width,opacity] duration-300 ease-out",
                                isResponsive ? "laptop:max-w-0 laptop:opacity-0 desktop:max-w-28 desktop:opacity-100" : "",
                            ].join(" ")}
                        >
                            Prism
                        </h1>
                    </div>

                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar menu lateral"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/70 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    ) : null}
                </div>

                <Divider />
                <NavSection compactAtLaptop={isResponsive} indicatorLayoutId={`nav-indicator-${variant}`} onNavigate={onClose} />
            </div>

            <FinanceSyncStatus compactAtLaptop={isResponsive} />
        </div>
    );
}

function Divider() {
    return (
        <div className="my-1 w-full px-2">
            <div className="h-px w-full bg-zinc-500/20" />
        </div>
    );
}
