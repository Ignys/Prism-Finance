import type { LucideIcon } from "lucide-react";

type SettingsSidebarButtonProps = {
    active: boolean;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
};

export function SettingsSidebarButton({ active, icon: Icon, label, onClick }: SettingsSidebarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`min-w-max rounded-lg border p-1 text-left transition-all lg:w-full ${
                active
                    ? "border-white/[0.08] bg-white/[0.03]"
                    : "border-transparent hover:border-white/[0.14] hover:bg-white/[0.05]"
            }`}
        >
            <div className="flex items-center gap-2">
                <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-white/[0.08]" : "bg-white/[0.05] text-white/75"
                    }`}
                >
                    <Icon size={16} />
                </span>
                <div>
                    <p className="text-sm text-white">{label}</p>
                </div>
            </div>
        </button>
    );
}
