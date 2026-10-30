import { useEffect, useRef, useState, type ReactNode } from "react";
import { Briefcase, CreditCard, Hexagon, House, Laptop, PiggyBank, Wallet, type LucideIcon } from "lucide-react";

// Static sample month shown on the login page. Every widget/category/row shares a `key`,
// so hovering any of them lights the same item everywhere (like the Home charts).
const CATEGORIES = {
    renda: { label: "Renda", color: "#34d399", Icon: Briefcase },
    moradia: { label: "Moradia", color: "#60a5fa", Icon: House },
    cartao: { label: "Cartão de crédito", color: "#a78bfa", Icon: CreditCard },
    metas: { label: "Metas", color: "#f472b6", Icon: PiggyBank },
    eletronicos: { label: "Eletrônicos", color: "#f59e0b", Icon: Laptop },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

const ENTRIES: { key: CategoryKey; label: string; detail: string; amount: number; installment?: string }[] = [
    { key: "renda", label: "Salário", detail: "Conta corrente · Renda", amount: 6200 },
    { key: "moradia", label: "Aluguel", detail: "Conta corrente · Moradia", amount: -1850 },
    { key: "cartao", label: "Fatura do cartão", detail: "Cartão de crédito · Vence dia 12", amount: -1427.9 },
    { key: "eletronicos", label: "Notebook", installment: "4/10", detail: "Cartão de crédito · Eletrônicos", amount: -389 },
    { key: "metas", label: "Reserva de emergência", detail: "Poupança · Meta", amount: -500 },
];

const INCOME = ENTRIES.reduce((total, entry) => total + Math.max(entry.amount, 0), 0);
const BALANCE = ENTRIES.reduce((total, entry) => total + entry.amount, 0);
const SPENDING = INCOME - BALANCE;
const SPENDING_ENTRIES = ENTRIES.filter((entry) => entry.amount < 0).sort((a, b) => a.amount - b.amount);

// Cumulative totals by day of the month for the balance chart.
const CHART_DAYS = [1, 5, 10, 15, 20, 25, 31];
const CHART_INCOME = [0, 6200, 6200, 6200, 6200, 6200, 6200];
const CHART_SPENDING = [0, 1850, 1850, 2239, 2239, 3666.9, 4166.9];
const CHART_MAX = 7000;

const formatAmount = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const chartX = (index: number) => (index / (CHART_DAYS.length - 1)) * 200;
const chartY = (value: number) => 78 - (value / CHART_MAX) * 70;
const linePath = (values: number[]) => values.map((value, index) => `${index === 0 ? "M" : "L"}${chartX(index)} ${chartY(value)}`).join(" ");

const fadeClass = "transition-opacity duration-300 ease-out";

export function LoginShowcase() {
    const [active, setActive] = useState<CategoryKey | null>(null);
    const [chartIndex, setChartIndex] = useState<number | null>(null);

    const stageRef = useRef<HTMLDivElement>(null);

    // Parallax: pointer position over the whole viewport (-1..1) goes into CSS vars; each layer moves by its own depth.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const handleMove = (event: PointerEvent) => {
            stage.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
            stage.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
        };
        const reset = () => {
            stage.style.setProperty("--px", "0");
            stage.style.setProperty("--py", "0");
        };

        window.addEventListener("pointermove", handleMove);
        document.documentElement.addEventListener("pointerleave", reset);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            document.documentElement.removeEventListener("pointerleave", reset);
        };
    }, []);

    const dim = (key: CategoryKey) => (active !== null && active !== key ? "opacity-30" : "opacity-100");
    const hover = (key: CategoryKey) => ({ onMouseEnter: () => setActive(key), onMouseLeave: () => setActive(null) });

    return (
        <div ref={stageRef} className="relative flex flex-1 items-center justify-center [--px:0] [--py:0]">
        <figure aria-label="Exemplo de um mês no Prism" className="relative w-[calc(100%-10rem)] max-w-[600px]">
            <div className="flex overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e10] transition-transform duration-500 ease-out" style={parallax(6)}>
                <div className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-white/[0.06] py-4" aria-hidden>
                    <Hexagon size={18} className="mb-2" />
                    {[true, false, false, false].map((isActive, index) => (
                        <span key={index} className={`h-6 w-6 rounded-lg ${isActive ? "bg-white/15" : "bg-white/[0.04]"}`} />
                    ))}
                </div>

                <div className="flex-1 space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium">Balanço do mês</span>
                                <span className="text-sm font-semibold tabular-nums text-emerald-300">
                                    {chartIndex === null ? `+ ${formatAmount(BALANCE)}` : `Dia ${CHART_DAYS[chartIndex]}`}
                                </span>
                            </div>
                            <svg
                                viewBox="0 0 200 80"
                                className="mt-3 w-full cursor-crosshair overflow-visible"
                                onMouseMove={(event) => {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    const ratio = (event.clientX - rect.left) / rect.width;
                                    setChartIndex(Math.min(CHART_DAYS.length - 1, Math.max(0, Math.round(ratio * (CHART_DAYS.length - 1)))));
                                }}
                                onMouseLeave={() => setChartIndex(null)}
                            >
                                {[20, 40, 60].map((y) => (
                                    <line key={y} x1="0" x2="200" y1={y} y2={y} stroke="rgba(255,255,255,0.04)" />
                                ))}
                                <path d={`${linePath(CHART_INCOME)} L200 80 L0 80 Z`} fill="#34d399" fillOpacity="0.08" />
                                <path d={linePath(CHART_INCOME)} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
                                <path d={linePath(CHART_SPENDING)} fill="none" stroke="#fb7185" strokeWidth="2" strokeLinejoin="round" />
                                {chartIndex !== null && (
                                    <>
                                        <line x1={chartX(chartIndex)} x2={chartX(chartIndex)} y1="0" y2="80" stroke="rgba(255,255,255,0.2)" strokeDasharray="2 3" />
                                        <circle cx={chartX(chartIndex)} cy={chartY(CHART_INCOME[chartIndex])} r="3.5" fill="#34d399" stroke="#111111" strokeWidth="1.5" />
                                        <circle cx={chartX(chartIndex)} cy={chartY(CHART_SPENDING[chartIndex])} r="3.5" fill="#fb7185" stroke="#111111" strokeWidth="1.5" />
                                    </>
                                )}
                            </svg>
                            <div className="mt-2 flex gap-3 text-[11px] tabular-nums text-neutral-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[#34d399]" />
                                    {chartIndex === null ? "Receitas" : formatAmount(CHART_INCOME[chartIndex])}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[#fb7185]" />
                                    {chartIndex === null ? "Despesas" : formatAmount(CHART_SPENDING[chartIndex])}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium">Gastos por categoria</span>
                                <span className="text-sm font-semibold tabular-nums">{formatAmount(SPENDING)}</span>
                            </div>
                            <div className="mt-3 flex h-2 gap-[3px]">
                                {SPENDING_ENTRIES.map((entry) => (
                                    <span
                                        key={entry.key}
                                        {...hover(entry.key)}
                                        className={`min-w-[4px] rounded-full ${fadeClass} ${dim(entry.key)}`}
                                        style={{ flexGrow: -entry.amount, backgroundColor: CATEGORIES[entry.key].color }}
                                    />
                                ))}
                            </div>
                            <ul className="mt-3 space-y-1">
                                {SPENDING_ENTRIES.slice(0, 3).map((entry) => {
                                    const { label, color, Icon } = CATEGORIES[entry.key];
                                    const percent = (-entry.amount / SPENDING) * 100;
                                    return (
                                        <li
                                            key={entry.key}
                                            {...hover(entry.key)}
                                            className={`flex items-center gap-2.5 rounded-lg px-1 py-0.5 ${fadeClass} ${dim(entry.key)} ${active === entry.key ? "bg-white/[0.04]" : ""}`}
                                        >
                                            <span
                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                                style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
                                            >
                                                <Icon size={13} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline justify-between gap-2 text-xs">
                                                    <span className="truncate text-neutral-100">{label}</span>
                                                    <span className="shrink-0 tabular-nums text-neutral-500">{percent.toFixed(1)}%</span>
                                                </span>
                                                <span className="mt-1 block h-1 rounded-full bg-white/[0.05]">
                                                    <span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
                        <figcaption className="mb-3 text-base font-medium">Movimentações de outubro</figcaption>
                        <ul>
                            {ENTRIES.map(({ key, label, installment, detail, amount }) => {
                                const { color, Icon } = CATEGORIES[key];
                                return (
                                    <li
                                        key={label}
                                        {...hover(key)}
                                        className={`flex items-center gap-3 rounded-xl border px-2 py-1.5 ${fadeClass} transition-colors ${dim(key)}`}
                                        style={active === key ? { borderColor: `${color}40`, backgroundColor: `${color}0d` } : { borderColor: "transparent" }}
                                    >
                                        <span
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                            style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
                                        >
                                            <Icon size={16} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2 text-sm font-medium">
                                                <span className="truncate">{label}</span>
                                                {installment && (
                                                    <span className="shrink-0 rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide tabular-nums text-amber-300">
                                                        Parcela {installment}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block truncate text-xs text-neutral-500">{detail}</span>
                                        </span>
                                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {amount > 0 ? "+" : "−"} {formatAmount(Math.abs(amount))}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            </div>

            <Widget className="-left-16 top-4 w-64" depth={18} icon={Wallet} color="#34d399" title="Sobra do mês" meta="Outubro" active={active === null}>
                <span className="mt-3 block text-[1.65rem] font-semibold leading-none tabular-nums tracking-[-0.03em]">{formatAmount(BALANCE)}</span>
                <span className="mt-2 inline-flex rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-emerald-300">
                    {((BALANCE / INCOME) * 100).toFixed(1).replace(".", ",")}% da renda livre
                </span>
                <span className="mt-3.5 flex h-2 gap-[3px]">
                    {SPENDING_ENTRIES.map((entry) => (
                        <span
                            key={entry.key}
                            className={`rounded-full ${fadeClass}`}
                            style={{ flexGrow: -entry.amount, backgroundColor: CATEGORIES[entry.key].color, opacity: active && active !== entry.key ? 0.2 : 1 }}
                        />
                    ))}
                    <span className="rounded-full bg-white/[0.08]" style={{ flexGrow: BALANCE }} />
                </span>
                <span className="mt-1.5 flex justify-between text-[10px] text-neutral-500">
                    <span>Gastos</span>
                    <span>Sobra</span>
                </span>
            </Widget>

            <Widget
                className="-right-16 bottom-[36%] w-60"
                depth={24}
                icon={CreditCard}
                color={CATEGORIES.cartao.color}
                title="Fatura de outubro"
                meta="Fechada"
                active={active === "cartao"}
                {...hover("cartao")}
            >
                <span className="mt-3 block text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]">{formatAmount(1427.9)}</span>
                <span className="mt-3.5 flex items-end justify-between gap-1">
                    {[6, 7, 8, 9, 10, 11, 12].map((day) => {
                        const isToday = day === 7;
                        const isDue = day === 12;
                        return (
                            <span key={day} className="flex flex-1 flex-col items-center gap-1">
                                <span className={`h-1.5 w-full rounded-full ${isDue ? "bg-[#a78bfa]" : day <= 7 ? "bg-[#a78bfa]/40" : "bg-white/[0.07]"}`} />
                                <span className={`text-[10px] tabular-nums ${isDue ? "font-semibold text-[#c4b5fd]" : isToday ? "text-neutral-200" : "text-neutral-600"}`}>{day}</span>
                            </span>
                        );
                    })}
                </span>
                <span className="mt-1.5 block text-[11px] text-neutral-500">Vence dia 12, daqui a 5 dias</span>
            </Widget>

            <Widget
                className="-right-12 bottom-[4%] w-60"
                depth={14}
                icon={Laptop}
                color={CATEGORIES.eletronicos.color}
                title="Notebook"
                meta="Parcela 4 de 10"
                active={active === "eletronicos"}
                {...hover("eletronicos")}
            >
                <span className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]">{formatAmount(389)}</span>
                    <span className="text-xs text-neutral-500">/mês</span>
                </span>
                <span className="mt-3.5 grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }, (_, index) => (
                        <span
                            key={index}
                            className={`h-2 rounded-[3px] ${index < 3 ? "bg-[#f59e0b]" : index === 3 ? "bg-[#fbbf24] ring-2 ring-[#f59e0b]/30" : "bg-white/[0.07]"}`}
                        />
                    ))}
                </span>
                <span className="mt-1.5 flex justify-between text-[11px] tabular-nums text-neutral-500">
                    <span>Pago {formatAmount(389 * 4)}</span>
                    <span>Faltam {formatAmount(389 * 6)}</span>
                </span>
            </Widget>

            <Widget
                className="-bottom-10 -left-14 w-64"
                depth={20}
                icon={PiggyBank}
                color={CATEGORIES.metas.color}
                title="Reserva de emergência"
                meta="Meta"
                active={active === "metas"}
                {...hover("metas")}
            >
                <span className="mt-3 flex items-center gap-3.5">
                    <svg viewBox="0 0 36 36" className="h-14 w-14 shrink-0 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                        <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke="#f472b6"
                            strokeWidth="4"
                            strokeLinecap="round"
                            pathLength={100}
                            strokeDasharray={`${active === "metas" ? 67 : 62} 100`}
                            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
                        />
                    </svg>
                    <span className="min-w-0">
                        <span className="block text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]">{active === "metas" ? "67%" : "62%"}</span>
                        <span className="mt-1.5 block text-[11px] tabular-nums text-neutral-400">R$ {active === "metas" ? "6.700" : "6.200"} de R$ 10.000</span>
                        <span className="mt-0.5 block text-[11px] tabular-nums text-emerald-400">+ R$ 500 este mês</span>
                    </span>
                </span>
            </Widget>
        </figure>
        </div>
    );
}

const parallax = (depth: number) => ({
    transform: `translate3d(calc(var(--px) * ${depth}px), calc(var(--py) * ${depth}px), 0)`,
});

interface WidgetProps {
    className: string;
    depth: number;
    icon: LucideIcon;
    color: string;
    title: string;
    meta: string;
    active: boolean;
    children: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

// A card "pulled out" of the screen; while its item is hovered it lifts and takes the item's color.
function Widget({ className, depth, icon: Icon, color, title, meta, active, children, onMouseEnter, onMouseLeave }: WidgetProps) {
    const lit = active && Boolean(onMouseEnter);
    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                ...parallax(depth),
                borderColor: lit ? `${color}59` : undefined,
                backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${color}${lit ? "1f" : "0d"}, transparent 60%)`,
            }}
            className={`absolute overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#161618] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[translate,transform,border-color] duration-500 ease-out motion-reduce:transition-none ${
                lit ? "-translate-y-1" : ""
            } ${className}`}
        >
            <span className="flex items-center gap-2.5">
                <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}33` }}
                >
                    <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">{title}</span>
                <span className="shrink-0 text-[11px] text-neutral-500">{meta}</span>
            </span>
            {children}
        </div>
    );
}
