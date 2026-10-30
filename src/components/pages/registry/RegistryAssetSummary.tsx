import { formatRegistryCurrency } from "./registryFormatters";

export interface RegistryAssetSummaryItem {
    id: string;
    name: string;
    color: string;
    value: number;
}

interface RegistryAssetSummaryProps {
    label: string;
    countLabel: string;
    distributionLabel: string;
    items: RegistryAssetSummaryItem[];
}

export function RegistryAssetSummary({ label, countLabel, distributionLabel, items }: RegistryAssetSummaryProps) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const positive = items.filter((item) => item.value > 0);
    const positiveTotal = positive.reduce((sum, item) => sum + item.value, 0);

    if (items.length < 1) {
        return null;
    }

    return (
        <aside className="order-1 shrink-0 self-start rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 lg:order-2 lg:w-72 xl:w-80" aria-label={label}>
            <div>
                <div>
                    <p className={`text-3xl font-semibold tracking-[-0.03em] tabular-nums ${total < 0 ? "text-rose-300" : "text-white"}`}>{formatRegistryCurrency(total)}</p>
                </div>
                <p className="mt-1 text-sm text-white/45">{countLabel}</p>
            </div>

            {positiveTotal > 0 ? (
                <>
                    <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={distributionLabel}>
                        {positive.map((item) => (
                            <span key={item.id} title={`${item.name}: ${formatRegistryCurrency(item.value)}`} style={{ flexGrow: item.value, backgroundColor: item.color }} />
                        ))}
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-white/65">
                        {positive.map((item) => (
                            <li key={item.id} className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                <span className="tabular-nums text-white/40">{Math.round((item.value / positiveTotal) * 100)}%</span>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </aside>
    );
}
