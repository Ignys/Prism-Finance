import { Suspense, lazy } from "react";

const BalancoMensal = lazy(() => import("./charts/BalancoMensal").then((module) => ({ default: module.BalancoMensal })));
const GastosPorCategoria = lazy(() => import("./charts/GastosPorCategoria").then((module) => ({ default: module.GastosPorCategoria })));

export function Charts() {
    return (
        <section className="w-4/10 space-y-2">
            <Suspense fallback={<div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-4 text-sm text-neutral-400">Carregando graficos...</div>}>
                <BalancoMensal />
                <GastosPorCategoria />
            </Suspense>
        </section>
    );
}
