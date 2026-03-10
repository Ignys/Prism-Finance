interface MetricCard {
    label: string;
    value: string;
}

interface MetricCardsColumnProps {
    cards: MetricCard[];
    className?: string;
}

export function MetricCardsColumn({ cards, className = "" }: MetricCardsColumnProps) {
    return (
        <section className={`flex flex-col gap-2 ${className}`.trim()}>
            {cards.map((card) => (
                <div key={card.label} className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                    <p className="font-light text-white/50">{card.label}</p>
                    <span>{card.value}</span>
                </div>
            ))}
        </section>
    );
}
