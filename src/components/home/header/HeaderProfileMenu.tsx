import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";

interface HeaderProfileMenuProps {
    onOpenSettings: () => void;
    onSignOut: () => Promise<void>;
    userName: string;
    userPhotoUrl: string | null;
}

export function HeaderProfileMenu({ onOpenSettings, onSignOut, userName, userPhotoUrl }: HeaderProfileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const userInitial = userName.charAt(0).toUpperCase();

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        function handleClickOutside(event: MouseEvent) {
            if (!profileMenuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const handleOpenSettings = () => {
        setIsOpen(false);
        onOpenSettings();
    };

    const handleSignOut = async () => {
        setIsOpen(false);
        await onSignOut();
    };

    return (
        <div className="relative" ref={profileMenuRef}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.07]"
            >
                <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-700 text-xs font-semibold text-white">
                    {userPhotoUrl ? <img src={userPhotoUrl} alt={`Foto de ${userName}`} className="h-full w-full object-cover" /> : userInitial}
                </span>
                <div className="hidden min-w-0 text-left sm:block">
                    <div className="max-w-[11rem] truncate text-sm font-medium text-white/88">{userName}</div>
                </div>
                <ChevronDown size={16} className={`hidden text-white/60 transition-transform sm:inline-flex ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen ? (
                <div
                    role="menu"
                    aria-label="Menu do usuario"
                    className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[200px] overflow-hidden rounded-xl border border-white/[0.1] bg-neutral-950 p-1 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.85)]"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleOpenSettings}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08]"
                    >
                        <Settings size={18} />
                        Configurações
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/[0.08]"
                    >
                        <LogOut size={18} />
                        Sair
                    </button>
                </div>
            ) : null}
        </div>
    );
}
