import type { ReactNode } from "react";

interface SkeletonBlockProps {
    className?: string;
}

interface SkeletonPanelProps {
    children: ReactNode;
    className?: string;
}

export function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
    return <div className={`animate-pulse rounded-lg bg-white/[0.07] ${className}`} />;
}

export function SkeletonLine({ className = "" }: SkeletonBlockProps) {
    return <SkeletonBlock className={`h-3 ${className}`} />;
}

export function SkeletonPanel({ children, className = "" }: SkeletonPanelProps) {
    return <section className={`rounded-2xl border border-white/[0.08] bg-[#111111] p-4 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] ${className}`}>{children}</section>;
}
