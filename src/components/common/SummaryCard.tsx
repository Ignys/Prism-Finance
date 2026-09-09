import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type SummaryCardTone = "positive" | "negative" | "warning" | "neutral";

export interface SummaryCardData {
    id: string;
    title: string;
    value: string;
    tone: SummaryCardTone;
    badge?: string | number;
    helper?: string;
    icon?: LucideIcon;
}

interface SummaryCardProps extends SummaryCardData {
    index?: number;
}

interface ToneStyle {
    border: string;
    glow: string;
    text: string;
    iconBg: string;
    iconText: string;
}

const TONE_STYLES: Record<SummaryCardTone, ToneStyle> = {
    positive: {
        border: "border-emerald-200/[0.15]",
        glow: "bg-emerald-400/30",
        text: "text-emerald-200",
        iconBg: "bg-emerald-400/10",
        iconText: "text-emerald-300",
    },
    negative: {
        border: "border-red-300/[0.15]",
        glow: "bg-red-400/25",
        text: "text-red-300",
        iconBg: "bg-red-400/10",
        iconText: "text-red-300",
    },
    warning: {
        border: "border-amber-300/[0.15]",
        glow: "bg-amber-400/30",
        text: "text-amber-200",
        iconBg: "bg-amber-400/10",
        iconText: "text-amber-300",
    },
    neutral: {
        border: "border-neutral-300/[0.2]",
        glow: "bg-neutral-300/25",
        text: "text-white",
        iconBg: "bg-white/[0.06]",
        iconText: "text-white/70",
    },
};

/**
 * Card de resumo padrao (usado em Faturas e Transacoes).
 * Mesmo estilo visual do padrao ja usado em Planning: cantos arredondados,
 * borda sutil, glow de fundo e animacao de entrada.
 */
export function SummaryCard({ title, value, tone, badge, helper, icon: Icon, index = 0 }: SummaryCardProps) {
    const styles = TONE_STYLES[tone];

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
            className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-[#111111] p-3.5 text-left`}
        >
            <div className={`pointer-events-none absolute -bottom-16 -right-16 h-32 w-32 rounded-full ${styles.glow} blur-3xl`} />
            <div className="relative flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/55">
                    {Icon && (
                        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.iconBg} ${styles.iconText}`}>
                            <Icon size={11} />
                        </span>
                    )}
                    <span className="truncate">{title}</span>
                </p>
                {badge !== undefined && (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/60">{badge}</span>
                )}
            </div>
            <p className={`relative mt-1.5 text-lg font-semibold tracking-wide ${styles.text}`}>{value}</p>
            {helper && <p className="relative mt-1 text-[11px] text-white/45">{helper}</p>}
        </motion.article>
    );
}

interface SummaryCardsGridProps {
    cards: SummaryCardData[];
    className?: string;
}

/**
 * Grid responsivo dos SummaryCards.
 * - Em telas pequenas/medias (onde a coluna de resumo ocupa a largura toda,
 *   empilhada abaixo da lista): 2-3 colunas para aproveitar o espaco horizontal.
 * - Em telas grandes (onde vira uma coluna lateral estreita): 1 coluna, empilhado.
 */
export function SummaryCardsGrid({ cards, className = "" }: SummaryCardsGridProps) {
    return (
        <section className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 ${className}`.trim()}>
            {cards.map((card, index) => (
                <SummaryCard key={card.id} index={index} {...card} />
            ))}
        </section>
    );
}