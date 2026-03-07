import { BalancoMensal } from "./charts/BalancoMensal";
import { GastosPorCategoria } from "./charts/GastosPorCategoria";

export function Charts() {
    return (
        <section className="w-4/10 space-y-2">
            <BalancoMensal />
            <GastosPorCategoria />
        </section>
    );
}
