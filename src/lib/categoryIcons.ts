import type { ComponentType } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Circle } from "lucide-react";

type CategoryIconKind = "expense" | "income" | null | undefined;

const IGNORED_EXPORT_NAMES = new Set(["Icon", "createLucideIcon"]);

function isIconComponent(value: unknown): value is ComponentType<LucideProps> {
    if (typeof value === "function") {
        return true;
    }
    if (typeof value === "object" && value !== null && "render" in value) {
        return typeof (value as { render?: unknown }).render === "function";
    }
    return false;
}

function toKebabCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}

function normalizeRawIconName(value: string): string {
    const collapsed = value.trim().replace(/[_\s]+/g, "-");
    if (!collapsed) {
        return "";
    }
    if (collapsed.includes("-")) {
        return collapsed.toLowerCase();
    }
    if (/[A-Z]/.test(collapsed)) {
        return toKebabCase(collapsed);
    }
    return collapsed.toLowerCase();
}

const CATEGORY_ICON_COMPONENTS: Record<string, ComponentType<LucideProps>> = {};
Object.entries(LucideIcons).forEach(([exportName, exported]) => {
    if (IGNORED_EXPORT_NAMES.has(exportName)) {
        return;
    }
    if (!/^[A-Z]/.test(exportName)) {
        return;
    }
    if (!isIconComponent(exported)) {
        return;
    }
    CATEGORY_ICON_COMPONENTS[toKebabCase(exportName)] = exported;
});

function resolveFirstAvailable(candidates: string[], hardFallback: string): string {
    for (const candidate of candidates) {
        if (CATEGORY_ICON_COMPONENTS[candidate]) {
            return candidate;
        }
    }
    if (CATEGORY_ICON_COMPONENTS[hardFallback]) {
        return hardFallback;
    }
    const firstIcon = Object.keys(CATEGORY_ICON_COMPONENTS)[0];
    return firstIcon ?? hardFallback;
}

const DEFAULT_ICON_NAME = resolveFirstAvailable(["tag", "circle"], "tag");
const EXPENSE_ICON_NAME = resolveFirstAvailable(["receipt-text", "tag"], DEFAULT_ICON_NAME);
const INCOME_ICON_NAME = resolveFirstAvailable(["badge-dollar-sign", "coins", "tag"], DEFAULT_ICON_NAME);

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICON_COMPONENTS).sort((a, b) => a.localeCompare(b));

export function hasCategoryIconName(iconName: string): boolean {
    return Boolean(CATEGORY_ICON_COMPONENTS[normalizeRawIconName(iconName)]);
}

export function getDefaultCategoryIconName(type: CategoryIconKind): string {
    if (type === "income") {
        return INCOME_ICON_NAME;
    }
    if (type === "expense") {
        return EXPENSE_ICON_NAME;
    }
    return DEFAULT_ICON_NAME;
}

export function normalizeCategoryIconName(iconName: string | null | undefined, type: CategoryIconKind): string {
    if (typeof iconName === "string") {
        const normalized = normalizeRawIconName(iconName);
        if (CATEGORY_ICON_COMPONENTS[normalized]) {
            return normalized;
        }
    }
    return getDefaultCategoryIconName(type);
}

export function getCategoryIconComponent(iconName: string | null | undefined, type?: CategoryIconKind): ComponentType<LucideProps> {
    const normalized = normalizeCategoryIconName(iconName, type);
    return CATEGORY_ICON_COMPONENTS[normalized] ?? CATEGORY_ICON_COMPONENTS[DEFAULT_ICON_NAME] ?? Circle;
}
