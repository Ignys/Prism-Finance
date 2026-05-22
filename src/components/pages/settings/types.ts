import type { LucideIcon } from "lucide-react";

export type SettingsTabId = "account" | "family";

export type SettingsTab = {
    id: SettingsTabId;
    label: string;
    description: string;
    icon: LucideIcon;
};
